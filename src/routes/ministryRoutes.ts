import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { requireRole } from '../middlewares/roleMiddleware';
import { Role } from '@prisma/client';
import * as ministryController from '../controllers/ministryController';

const router = Router();

router.use(authMiddleware);

// DIRECTOR e COORDINATOR podem gerenciar ministérios
router.get('/', requireRole([Role.DIRECTOR, Role.COORDINATOR]), ministryController.getMinistries);
router.get('/:id', requireRole([Role.DIRECTOR, Role.COORDINATOR]), ministryController.getMinistryById);
router.post('/', requireRole([Role.DIRECTOR, Role.COORDINATOR]), ministryController.createMinistry);
router.put('/:id', requireRole([Role.DIRECTOR, Role.COORDINATOR]), ministryController.updateMinistry);

// ativar / desativar
router.patch('/:id/status', requireRole([Role.DIRECTOR, Role.COORDINATOR]), ministryController.toggleStatus);

// DIRECTOR pode excluir
router.delete('/:id', requireRole([Role.DIRECTOR]), ministryController.deleteMinistry);

export default router;
