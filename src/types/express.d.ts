// src/types/express.d.ts

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Request } from 'express';

// Isto "aumenta" a definição global do Express
declare global {
  namespace Express {
    export interface Request {
      // Adiciona a propriedade 'user' opcional ao objeto Request
      user?: {
        id: string;
        role: string;
      };
    }
  }
}