import { Router } from "express";
import { probadorController } from "../controllers/probador.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";
import { uploadFotoPrueba } from "../middlewares/upload.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.get("/", probadorController.listar);

// foto guardada en el perfil (se usa por defecto en el probador)
router.get("/foto", probadorController.getFoto);
router.put("/foto", uploadFotoPrueba, probadorController.subirFoto);
router.delete("/foto", probadorController.borrarFoto);

router.post("/:idProducto", uploadFotoPrueba, probadorController.generar);
router.delete("/pruebas/:idPrueba", probadorController.borrarPrueba);

export default router;
