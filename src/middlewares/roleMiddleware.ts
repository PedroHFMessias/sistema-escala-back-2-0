import { NextFunction, Response } from 'express';
import { Role } from '@prisma/client';

export const requireRole = (roles: Role[]) => {
  return (req: any, res: Response, next: NextFunction) => {
    const userRole = req.user?.role as Role | undefined;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    next();
  };
};
