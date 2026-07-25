import { Router } from "express";
import { marcaController } from "../controllers/marca.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";

const router = Router();

// perfil de la marca logueada (back-office → Configuración)
router.get("/perfil", autenticar, soloMarca, marcaController.getPerfil);
router.put("/perfil", autenticar, soloMarca, marcaController.actualizarPerfil);

export default router;
