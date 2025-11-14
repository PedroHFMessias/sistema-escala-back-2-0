import { prisma } from '../config/prisma';

interface MinistryInput {
  name: string;
  description?: string;
  color?: string;
  isActive?: boolean;
}

export async function createMinistry(data: MinistryInput) {
  const existing = await prisma.ministry.findUnique({
    where: { name: data.name }
  });

  if (existing) {
    throw { status: 400, message: 'Já existe um ministério com esse nome.' };
  }

  const ministry = await prisma.ministry.create({
    data
  });

  return ministry;
}

export async function getMinistries() {
  const ministries = await prisma.ministry.findMany({
    include: {
      users: true
    },
    orderBy: { name: 'asc' }
  });

  // adicionar membersCount manualmente
  return ministries.map((min) => ({
    ...min,
    membersCount: min.users.length
  }));
}

export async function getMinistryById(id: number) {
  const ministry = await prisma.ministry.findUnique({
    where: { id },
    include: {
      users: {
        include: { user: true }
      }
    }
  });

  if (!ministry) {
    throw { status: 404, message: 'Ministério não encontrado.' };
  }

  return {
    ...ministry,
    membersCount: ministry.users.length
  };
}

export async function updateMinistry(id: number, data: MinistryInput) {
  const existing = await prisma.ministry.findUnique({ where: { id } });

  if (!existing) {
    throw { status: 404, message: 'Ministério não encontrado.' };
  }

  const updated = await prisma.ministry.update({
    where: { id },
    data
  });

  return updated;
}

export async function toggleMinistryStatus(id: number, isActive: boolean) {
  const existing = await prisma.ministry.findUnique({ where: { id } });

  if (!existing) {
    throw { status: 404, message: 'Ministério não encontrado.' };
  }

  const updated = await prisma.ministry.update({
    where: { id },
    data: { isActive }
  });

  return updated;
}

export async function deleteMinistry(id: number) {
  await prisma.ministry.delete({
    where: { id }
  });
}
