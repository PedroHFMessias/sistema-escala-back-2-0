import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { Role } from '@prisma/client';
import * as userController from '../controllers/userController';

const router = Router();

// Todas as rotas daqui pra baixo exigem usuário logado
router.use(authMiddleware);

// DIRECTOR e COORDINATOR podem gerenciar usuários
router.post(
  '/',
  requireRole([Role.DIRECTOR, Role.COORDINATOR]),
  userController.createUser
);

router.get(
  '/',
  requireRole([Role.DIRECTOR, Role.COORDINATOR]),
  userController.getUsers
);

router.get(
  '/:id',
  requireRole([Role.DIRECTOR, Role.COORDINATOR]),
  userController.getUserById
);

router.put(
  '/:id',
  requireRole([Role.DIRECTOR, Role.COORDINATOR]),
  userController.updateUser
);

// Só DIRECTOR pode deletar
router.delete(
  '/:id',
  requireRole([Role.DIRECTOR]),
  userController.deleteUser
);

export default router;
