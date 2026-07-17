import { Router } from "express";
import { busquedaController } from "../controllers/busqueda.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", autenticar, soloUsuario, busquedaController.guardar);

export default router;
