// src/routes/member.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { Prisma, UserRole } from '@prisma/client'; // Importamos os tipos
import bcrypt from 'bcrypt';

const router = Router();

/**
 * ========================================
 * ROTAS DE MEMBROS (GERENCIAMENTO)
 * Protegidas por:
 * 1. checkAuth (Estar logado)
 * 2. checkRole(['DIRECTOR', 'COORDINATOR'])
 * ========================================
 */
router.use(checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']));


// --- GET /members ---
// Lista os membros com base no papel do utilizador logado
router.get('/', async (req: Request, res) => {
  const loggedInUserRole = req.user!.role as UserRole;

  try {
    let whereClause: Prisma.UserWhereInput = {};

    // Lógica de permissão do frontend
    if (loggedInUserRole === 'COORDINATOR') {
      // Coordenadores só veem voluntários
      whereClause = { role: 'VOLUNTEER' };
    } else if (loggedInUserRole === 'DIRECTOR') {
      // Diretores veem Coordenadores e Voluntários
      whereClause = {
        role: {
          in: ['COORDINATOR', 'VOLUNTEER'],
        },
      };
    }

    const members = await prisma.user.findMany({
      where: whereClause,
      include: {
        address: true, // Inclui o endereço
        ministries: {  // Inclui as ligações aos ministérios
          include: {
            ministry: { // Inclui os detalhes do ministério (nome, cor)
              select: { name: true, color: true, id: true }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    // Formata os dados como o frontend espera
    const formattedMembers = members.map(m => ({
      ...m,
      // O frontend espera uma lista simples de IDs de ministério
      ministries: m.ministries.map(mm => mm.ministryId),
      // O frontend também espera os nomes para exibir (bónus)
      ministryDetails: m.ministries.map(mm => mm.ministry)
    }));

    res.json(formattedMembers);

  } catch (error) { // Fecho do 'try'
    console.error('[members/GET]', error);
    res.status(500).json({ message: 'Erro ao buscar membros.' });
  }
}); // Fecho do 'router.get'


// --- POST /members ---
// Cria um novo membro (baseado no modal MemberManagementPage.tsx)
router.post('/', async (req: Request, res) => {
  const { name, email, phone, cpf, rg, address, password, userType, ministries } = req.body;
  const loggedInUserRole = req.user!.role as UserRole;

  // 1. Validação de Permissão
  if (loggedInUserRole === 'COORDINATOR' && userType !== 'VOLUNTEER') {
    return res.status(403).json({ message: 'Coordenadores só podem criar Voluntários.' });
  }
  // Diretores podem criar Coordenadores ou Voluntários
  if (loggedInUserRole === 'DIRECTOR' && !['COORDINATOR', 'VOLUNTEER'].includes(userType)) {
     return res.status(400).json({ message: 'Tipo de utilizador inválido.' });
  }

  // 2. Validação de Dados (Básica)
  if (!name || !email || !cpf || !rg || !address || !password || !userType || !ministries?.length) {
    return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
  }

  try {
    // 3. Encriptar a senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Criar Utilizador, Endereço e Ligações de Ministério (Transação)
    const newMember = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // a. Cria o Utilizador
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

      // b. Cria o Endereço
      await tx.address.create({
        data: {
          ...address,
          userId: user.id,
        },
      });

      // c. Liga aos Ministérios
      await tx.ministryMember.createMany({
        data: (ministries as string[]).map(ministryId => ({
          userId: user.id,
          ministryId: ministryId,
        })),
      });

      return user;
    }); // Fecho do $transaction

    res.status(201).json(newMember);

  } catch (error: any) { // Fecho do 'try'
    if (error.code === 'P2002') { // Conflito de unicidade (email/cpf/rg)
      return res.status(409).json({ message: 'Email, CPF ou RG já está em uso.' });
    }
    console.error('[members/POST]', error);
    res.status(500).json({ message: 'Erro ao criar membro.' });
  }
}); // Fecho do 'router.post'


// --- PUT /members/:id ---
// Atualiza um membro
router.put('/:id', async (req: Request, res) => {
  const { id } = req.params;
  const { name, email, phone, cpf, rg, address, userType, ministries } = req.body;
  const loggedInUserRole = req.user!.role as UserRole;

  try {
    // 1. Obter o utilizador-alvo
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    // 2. Lógica de Permissão
    if (loggedInUserRole === 'COORDINATOR' && targetUser.role !== 'VOLUNTEER') {
      return res.status(403).json({ message: 'Coordenadores só podem editar Voluntários.' });
    }
    if (targetUser.role === 'DIRECTOR') {
        return res.status(403).json({ message: 'Não é permitido editar um Diretor.' });
    }

    // 3. Atualizar em transação
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // a. Atualiza dados do Utilizador
      await tx.user.update({
        where: { id },
        data: {
          name,
          email: email.toLowerCase(),
          phone,
          cpf,
          rg,
          role: userType as UserRole, // O Diretor pode mudar o papel de alguém
        },
      });

      // b. Atualiza o Endereço
      await tx.address.update({
        where: { userId: id },
        data: { ...address },
      });

      // c. Atualiza os Ministérios (Remove todos e adiciona os novos)
      await tx.ministryMember.deleteMany({
        where: { userId: id },
      });
      await tx.ministryMember.createMany({
        data: (ministries as string[]).map(ministryId => ({ // Corrigido 'ministryIds' para 'ministryId'
          userId: id,
          ministryId: ministryId,
        })),
      });
    }); // Fecho do $transaction

    res.json({ message: 'Membro atualizado com sucesso.' });
  } catch (error: any) { // Fecho do 'try'
     if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Email, CPF ou RG já está em uso por outro membro.' });
    }
    console.error('[members/PUT/:id]', error);
    res.status(500).json({ message: 'Erro ao atualizar membro.' });
  }
}); // Fecho do 'router.put'


// --- PUT /members/:id/toggle-status ---
// Ativa ou desativa um membro
router.put('/:id/toggle-status', async (req: Request, res) => {
  const { id } = req.params;
  const loggedInUserRole = req.user!.role as UserRole;

  try {
    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    // Lógica de Permissão
    if (loggedInUserRole === 'COORDINATOR' && targetUser.role !== 'VOLUNTEER') {
      return res.status(403).json({ message: 'Coordenadores só podem alterar o status de Voluntários.' });
    }
    if (targetUser.role === 'DIRECTOR') {
        return res.status(403).json({ message: 'Não é permitido alterar o status de um Diretor.' });
    }

    // Inverte o status atual
    const newStatus = targetUser.status === 'active' ? 'inactive' : 'active';
    
    await prisma.user.update({
      where: { id },
      data: { status: newStatus },
    });
    
    res.json({ message: `Status do membro alterado para ${newStatus}.` });
  } catch (error) { // Fecho do 'try'
    console.error('[members/toggle-status]', error);
    res.status(500).json({ message: 'Erro ao alterar status do membro.' });
  }
}); // Fecho do 'router.put'


// --- DELETE /members/:id ---
// Exclui um membro
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

    // Lógica de Permissão (replicando a do frontend)
    if (targetUser.role === 'DIRECTOR') {
      return res.status(403).json({ message: 'Não é permitido excluir um Diretor.' });
    }
    if (loggedInUserRole === 'COORDINATOR' && targetUser.role !== 'VOLUNTEER') {
      return res.status(403).json({ message: 'Coordenadores só podem excluir Voluntários.' });
    }

    // Excluir o utilizador (o onDelete: Cascade no schema trata de Address e MinistryMember)
    await prisma.user.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) { // Fecho do 'try'
    if (error.code === 'P2003') { // Violação de chave estrangeira
        return res.status(400).json({ message: 'Não é possível excluir: este membro está vinculado a escalas ou outras atividades.' });
    }
    console.error('[members/DELETE/:id]', error);
    res.status(500).json({ message: 'Erro ao excluir membro.' });
  }
}); // Fecho do 'router.delete'


export default router;