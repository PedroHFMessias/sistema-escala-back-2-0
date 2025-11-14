import { Request, Response, NextFunction } from 'express';
import * as ministryService from '../services/ministryService';

export const createMinistry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ministry = await ministryService.createMinistry(req.body);
    res.status(201).json(ministry);
  } catch (err) {
    next(err);
  }
};

export const getMinistries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ministries = await ministryService.getMinistries();
    res.json(ministries);
  } catch (err) {
    next(err);
  }
};

export const getMinistryById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ministry = await ministryService.getMinistryById(Number(req.params.id));
    res.json(ministry);
  } catch (err) {
    next(err);
  }
};

export const updateMinistry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ministry = await ministryService.updateMinistry(Number(req.params.id), req.body);
    res.json(ministry);
  } catch (err) {
    next(err);
  }
};

export const toggleStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ministry = await ministryService.toggleMinistryStatus(
      Number(req.params.id),
      req.body.isActive
    );
    res.json(ministry);
  } catch (err) {
    next(err);
  }
};

export const deleteMinistry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await ministryService.deleteMinistry(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
