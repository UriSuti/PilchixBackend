import { Router } from "express";
import { tiendanubeController } from "../controllers/tiendanube.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloMarca);

// 1) lista los productos de la tienda (rápido, no crea nada)
router.post("/tiendanube/listar", tiendanubeController.listarTiendanube);
// 2) importa un producto por llamada (el front los va pasando de a uno, con barra de progreso)
router.post("/tiendanube/producto", tiendanubeController.importarProductoTiendanube);

export default router;
