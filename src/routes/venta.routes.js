import { Router } from "express";
import { ventaController } from "../controllers/venta.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloMarca);

router.get("/", ventaController.getVentas);

export default router;
