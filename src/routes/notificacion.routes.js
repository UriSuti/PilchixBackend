import { Router } from "express";
import { notificacionController } from "../controllers/notificacion.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.get("/", notificacionController.listar);
router.get("/contador", notificacionController.contar);
router.put("/leidas", notificacionController.marcarLeidas);

export default router;