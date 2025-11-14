import { Request, Response, NextFunction } from "express";
import * as service from "../services/scheduleService";

export const createSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = {
      ...req.body,
      createdById: req.user!.id  // <-- corrigido
    };

    const schedule = await service.createSchedule(data);
    res.status(201).json(schedule);
  } catch (err) {
    next(err);
  }
};

export const getSchedules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedules = await service.getSchedules();
    res.json(schedules);
  } catch (err) {
    next(err);
  }
};

export const getScheduleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await service.getScheduleById(Number(req.params.id));
    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

export const updateSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await service.updateSchedule(Number(req.params.id), req.body);
    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

export const deleteSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.deleteSchedule(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// Voluntário confirma presença na escala  
export const confirmPresence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.confirmPresence(Number(req.params.id), req.user!.id); // <-- corrigido
    res.json({ message: "Presença confirmada com sucesso!" });
  } catch (err) {
    next(err);
  }
};

// Voluntário solicita troca
export const requestSwap = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await service.requestSwap(Number(req.params.id), req.user!.id); // <-- corrigido
    res.json({ message: "Solicitação de troca enviada!" });
  } catch (err) {
    next(err);
  }
};
