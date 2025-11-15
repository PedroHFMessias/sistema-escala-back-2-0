// src/routes/member.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const router = Router();

router.use(checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']));

// --- GET /members ---
router.get('/', async (req: Request, res) => {
  const loggedInUser = req.user!;

  try {
    let whereClause: Prisma.UserWhereInput = {};

    // ⬇️ --- ESTA É A LÓGICA ATUALIZADA (CONFORME A SUA SUGESTÃO) --- ⬇️
    if (loggedInUser.role === 'COORDINATOR') {
      // Coordenador agora vê TODOS os voluntários
      whereClause = { 
        role: 'VOLUNTEER'
      };
    } else if (loggedInUser.role === 'DIRECTOR') {
      // Diretor continua a ver Coordenadores E Voluntários
      whereClause = {
        role: {
          in: ['COORDINATOR', 'VOLUNTEER'],
        },
      };
    }
    // ⬆️ --- FIM DA ATUALIZAÇÃO --- ⬆️

    const members = await prisma.user.findMany({
      where: whereClause,
      include: {
        address: true, 
        ministries: { 
          include: {
            ministry: {
              select: { name: true, color: true, id: true }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    const formattedMembers = members.map(m => ({
      ...m,
      ministries: m.ministries.map(mm => mm.ministryId),
      ministryDetails: m.ministries.map(mm => mm.ministry)
    }));

    res.json(formattedMembers);

  } catch (error) {
    console.error('[members/GET]', error);
    res.status(500).json({ message: 'Erro ao buscar membros.' });
  }
});

// --- POST /members ---
// (Esta rota permanece igual, sem alterações)
router.post('/', async (req: Request, res) => {
  const { name, email, phone, cpf, rg, address, password, userType, ministries } = req.body;
  const loggedInUserRole = req.user!.role as UserRole;

  if (loggedInUserRole === 'COORDINATOR' && userType !== 'VOLUNTEER') {
    return res.status(403).json({ message: 'Coordenadores só podem criar Voluntários.' });
  }
  if (loggedInUserRole === 'DIRECTOR' && !['COORDINATOR', 'VOLUNTEER'].includes(userType)) {
     return res.status(400).json({ message: 'Tipo de utilizador inválido.' });
  }

  if (!name || !email || !cpf || !rg || !address || !password || !userType || !ministries?.length) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const newMember = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          phone,
          cpf,
          rg,
          password: hashedPassword,
          role: userType as UserRole,
        },
      });

      await tx.address.create({
        data: {
          ...address,
          userId: user.id,
        },
      });

      await tx.ministryMember.createMany({
        data: (ministries as string[]).map(ministryId => ({
          userId: user.id,
          ministryId: ministryId,
        })),
      });

      return user;
    });

    res.status(201).json(newMember);

  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email, CPF ou RG já está em uso.' });
    }
    console.error('[members/POST]', error);
    res.status(500).json({ message: 'Erro ao criar membro.' });
  }
});

// --- PUT /members/:id ---
// (Esta rota permanece igual, sem alterações)
router.put('/:id', async (req: Request, res) => {
  const { id } = req.params;
  const { name, email, phone, cpf, rg, address, userType, ministries } = req.body;
  const loggedInUserRole = req.user!.role as UserRole;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    if (loggedInUserRole === 'COORDINATOR' && targetUser.role !== 'VOLUNTEER') {
      return res.status(403).json({ message: 'Coordenadores só podem editar Voluntários.' });
    }
    if (targetUser.role === 'DIRECTOR') {
        return res.status(403).json({ message: 'Não é permitido editar um Diretor.' });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id },
        data: {
          name,
          email: email.toLowerCase(),
          phone,
          cpf,
          rg,
          role: userType as UserRole,
        },
      });

      await tx.address.update({
        where: { userId: id },
        data: { ...address },
      });

      await tx.ministryMember.deleteMany({
        where: { userId: id },
      });
      await tx.ministryMember.createMany({
        data: (ministries as string[]).map(ministryId => ({
          userId: id,
          ministryId: ministryId,
        })),
      });
    });

    res.json({ message: 'Membro atualizado com sucesso.' });
  } catch (error: any) {
     if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email, CPF ou RG já está em uso por outro membro.' });
    }
    console.error('[members/PUT/:id]', error);
    res.status(500).json({ message: 'Erro ao atualizar membro.' });
  }
});

// --- PUT /members/:id/toggle-status ---
// (Esta rota permanece igual, sem alterações)
router.put('/:id/toggle-status', async (req: Request, res) => {
  const { id } = req.params;
  const loggedInUserRole = req.user!.role as UserRole;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    if (loggedInUserRole === 'COORDINATOR' && targetUser.role !== 'VOLUNTEER') {
      return res.status(403).json({ message: 'Coordenadores só podem alterar o status de Voluntários.' });
    }
    if (targetUser.role === 'DIRECTOR') {
        return res.status(403).json({ message: 'Não é permitido alterar o status de um Diretor.' });
    }

    const newStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    
    await prisma.user.update({
      where: { id },
      data: { status: newStatus },
    });
    
    res.json({ message: `Status do membro alterado para ${newStatus}.` });
  } catch (error) {
    console.error('[members/toggle-status]', error);
    res.status(500).json({ message: 'Erro ao alterar status do membro.' });
  }
});

// --- DELETE /members/:id ---
// (Esta rota permanece igual, sem alterações)
router.delete('/:id', async (req: Request, res) => {
  const { id } = req.params;
  const loggedInUserId = req.user!.id;
  const loggedInUserRole = req.user!.role as UserRole;

  if (id === loggedInUserId) {
    return res.status(400).json({ message: 'Não pode excluir a si mesmo.' });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    if (targetUser.role === 'DIRECTOR') {
      return res.status(403).json({ message: 'Não é permitido excluir um Diretor.' });
    }
    if (loggedInUserRole === 'COORDINATOR' && targetUser.role !== 'VOLUNTEER') {
      return res.status(403).json({ message: 'Coordenadores só podem excluir Voluntários.' });
    }

    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    if (error.code === 'P2003') {
        return res.status(400).json({ message: 'Não é possível excluir: este membro está vinculado a escalas ou outras atividades.' });
    }
    console.error('[members/DELETE/:id]', error);
    res.status(500).json({ message: 'Erro ao excluir membro.' });
  }
});

export default router;