// src/middleware/roleMiddleware.ts

import { Request, Response, NextFunction } from 'express';

// Os papéis devem corresponder exatamente ao seu enum no schema.prisma
type UserRole = 'VOLUNTEER' | 'COORDINATOR' | 'DIRECTOR';

/**
 * Middleware para verificar se o utilizador tem um dos papéis permitidos.
 * Deve ser usado *APÓS* o middleware checkAuth.
 */
export const checkRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    
    // Se o req.user não existir (checkAuth falhou ou esqueceu-se de o usar)
    if (!req.user) {
      return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    const userRole = req.user.role as UserRole;

    // Verifica se o papel do utilizador está na lista de papéis permitidos
    if (allowedRoles.includes(userRole)) {
      // O utilizador tem permissão, continua
      next(); 
    } else {
      // O utilizador está autenticado, mas não tem permissão
      return res.status(403).json({ message: 'Acesso negado. Não tem permissão para este recurso.' });
    }
  };
};