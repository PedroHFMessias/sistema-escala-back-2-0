import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// 1. Importar as nossas novas rotas
import authRoutes from './routes/auth.js';
import ministryRoutes from './routes/ministry.js';
import memberRoutes from './routes/member.js'; // <-- ADICIONE ESTA LINHA

// 2. Inicializa o Prisma Client
export const prisma = new PrismaClient();

// 3. Inicializa o Express
const app: Express = express();
const PORT = process.env.PORT || 3001;

// 4. Configura os Middlewares
app.use(cors());
app.use(express.json());

// 5. Rota de Teste
app.get('/', (req: Request, res: Response) => {
  res.send('Backend do Sistema de Escalas está rodando!');
});

/* =====================================
   REGISTO DAS ROTAS
   =====================================
*/
app.use('/auth', authRoutes);
app.use('/ministries', ministryRoutes);
app.use('/members', memberRoutes); // <-- ADICIONE ESTA LINHA


// 7. Inicia o Servidor
app.listen(PORT, () => {
  console.log(`[server]: Servidor rodando em http://localhost:${PORT} ⚡`);
});