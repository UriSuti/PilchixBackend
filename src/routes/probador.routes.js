import { Router } from "express";
import { probadorController } from "../controllers/probador.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";
import { uploadFotoPrueba } from "../middlewares/upload.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.get("/", probadorController.listar);
router.post("/:idProducto", uploadFotoPrueba, probadorController.generar);

export default router;
