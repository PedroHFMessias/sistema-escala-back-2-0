// src/routes/dashboard.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(checkAuth); // Protege todas as rotas de dashboard

// --- GET /dashboard/summary ---
// Busca os números para os cartões da HomePage
router.get('/summary', async (req: Request, res) => {
  const loggedInUser = req.user!;
  
  try {
    let stats = {};

    // Define o início e o fim do dia de HOJE (para "confirmações hoje")
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (loggedInUser.role === 'DIRECTOR' || loggedInUser.role === 'COORDINATOR') {
      // --- Stats para Coordenador / Diretor ---
      
      // 1. Define o filtro de ministério (se for coordenador)
      let ministryFilter: { in: string[] } | undefined = undefined;
      if (loggedInUser.role === 'COORDINATOR') {
        const coordinatorMinistries = await prisma.ministryMember.findMany({
          where: { userId: loggedInUser.id },
          select: { ministryId: true },
        });
        ministryFilter = { in: coordinatorMinistries.map(m => m.ministryId) };
      }

      // 2. Busca os stats
      const totalVoluntarios = await prisma.user.count({
        where: { 
          role: 'VOLUNTEER',
          status: 'active' 
          // (Nota: Coordenador verá o total, não apenas o dos seus ministérios)
        }
      });
      
      const escalasPendentes = await prisma.scheduleVolunteer.count({
        where: {
          status: 'PENDING',
          schedule: {
            ministryId: ministryFilter // Aplica filtro (se existir)
          }
        }
      });
      
      const confirmacoesHoje = await prisma.scheduleVolunteer.count({
        where: {
          status: 'CONFIRMED',
          confirmedAt: {
            gte: today,
            lt: tomorrow
          },
          schedule: {
            ministryId: ministryFilter // Aplica filtro (se existir)
          }
        }
      });

      stats = {
        voluntariosAtivos: totalVoluntarios,
        escalasPendentes: escalasPendentes,
        confirmacoesHoje: confirmacoesHoje
      };

    } else if (loggedInUser.role === 'VOLUNTEER') {
      // --- Stats para Voluntário ---
      
      const proximasEscalas = await prisma.scheduleVolunteer.count({
        where: {
          volunteerId: loggedInUser.id,
          schedule: {
            date: { gte: today } // Escalas de hoje em diante
          }
        }
      });
      
      const pendenteConfirmacao = await prisma.scheduleVolunteer.count({
        where: {
          volunteerId: loggedInUser.id,
          status: 'PENDING'
        }
      });

      stats = {
        proximasEscalas: proximasEscalas,
        pendenteConfirmacao: pendenteConfirmacao
      };
    }

    res.json(stats);

  } catch (error) {
    console.error('[dashboard/summary GET]', error);
    res.status(500).json({ message: 'Erro ao buscar resumo do dashboard.' });
  }
});

export default router;