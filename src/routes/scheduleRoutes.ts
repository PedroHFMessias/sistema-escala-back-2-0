import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";
import { Role } from "@prisma/client";
import * as controller from "../controllers/scheduleController";

const router = Router();

// Só usuários logados
router.use(authMiddleware);

// Criar escala (coordenador e diretor)
router.post("/", requireRole([Role.DIRECTOR, Role.COORDINATOR]), controller.createSchedule);

// Listar escalas
router.get("/", controller.getSchedules);

// Buscar por ID
router.get("/:id", controller.getScheduleById);

// Atualizar
router.put("/:id", requireRole([Role.DIRECTOR, Role.COORDINATOR]), controller.updateSchedule);

// Deletar
router.delete("/:id", requireRole([Role.DIRECTOR, Role.COORDINATOR]), controller.deleteSchedule);

// Confirmar presença (qualquer voluntário autenticado)
router.post("/:id/confirm", controller.confirmPresence);

// Solicitar troca
router.post("/:id/swap", controller.requestSwap);

export default router;
