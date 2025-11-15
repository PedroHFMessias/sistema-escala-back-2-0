// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
// Lembre-se que temos de usar .js nas importações de ficheiros locais
import { verifyToken } from '../utils/jwt.js';

/**
 * Middleware para verificar se o utilizador está autenticado.
 * Lê o token "Bearer" do cabeçalho Authorization.
 */
export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Autenticação necessária. Token não fornecido.' });
  }

  // O formato esperado é "Bearer <token>"
  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token mal formatado.' });
  }

  // Verifica o token
  const userPayload = verifyToken(token);

  if (!userPayload) {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }

  // SUCESSO! Adiciona os dados do utilizador (id, role) ao objeto 'req'
  // (O TypeScript entende isto graças ao nosso ficheiro express.d.ts)
  req.user = userPayload;

  // Continua para a rota protegida
  next();
};