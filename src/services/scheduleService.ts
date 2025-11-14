import { prisma } from "../config/prisma";

interface CreateScheduleInput {
  type: string;
  date: string;
  time: string;
  notes?: string;
  ministryId: number;
  volunteers: number[];
  createdById: number;
}

interface UpdateScheduleInput {
  type?: string;
  date?: string;
  time?: string;
  notes?: string;
  ministryId?: number;
  volunteers?: number[];
}

export async function createSchedule(data: CreateScheduleInput) {
  const { type, date, time, notes, ministryId, volunteers, createdById } = data;

  // Criar escala
  const schedule = await prisma.schedule.create({
    data: {
      type,
      date: new Date(date),
      time,
      notes,
      ministryId,
      createdById
    }
  });

  // Inserir voluntários (ScheduleVolunteer)
  if (volunteers && volunteers.length > 0) {
    await prisma.scheduleVolunteer.createMany({
      data: volunteers.map((volunteerId) => ({
        scheduleId: schedule.id,
        volunteerId
      }))
    });
  }

  return schedule;
}

export async function getSchedules() {
  return prisma.schedule.findMany({
    include: {
      ministry: true,
      volunteers: {
        include: { volunteer: true }
      },
      createdBy: true
    },
    orderBy: { date: "asc" }
  });
}

export async function getScheduleById(id: number) {
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      ministry: true,
      volunteers: {
        include: { volunteer: true }
      },
      createdBy: true
    }
  });

  if (!schedule) throw { status: 404, message: "Escala não encontrada." };
  return schedule;
}

export async function updateSchedule(id: number, data: UpdateScheduleInput) {
  const { volunteers, ...rest } = data;

  // Atualiza os campos básicos
  await prisma.schedule.update({
    where: { id },
    data: {
      ...rest,
      date: rest.date ? new Date(rest.date) : undefined
    }
  });

  // Atualiza voluntários (remove todos e recria)
  if (volunteers) {
    await prisma.scheduleVolunteer.deleteMany({
      where: { scheduleId: id }
    });

    if (volunteers.length > 0) {
      await prisma.scheduleVolunteer.createMany({
        data: volunteers.map((volunteerId) => ({
          scheduleId: id,
          volunteerId
        }))
      });
    }
  }

  // Retorna atualizado
  return getScheduleById(id);
}

export async function deleteSchedule(id: number) {
  // Remove participações primeiro
  await prisma.scheduleVolunteer.deleteMany({
    where: { scheduleId: id }
  });

  // Remove escala
  await prisma.schedule.delete({
    where: { id }
  });
}

// Confirmar presença
export async function confirmPresence(scheduleId: number, userId: number) {
  return prisma.scheduleVolunteer.updateMany({
    where: { scheduleId, volunteerId: userId },
    data: { confirmationStatus: "CONFIRMED" }
  });
}

// Solicitar troca
export async function requestSwap(scheduleId: number, userId: number) {
  return prisma.scheduleVolunteer.updateMany({
    where: { scheduleId, volunteerId: userId },
    data: { swapRequested: true }
  });
}
