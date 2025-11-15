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

    // Formata a resposta para o frontend (ScheduleManagementPage.tsx)
    const formattedSchedules = schedules.map(s => ({
      id: s.id,
      date: s.date.toISOString().split('T')[0], // Envia apenas YYYY-MM-DD
      // Converte a data/hora do DB (que é UTC 1970-01-01T...) para HH:MM
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

    // ⬇️ --- CORREÇÃO APLICADA AQUI --- ⬇️
    // Prisma (com MySQL @db.Date) espera um objeto Date.
    // Para evitar problemas de fuso horário (ex: guardar dia 24 em vez de 25),
    // forçamos a data a ser interpretada como Meia-Noite UTC.
    const dateAsUTC = new Date(`${date}T00:00:00.000Z`);

    // Prisma (com MySQL @db.Time) espera um DateTime.
    // Usamos a data "base" (Epoch) mas com a hora fornecida, em UTC.
    const timeAsUTC = new Date(`1970-01-01T${time}:00.000Z`);
    // ⬆️ --- FIM DA CORREÇÃO --- ⬆️

    const newSchedule = await prisma.schedule.create({
      data: {
        type,
        date: dateAsUTC, // Corrigido
        time: timeAsUTC, // Corrigido
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
  const loggedInUser = req.user!;

  try {
    // (Pode adicionar a verificação de permissão do Coordenador aqui também)

    // ⬇️ --- CORREÇÃO APLICADA AQUI (igual ao POST) --- ⬇️
    const dateAsUTC = new Date(`${date}T00:00:00.000Z`);
    const timeAsUTC = new Date(`1970-01-01T${time}:00.000Z`);
    // ⬆️ --- FIM DA CORREÇÃO --- ⬆️

    await prisma.$transaction(async (tx) => {
      // 1. Atualiza os dados da escala principal
      await tx.schedule.update({
        where: { id },
        data: {
          type,
          date: dateAsUTC, // Corrigido
          time: timeAsUTC, // Corrigido
          notes,
          ministryId,
        },
      });

      // 2. Obtém os voluntários *atuais* desta escala
      const currentVolunteers = await tx.scheduleVolunteer.findMany({
        where: { scheduleId: id },
        select: { volunteerId: true }
      });
      const currentVolunteerIds = currentVolunteers.map(v => v.volunteerId);
      const newVolunteerIds = (volunteerIds as string[]);

      // 3. Determina quem remover e quem adicionar
      const toRemove = currentVolunteerIds.filter(vid => !newVolunteerIds.includes(vid));
      const toAdd = newVolunteerIds.filter(vid => !currentVolunteerIds.includes(vid));

      // 4. Remove os que já não estão na lista
      await tx.scheduleVolunteer.deleteMany({
        where: {
          scheduleId: id,
          volunteerId: { in: toRemove },
        },
      });

      // 5. Adiciona os novos
      await tx.scheduleVolunteer.createMany({
        data: toAdd.map(volId => ({
          scheduleId: id,
          volunteerId: volId,
          status: 'PENDING',
        })),
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




export default router;