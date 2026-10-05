import { Router } from "express";
import { superadminController } from "../controllers/superadmin.controller.js";
import { autenticar, soloAdmin } from "../middlewares/auth.middleware.js";
import { uploadComprobante } from "../middlewares/upload.middleware.js";

const router = Router();
router.use(autenticar, soloAdmin);

router.get("/pendientes", superadminController.getPendientes);
router.get("/liquidaciones", superadminController.getLiquidaciones);
router.post("/liquidaciones", uploadComprobante, superadminController.liquidar);
router.get("/liquidaciones/:idLiquidacion/comprobante", superadminController.getComprobante);

export default router;
