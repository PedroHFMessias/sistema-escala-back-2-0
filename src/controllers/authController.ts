import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

const service = new AuthService();

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await service.register(req.body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await service.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const me = async (req: any, res: Response, next: NextFunction) => {
  try {
    res.json(req.user);
  } catch (err) {
    next(err);
  }
};
