import { Router } from "express";
import { marcaController } from "../controllers/marca.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";
import { uploadLogoMarca, uploadFachadaMarca } from "../middlewares/upload.middleware.js";

const router = Router();

// perfil de la marca logueada (back-office → Configuración)
router.get("/perfil", autenticar, soloMarca, marcaController.getPerfil);
router.put("/perfil", autenticar, soloMarca, marcaController.actualizarPerfil);
router.post("/perfil/logo", autenticar, soloMarca, uploadLogoMarca, marcaController.subirLogo);
router.post("/perfil/fachada", autenticar, soloMarca, uploadFachadaMarca, marcaController.subirFachada);

export default router;
