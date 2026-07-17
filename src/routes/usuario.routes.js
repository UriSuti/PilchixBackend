import { Router } from "express";
import { usuarioController } from "../controllers/usuario.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";
import { uploadFotoPerfil } from "../middlewares/upload.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.put("/me", usuarioController.actualizarPerfil);
router.post("/me/foto", uploadFotoPerfil, usuarioController.subirFoto);

export default router;
