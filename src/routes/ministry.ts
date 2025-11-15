// src/routes/ministry.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { Ministry } from '@prisma/client'; 

const router = Router();

/**
 * ========================================
 * ROTA DE LEITURA (Coordenador / Diretor)
 * ========================================
 */

// --- GET /ministries ---
// Lista todos os ministérios (para preencher formulários)
// ⬇️ --- CORREÇÃO AQUI --- ⬇️
// Esta rota agora é acessível por Coordenadores E Diretores
router.get('/', checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']), async (req, res) => {
  try {
    const ministries = await prisma.ministry.findMany({
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Formata os dados como o frontend de gestão espera
    const formattedMinistries = ministries.map((m: Ministry & { _count: { members: number } }) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      color: m.color,
      isActive: m.isActive,
      createdAt: m.createdAt,
      membersCount: m._count.members,
    }));
    
    res.json(formattedMinistries);
  } catch (error) {
    console.error('[ministries/GET]', error);
    res.status(500).json({ message: 'Erro ao buscar ministérios.' });
  }
});


/**
 * ========================================
 * ROTAS DE GESTÃO (Apenas Diretor)
 * ========================================
 */

// ⬇️ --- CORREÇÃO AQUI --- ⬇️
// Este middleware agora aplica-se apenas às rotas ABAIXO dele
router.use(checkAuth, checkRole(['DIRECTOR']));

// --- POST /ministries ---
router.post('/', async (req: Request, res) => {
  const { name, description, color } = req.body;

  // (Validação...)
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres' });
  }
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ message: 'Descrição deve ter pelo menos 10 caracteres' });
  }

  try {
    const existingMinistry = await prisma.ministry.findUnique({
      where: { name },
    });
    if (existingMinistry) {
      return res.status(409).json({ message: 'Já existe um ministério com esse nome' });
    }

    const newMinistry = await prisma.ministry.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        color,
        isActive: true,
      },
    });
    res.status(201).json(newMinistry);
  } catch (error) {
    console.error('[ministries/POST]', error);
    res.status(500).json({ message: 'Erro ao criar ministério.' });
  }
});

// --- PUT /ministries/:id ---
router.put('/:id', async (req: Request, res) => {
  const { id } = req.params;
  const { name, description, color } = req.body;

  // (Validação...)
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres' });
  }
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ message: 'Descrição deve ter pelo menos 10 caracteres' });
  }

  try {
    const existingMinistry = await prisma.ministry.findFirst({
      where: {
        name: name.trim(),
        id: { not: id }, 
      },
    });
    if (existingMinistry) {
      return res.status(409).json({ message: 'Já existe outro ministério com esse nome' });
    }

    const updatedMinistry = await prisma.ministry.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description.trim(),
        color,
      },
    });
    res.json(updatedMinistry);
  } catch (error) {
    console.error('[ministries/PUT/:id]', error);
    res.status(500).json({ message: 'Erro ao atualizar ministério.' });
  }
});

// --- PUT /ministries/:id/toggle-status ---
router.put('/:id/toggle-status', async (req: Request, res) => {
  const { id } = req.params;
  try {
    const ministry = await prisma.ministry.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!ministry) {
      return res.status(404).json({ message: 'Ministério não encontrado.' });
    }
    const updatedMinistry = await prisma.ministry.update({
      where: { id },
      data: {
        isActive: !ministry.isActive,
      },
    });
    res.json(updatedMinistry);
  } catch (error) {
    console.error('[ministries/toggle-status]', error);
    res.status(500).json({ message: 'Erro ao alterar status do ministério.' });
  }
});

// --- DELETE /ministries/:id ---
router.delete('/:id', async (req: Request, res) => {
  const { id } = req.params;
  try {
    const memberCount = await prisma.ministryMember.count({
      where: { ministryId: id },
    });
    if (memberCount > 0) {
      return res.status(400).json({ 
        message: 'Não é possível excluir um ministério que possui membros vinculados.' 
      });
    }
    await prisma.ministry.delete({
      where: { id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('[ministries/DELETE/:id]', error);
    res.status(500).json({ message: 'Erro ao excluir ministério.' });
  }
});

export default router;