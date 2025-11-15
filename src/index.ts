// src/index.ts

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// --- IMPORTAÇÃO DAS ROTAS ---
import authRoutes from './routes/auth.js';
import ministryRoutes from './routes/ministry.js';
import memberRoutes from './routes/member.js';
import scheduleRoutes from './routes/schedule.js';

// --- INICIALIZAÇÃO ---
export const prisma = new PrismaClient();
const app: Express = express(); // <-- A definição de 'app' estava em falta
const PORT = process.env.PORT || 3001; // <-- A definição de 'PORT' estava em falta

// --- MIDDLEWARES GLOBAIS ---
app.use(cors()); // Permite requisições do seu frontend
app.use(express.json()); // Habilita o parsing de JSON no body

// --- ROTA DE TESTE ---
app.get('/', (req: Request, res: Response) => {
  res.send('Backend do Sistema de Escalas está rodando!');
});

/* =====================================
   REGISTO DE TODAS AS ROTAS DA API
   =====================================
*/
app.use('/auth', authRoutes);
app.use('/ministries', ministryRoutes);
app.use('/members', memberRoutes);
app.use('/schedules', scheduleRoutes);


// --- INICIAR O SERVIDOR ---
app.listen(PORT, () => {
  console.log(`[server]: Servidor rodando em http://localhost:${PORT} ⚡`);
});