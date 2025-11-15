// src/routes/ministry.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { Ministry } from '@prisma/client'; // Importamos o tipo para evitar erros

const router = Router();

/**
 * ========================================
 * ROTAS DE MINISTÉRIOS
 * Protegidas por:
 * 1. checkAuth (Estar logado)
 * 2. checkRole(['DIRECTOR']) (Ser Diretor)
 * ========================================
 */
router.use(checkAuth, checkRole(['DIRECTOR']));


// --- GET /ministries ---
// Lista todos os ministérios (para a página MinistryManagementePage.tsx)
router.get('/', async (req, res) => {
  try {
    const ministries = await prisma.ministry.findMany({
      // Inclui a contagem de membros de cada ministério
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Formata os dados como o frontend espera (membersCount)
    //
    const formattedMinistries = ministries.map((m: Ministry & { _count: { members: number } }) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      color: m.color,
      isActive: m.isActive,
      createdAt: m.createdAt,
      membersCount: m._count.members, // Mapeia o _count para membersCount
    }));
    
    res.json(formattedMinistries);
  } catch (error) {
    console.error('[ministries/GET]', error);
    res.status(500).json({ message: 'Erro ao buscar ministérios.' });
  }
});


// --- POST /ministries ---
// Cria um novo ministério (baseado no modal de MinistryManagementePage.tsx)
router.post('/', async (req: Request, res) => {
  const { name, description, color } = req.body;

  // 1. Validação (replicando a lógica do frontend)
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres' });
  }
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ message: 'Descrição deve ter pelo menos 10 caracteres' });
  }

  try {
    // 2. Verifica se o nome já existe
    const existingMinistry = await prisma.ministry.findUnique({
      where: { name },
    });

    if (existingMinistry) {
      return res.status(409).json({ message: 'Já existe um ministério com esse nome' });
    }

    // 3. Cria o ministério
    const newMinistry = await prisma.ministry.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        color,
        isActive: true, // Por defeito, é criado como ativo
      },
    });

    res.status(201).json(newMinistry);
  } catch (error) {
    console.error('[ministries/POST]', error);
    res.status(500).json({ message: 'Erro ao criar ministério.' });
  }
});


// --- PUT /ministries/:id ---
// Atualiza um ministério (baseado no modal de edição)
router.put('/:id', async (req: Request, res) => {
  const { id } = req.params;
  const { name, description, color } = req.body;

  // Validação
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres' });
  }
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ message: 'Descrição deve ter pelo menos 10 caracteres' });
  }

  try {
    // 1. Verifica se o novo nome já está em uso por OUTRO ministério
    const existingMinistry = await prisma.ministry.findFirst({
      where: {
        name: name.trim(),
        id: { not: id }, // Exclui o próprio ministério da verificação
      },
    });

    if (existingMinistry) {
      return res.status(409).json({ message: 'Já existe outro ministério com esse nome' });
    }

    // 2. Atualiza o ministério
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
// Ativa ou desativa um ministério
router.put('/:id/toggle-status', async (req: Request, res) => {
  const { id } = req.params;

  try {
    // 1. Encontra o estado atual
    const ministry = await prisma.ministry.findUnique({
      where: { id },
      select: { isActive: true },
    });

    if (!ministry) {
      return res.status(404).json({ message: 'Ministério não encontrado.' });
    }

    // 2. Inverte o estado
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
// Exclui um ministério
router.delete('/:id', async (req: Request, res) => {
  const { id } = req.params;

  try {
    // 1. Verifica se o ministério tem membros (lógica do frontend)
    const memberCount = await prisma.ministryMember.count({
      where: { ministryId: id },
    });

    if (memberCount > 0) {
      return res.status(400).json({ 
        message: 'Não é possível excluir um ministério que possui membros vinculados.' 
      });
    }
    
    // (Poderíamos adicionar uma verificação de escalas (Schedules) aqui também)

    // 2. Exclui o ministério
    await prisma.ministry.delete({
      where: { id },
    });

    res.status(204).send(); // 204 No Content (sucesso, sem corpo)
  } catch (error) {
    console.error('[ministries/DELETE/:id]', error);
    res.status(500).json({ message: 'Erro ao excluir ministério.' });
  }
});


export default router;