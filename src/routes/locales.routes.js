import { Router } from "express";
import { localesController } from "../controllers/locales.controller.js";

// rutas públicas: vidriera para visitantes anónimos, sin autenticación
const router = Router();

router.get("/", localesController.getLocales);
router.get("/marcas", localesController.getMarcas);
router.get("/marcas/populares", localesController.getMarcasPopulares);
router.get("/marcas/buscar", localesController.buscarMarcas);
router.get("/:idMarca/fachada", localesController.getFachada);
router.get("/:idMarca/productos", localesController.getProductos);

export default router;
