import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Erro interno:', err);

  const status = err.status || 500;
  const message = err.message || 'Erro interno no servidor.';

  return res.status(status).json({ message });
}
