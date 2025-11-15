// src/utils/jwt.ts

import jwt from 'jsonwebtoken';

// Lê a chave secreta que definimos no nosso ficheiro .env
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Chave secreta JWT_SECRET não definida no ficheiro .env');
}

// Gera um token para um utilizador
export const generateToken = (user: { id: string, role: string }): string => {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: '8h', // O token expira em 8 horas
    }
  );
};

// Verifica um token e retorna o payload (os dados do utilizador)
export const verifyToken = (token: string): { id: string, role: string } | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string, role: string };
    return payload;
  } catch (error) {
    // Token inválido ou expirado
    return null;
  }
};