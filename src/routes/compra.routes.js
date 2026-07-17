import { Router } from "express";
import { compraController } from "../controllers/compra.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/confirmar", autenticar, soloUsuario, compraController.confirmar);

export default router;
