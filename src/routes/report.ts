// src/routes/report.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { Prisma, UserRole, VolunteerStatus } from '@prisma/client';

const router = Router();

/**
 * ========================================
 * ROTAS DE RELATÓRIOS
 * ========================================
 */
router.use(checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']));


// --- GET /reports/schedules ---
router.get('/schedules', async (req: Request, res) => {
  const loggedInUser = req.user!;
  
  const { status, ministry, search } = req.query;

  try {
    let whereClause: Prisma.ScheduleVolunteerWhereInput = {};

    // 2. Aplica o filtro de PERMISSÃO
    if (loggedInUser.role === 'COORDINATOR') {
      const coordinatorMinistries = await prisma.ministryMember.findMany({
        where: { userId: loggedInUser.id },
        select: { ministryId: true },
      });
      const ministryIds = coordinatorMinistries.map(m => m.ministryId);
      
      // Garante que whereClause.schedule existe
      whereClause.schedule = {
        ministryId: { in: ministryIds }
      };
    }

    // 3. Aplica os filtros do utilizador
    
    // Filtro por STATUS
    if (status && status !== 'todos') {
      const prismaStatus = status.toString().toUpperCase() as VolunteerStatus; 
      if (Object.values(VolunteerStatus).includes(prismaStatus)) {
        whereClause.status = prismaStatus;
      }
    }

    // ⬇️ --- CORREÇÃO APLICADA AQUI --- ⬇️
    // Filtro por MINISTÉRIO (nome do ministério)
    if (ministry && ministry !== 'Todos') {
      
      // Se whereClause.schedule não existe (porque somos um Diretor),
      // inicializa-o como um objeto vazio.
      if (!whereClause.schedule) {
        whereClause.schedule = {};
      }

      // Agora adicionamos a propriedade 'ministry' de forma segura
      whereClause.schedule.ministry = {
        name: ministry.toString()
      };
    }
    // ⬆️ --- FIM DA CORREÇÃO --- ⬆️

    // Filtro por TERMO DE BUSCA (search)
    if (search) {
      const searchTerm = search.toString().toLowerCase();
      
      // Adiciona o filtro OR à cláusula 'where'
      whereClause.OR = [
        { volunteer: { name: { contains: searchTerm } } },
        { schedule: { type: { contains: searchTerm } } },
        { schedule: { ministry: { name: { contains: searchTerm } } } }
      ];
    }

    // 4. Executa a busca no banco
    const participations = await prisma.scheduleVolunteer.findMany({
      where: whereClause,
      include: {
        volunteer: { 
          select: { name: true }
        },
        schedule: {
          include: {
            ministry: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: {
        schedule: { date: 'asc' }
      }
    });

    // 5. Formata os dados (igual à rota /schedules/all)
    const formattedData = participations.map(p => ({
        id: p.id,
        date: p.schedule.date.toISOString().split('T')[0],
        time: p.schedule.time.toISOString().substring(11, 16),
        type: p.schedule.type,
        ministry: p.schedule.ministry.name,
        volunteer: p.volunteer.name,
        status: p.status.toLowerCase(),
        createdAt: p.schedule.createdAt
    }));

    res.json(formattedData);

  } catch (error) {
    console.error('[reports/schedules GET]', error);
    res.status(500).json({ message: 'Erro ao gerar relatório de escalas.' });
  }
});


// --- GET /reports/schedules/export ---
router.get('/schedules/export', (req: Request, res) => {
  const { format } = req.query;
  
  res.status(501).json({ 
    message: `Funcionalidade de exportar para ${format} ainda não implementada.` 
  });
});


export default router;