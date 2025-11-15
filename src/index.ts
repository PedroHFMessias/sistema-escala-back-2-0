import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// --- IMPORTAÇÃO DAS ROTAS ---
import authRoutes from './routes/auth.js';
import ministryRoutes from './routes/ministry.js';
import memberRoutes from './routes/member.js';
import scheduleRoutes from './routes/schedule.js';
import reportRoutes from './routes/report.js'; // <-- ADICIONE ESTA LINHA
import dashboardRoutes from './routes/dashboard.js'

// --- INICIALIZAÇÃO ---
export const prisma = new PrismaClient();
const app: Express = express();
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARES GLOBAIS ---
app.use(cors()); 
app.use(express.json()); 

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
app.use('/reports', reportRoutes); // <-- ADICIONE ESTA LINHA
app.use('/dashboard', dashboardRoutes);



// --- INICIAR O SERVIDOR ---
app.listen(PORT, () => {
  console.log(`[server]: Servidor rodando em http://localhost:${PORT} ⚡`);
});