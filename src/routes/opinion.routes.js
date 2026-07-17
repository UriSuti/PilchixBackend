import { Router } from "express";
import { opinionController } from "../controllers/opinion.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

// las opiniones son públicas para leer; publicar/borrar exige ser un usuario comprador
const router = Router();

router.get("/producto/:idProducto", opinionController.listarPorProducto);
router.get("/producto/:idProducto/estado", autenticar, soloUsuario, opinionController.getEstado);
router.post("/", autenticar, soloUsuario, opinionController.crear);
router.delete("/:id", autenticar, soloUsuario, opinionController.eliminar);

export default router;
