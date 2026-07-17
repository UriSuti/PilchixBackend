import { Router } from "express";
import { favoritoController } from "../controllers/favorito.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.get("/", favoritoController.listar);
router.get("/:idProducto", favoritoController.obtener);
router.post("/:idProducto", favoritoController.agregar);
router.delete("/:idProducto", favoritoController.quitar);

export default router;
