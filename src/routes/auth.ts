// src/routes/auth.ts

import { Router, Request } from 'express';
import bcrypt from 'bcrypt';
// Removida a importação 'Prisma' pois não é mais usada sem o /register
import { prisma } from '../index.js'; 
import { generateToken } from '../utils/jwt.js';
import { checkAuth } from '../middleware/authMiddleware.js';

const router = Router();

// --- POST /auth/login ---
// Corresponde à página LoginPage.tsx
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    // 1. Encontrar o utilizador pelo email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ message: 'Email ou senha inválidos.' });
    }

    // 2. Comparar a senha
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    }
    
    // 3. Gerar o token
    const token = generateToken({ id: user.id, role: user.role });

    // 4. Enviar a resposta
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('[login] Erro:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});


// --- ENDPOINT /auth/register REMOVIDO CONFORME SOLICITADO ---


// --- GET /auth/me ---
// Rota protegida para buscar dados do utilizador logado (usada pelo Layout.tsx)
router.get('/me', checkAuth, async (req: Request, res) => {
  const userId = req.user?.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilizador não encontrado.' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar dados do utilizador.' });
  }
});


export default router;