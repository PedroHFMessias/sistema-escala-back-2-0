import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma';

interface AddressInput {
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zipCode: string;
}

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  cpf?: string;
  rg?: string;
  role: Role;
  address?: AddressInput;
  ministryIds?: number[];
}

interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  cpf?: string;
  rg?: string;
  role?: Role;
  address?: AddressInput;
  ministryIds?: number[];
}

export async function createUser(data: CreateUserInput) {
  const { name, email, password, phone, cpf, rg, role, address, ministryIds } = data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw { status: 400, message: 'E-mail já cadastrado.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      phone,
      cpf,
      rg,
      role,
      address: address
        ? {
            create: {
              street: address.street,
              number: address.number,
              complement: address.complement,
              neighborhood: address.neighborhood,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode
            }
          }
        : undefined,
      ministries: ministryIds && ministryIds.length > 0
        ? {
            create: ministryIds.map((ministryId) => ({
              ministryId,
              isCoordinator: false
            }))
          }
        : undefined
    },
    include: {
      address: true,
      ministries: {
        include: {
          ministry: true
        }
      }
    }
  });

  return user;
}

export async function getUsers() {
  const users = await prisma.user.findMany({
    include: {
      address: true,
      ministries: {
        include: {
          ministry: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  return users;
}

export async function getUserById(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      address: true,
      ministries: {
        include: {
          ministry: true
        }
      }
    }
  });

  if (!user) {
    throw { status: 404, message: 'Usuário não encontrado.' };
  }

  return user;
}

export async function updateUser(id: number, data: UpdateUserInput) {
  const { address, ministryIds, password, ...rest } = data;

  const updates: any[] = [];

  // Atualizar dados básicos do usuário
  const userData: any = { ...rest };

  if (password) {
    userData.passwordHash = await bcrypt.hash(password, 10);
  }

  updates.push(
    prisma.user.update({
      where: { id },
      data: userData
    })
  );

  // Upsert de endereço (cria se não existir, atualiza se já tiver)
  if (address) {
    updates.push(
      prisma.address.upsert({
        where: { userId: id },
        create: {
          userId: id,
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode
        },
        update: {
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode
        }
      })
    );
  }

  // Atualizar ministérios (remove todos e cadastra de novo)
  if (ministryIds) {
    updates.push(
      prisma.userMinistry.deleteMany({
        where: { userId: id }
      })
    );

    if (ministryIds.length > 0) {
      updates.push(
        prisma.userMinistry.createMany({
          data: ministryIds.map((ministryId) => ({
            userId: id,
            ministryId,
            isCoordinator: false
          }))
        })
      );
    }
  }

  await prisma.$transaction(updates);

  // Retorna o usuário atualizado
  const updated = await prisma.user.findUnique({
    where: { id },
    include: {
      address: true,
      ministries: {
        include: { ministry: true }
      }
    }
  });

  return updated;
}

export async function deleteUser(id: number) {
  // Remover relação usuário ↔ ministérios
  await prisma.userMinistry.deleteMany({
    where: { userId: id }
  });

  // Remover endereço vinculado
  await prisma.address.deleteMany({
    where: { userId: id }
  });

  // Remover vínculos do usuário nas escalas (schedulevolunteer)
  await prisma.scheduleVolunteer.deleteMany({
    where: { volunteerId: id }
  });

  // Remover escalas criadas pelo usuário (se houver)
  await prisma.schedule.deleteMany({
    where: { createdById: id }
  });

  // Agora sim, excluir o usuário
  await prisma.user.delete({
    where: { id }
  });
}
