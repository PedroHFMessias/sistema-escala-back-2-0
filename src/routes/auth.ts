// src/routes/auth.ts (Backend)

import { Router, Request } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../index.js'; 
import { generateToken } from '../utils/jwt.js';
import { checkAuth } from '../middleware/authMiddleware.js';

const router = Router();

// --- POST /auth/login ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ message: 'Email ou senha inválidos.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email ou senha inválidos.' });
    }
    
    const token = generateToken({ id: user.id, role: user.role });

    // ⬇️ --- CORREÇÃO AQUI --- ⬇️
    // Adicionámos 'email: user.email' ao objeto de resposta
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email, // <-- ADICIONADO
        role: user.role,
      },
    });
    // ⬆️ --- FIM DA CORREÇÃO --- ⬆️

  } catch (error) {
    console.error('[login] Erro:', error);
    res.status(500).json({ message: 'Erro interno do servidor.' });
  }
});

// --- GET /auth/me ---
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