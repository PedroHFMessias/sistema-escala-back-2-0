import { Router } from 'express';
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import ministryRoutes from './ministryRoutes';
import scheduleRoutes from "./scheduleRoutes";


export const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'API do Sistema de Escalas - Paróquia Santana' });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/ministries', ministryRoutes);
router.use("/schedules", scheduleRoutes);