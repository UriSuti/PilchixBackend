import { Router } from "express";
import { carritoController } from "../controllers/carrito.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.get("/", carritoController.listar);
router.get("/resumen", carritoController.resumen);
router.post("/items", carritoController.agregar);
router.put("/items/:idDetalle", carritoController.actualizarCantidad);
router.delete("/items/:idDetalle", carritoController.eliminar);

export default router;
