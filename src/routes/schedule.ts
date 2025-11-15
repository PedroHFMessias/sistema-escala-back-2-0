// src/routes/schedule.ts

import { Router, Request } from 'express';
import { prisma } from '../index.js';
import { checkAuth } from '../middleware/authMiddleware.js';
import { checkRole } from '../middleware/roleMiddleware.js';
import { Prisma, UserRole } from '@prisma/client';

const router = Router();

/**
 * ========================================
 * ROTAS DE GESTÃO DE ESCALAS (CRUD)
 * ========================================
 */

// --- GET /schedules/management ---
router.get('/management', checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']), async (req: Request, res) => {
  const loggedInUser = req.user!;
  
  try {
    let ministryWhereClause: Prisma.ScheduleWhereInput = {};

    if (loggedInUser.role === 'COORDINATOR') {
      const coordinatorMinistries = await prisma.ministryMember.findMany({
        where: { userId: loggedInUser.id },
        select: { ministryId: true },
      });
      const ministryIds = coordinatorMinistries.map(m => m.ministryId);
      
      ministryWhereClause = {
        ministryId: { in: ministryIds },
      };
    }

    const schedules = await prisma.schedule.findMany({
      where: ministryWhereClause,
      include: {
        ministry: { 
          select: { name: true, color: true }
        },
        volunteers: { 
          include: {
            volunteer: { 
              select: { name: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    const formattedSchedules = schedules.map(s => ({
      id: s.id,
      date: s.date.toISOString().split('T')[0],
      time: s.time.toISOString().substring(11, 16), 
      type: s.type,
      ministry: s.ministry.name,
      ministryColor: s.ministry.color,
      notes: s.notes,
      createdAt: s.createdAt,
      volunteers: s.volunteers.map(v => ({
        id: v.volunteerId,
        name: v.volunteer.name,
        status: v.status.toLowerCase(),
      })),
    }));

    res.json(formattedSchedules);

  } catch (error) {
    console.error('[schedules/management GET]', error);
    res.status(500).json({ message: 'Erro ao buscar escalas para gestão.' });
  }
});

// --- POST /schedules/management ---
router.post('/management', checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']), async (req: Request, res) => {
  const { type, date, time, ministryId, volunteers: volunteerIds, notes } = req.body;
  const loggedInUser = req.user!;

  if (!type || !date || !time || !ministryId || !volunteerIds?.length) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  try {
    if (loggedInUser.role === 'COORDINATOR') {
      const isHisMinistry = await prisma.ministryMember.findFirst({
        where: {
          userId: loggedInUser.id,
          ministryId: ministryId,
        }
      });
      if (!isHisMinistry) {
        return res.status(403).json({ message: 'Não tem permissão para criar escalas para este ministério.' });
      }
    }
    
    const dateAsUTC = new Date(`${date}T00:00:00.000Z`);
    const timeAsUTC = new Date(`1970-01-01T${time}:00.000Z`);

    const newSchedule = await prisma.schedule.create({
      data: {
        type,
        date: dateAsUTC,
        time: timeAsUTC,
        notes,
        ministryId,
        createdById: loggedInUser.id,
        volunteers: {
          create: (volunteerIds as string[]).map(volId => ({
            volunteerId: volId,
            status: 'PENDING',
          })),
        },
      },
    });

    res.status(201).json(newSchedule);

  } catch (error) {
    console.error('[schedules/management POST]', error);
    res.status(500).json({ message: 'Erro ao criar escala.' });
  }
});

// --- PUT /schedules/management/:id ---
router.put('/management/:id', checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']), async (req: Request, res) => {
  const { id } = req.params;
  const { type, date, time, ministryId, volunteers: volunteerIds, notes } = req.body;

  if (!type || !date || !time || !ministryId || !volunteerIds?.length) {
    return res.status(400).json({ message: 'Campos obrigatórios em falta.' });
  }

  try {
    const dateAsUTC = new Date(`${date}T00:00:00.000Z`);
    const timeAsUTC = new Date(`1970-01-01T${time}:00.000Z`);

    await prisma.$transaction(async (tx) => {
      await tx.schedule.update({
        where: { id },
        data: {
          type,
          date: dateAsUTC,
          time: timeAsUTC,
          notes,
          ministryId,
        },
      });

      const currentVolunteers = await tx.scheduleVolunteer.findMany({
        where: { scheduleId: id },
        select: { volunteerId: true }
      });
      const currentVolunteerIds = currentVolunteers.map(v => v.volunteerId);
      const newVolunteerIds = (volunteerIds as string[]);

      const toRemove = currentVolunteerIds.filter(vid => !newVolunteerIds.includes(vid));
      const toAdd = newVolunteerIds.filter(vid => !currentVolunteerIds.includes(vid));

      await tx.scheduleVolunteer.deleteMany({
        where: {
          scheduleId: id,
          volunteerId: { in: toRemove },
        },
      });

      await tx.scheduleVolunteer.createMany({
        data: toAdd.map(volId => ({
          scheduleId: id,
          volunteerId: volId,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });
    });

    res.json({ message: 'Escala atualizada com sucesso.' });
  } catch (error) {
    console.error('[schedules/management PUT]', error);
    res.status(500).json({ message: 'Erro ao atualizar escala.' });
  }
});

// --- DELETE /schedules/management/:id ---
router.delete('/management/:id', checkAuth, checkRole(['DIRECTOR', 'COORDINATOR']), async (req: Request, res) => {
  const { id } = req.params;
  
  try {
    await prisma.schedule.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('[schedules/management DELETE]', error);
    res.status(500).json({ message: 'Erro ao excluir escala.' });
  }
});


/**
 * ========================================
 * ROTAS DO VOLUNTÁRIO
 * ========================================
 */

// --- GET /schedules/my ---
router.get('/my', checkAuth, checkRole(['VOLUNTEER']), async (req: Request, res) => {
  const loggedInVolunteerId = req.user!.id;

  try {
    const participations = await prisma.scheduleVolunteer.findMany({
      where: { volunteerId: loggedInVolunteerId },
      include: {
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

    const formattedSchedules = participations.map(p => ({
      id: p.id,
      scheduleId: p.scheduleId,
      date: p.schedule.date.toISOString().split('T')[0],
      time: p.schedule.time.toISOString().substring(11, 16),
      type: p.schedule.type,
      ministry: p.schedule.ministry.name,
      status: p.status.toLowerCase(),
      notes: p.schedule.notes,
      requestedChangeReason: p.requestedChangeReason
    }));

    res.json(formattedSchedules);

  } catch (error) {
    console.error('[schedules/my GET]', error);
    res.status(500).json({ message: 'Erro ao buscar "minhas escalas".' });
  }
});

// --- GET /schedules/my/confirmations ---
router.get('/my/confirmations', checkAuth, checkRole(['VOLUNTEER']), async (req: Request, res) => {
  const loggedInVolunteerId = req.user!.id;

  try {
    const participations = await prisma.scheduleVolunteer.findMany({
      where: { 
        volunteerId: loggedInVolunteerId,
        status: 'CONFIRMED'
      },
      include: {
        schedule: {
          include: {
            ministry: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { schedule: { date: 'asc' } }
    });

    const formattedSchedules = participations.map(p => ({
      id: p.id,
      scheduleId: p.scheduleId,
      date: p.schedule.date.toISOString().split('T')[0],
      time: p.schedule.time.toISOString().substring(11, 16),
      type: p.schedule.type,
      ministry: p.schedule.ministry.name,
      status: p.status.toLowerCase(),
      notes: p.schedule.notes
    }));

    res.json(formattedSchedules);
  } catch (error) {
    console.error('[schedules/my/confirmations GET]', error);
    res.status(500).json({ message: 'Erro ao buscar confirmações.' });
  }
});


// --- PUT /schedules/participation/:id/confirm ---
router.put('/participation/:id/confirm', checkAuth, checkRole(['VOLUNTEER']), async (req: Request, res) => {
  const participationId = req.params.id;
  const loggedInVolunteerId = req.user!.id;

  try {
    // ⬇️ --- LÓGICA DE SEGURANÇA ATUALIZADA --- ⬇️
    // Só permite a atualização se o status for PENDING
    const updatedParticipation = await prisma.scheduleVolunteer.updateMany({
      where: {
        id: participationId,
        volunteerId: loggedInVolunteerId,
        status: 'PENDING' // <-- SÓ ATUALIZA SE ESTIVER PENDENTE
      },
      data: {
        status: 'CONFIRMED',
        requestedChangeReason: null,
        confirmedAt: new Date(),
      }
    });
    
    // Se count for 0, significa que a atualização falhou
    if (updatedParticipation.count === 0) {
        // Verifica o porquê
        const participation = await prisma.scheduleVolunteer.findFirst({
            where: { id: participationId, volunteerId: loggedInVolunteerId }
        });

        if (!participation) {
            return res.status(404).json({ message: 'Participação não encontrada ou não pertence a este utilizador.'});
        }
        
        // Se encontrou, mas não atualizou, é porque o status estava errado
        if (participation.status === 'CONFIRMED') {
            return res.status(400).json({ message: 'Escala já está confirmada.' });
        }
        
        if (participation.status === 'EXCHANGE_REQUESTED') {
            return res.status(400).json({ message: 'Não é possível confirmar. A troca já foi solicitada.' });
        }
    }
    // ⬆️ --- FIM DA ATUALIZAÇÃO --- ⬆️

    res.json({ message: 'Participação confirmada com sucesso!' });
  } catch (error) {
    console.error('[schedules/confirm PUT]', error);
    res.status(500).json({ message: 'Erro ao confirmar participação.' });
  }
});


// --- PUT /schedules/participation/:id/request-change ---
router.put('/participation/:id/request-change', checkAuth, checkRole(['VOLUNTEER']), async (req: Request, res) => {
  const participationId = req.params.id;
  const loggedInVolunteerId = req.user!.id;
  const { justificationMessage } = req.body;

  try {
    // ⬇️ --- LÓGICA DE SEGURANÇA ATUALIZADA --- ⬇️
    // Só permite a atualização se o status for PENDING
    const updatedParticipation = await prisma.scheduleVolunteer.updateMany({
      where: {
        id: participationId,
        volunteerId: loggedInVolunteerId,
        status: 'PENDING' // <-- SÓ ATUALIZA SE ESTIVER PENDENTE
      },
      data: {
        status: 'EXCHANGE_REQUESTED',
        requestedChangeReason: justificationMessage || null,
        confirmedAt: null,
      }
    });

    if (updatedParticipation.count === 0) {
        // Verifica o porquê
        const participation = await prisma.scheduleVolunteer.findFirst({
            where: { id: participationId, volunteerId: loggedInVolunteerId }
        });

        if (!participation) {
            return res.status(404).json({ message: 'Participação não encontrada ou não pertence a este utilizador.'});
        }
        
        // Se encontrou, mas não atualizou
        if (participation.status === 'CONFIRMED') {
            return res.status(400).json({ message: 'Não é possível solicitar troca de uma escala já confirmada.' });
        }
        
        if (participation.status === 'EXCHANGE_REQUESTED') {
            return res.status(400).json({ message: 'Troca já solicitada.' });
        }
    }
    // ⬆️ --- FIM DA ATUALIZAÇÃO --- ⬆️

    res.json({ message: 'Solicitação de troca enviada com sucesso!' });
  } catch (error) {
    console.error('[schedules/request-change PUT]', error);
    res.status(500).json({ message: 'Erro ao solicitar troca.' });
  }
});


/**
 * ========================================
 * ROTA PÚBLICA (Partilhada)
 * ========================================
 */

// --- GET /schedules/all ---
router.get('/all', checkAuth, async (req: Request, res) => {
  try {
    const participations = await prisma.scheduleVolunteer.findMany({
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

    // Formata os dados como a ScheduleViewPage.tsx espera
    const formattedData = participations.map(p => ({
        id: p.id,
        date: p.schedule.date.toISOString().split('T')[0],
        time: p.schedule.time.toISOString().substring(11, 16),
        type: p.schedule.type,
        ministry: p.schedule.ministry.name,
        volunteer: p.volunteer.name,
        status: p.status.toLowerCase(),
    }));

    res.json(formattedData);

  } catch (error) {
    console.error('[schedules/all GET]', error);
    res.status(500).json({ message: 'Erro ao buscar todas as escalas.' });
  }
});


export default router;