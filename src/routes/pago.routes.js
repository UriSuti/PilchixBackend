import { Router } from "express";
import { pagoController } from "../controllers/pago.controller.js";

const router = Router();

router.post("/create-preference", pagoController.crearPreferencia);
router.post("/process-payment", pagoController.procesarPago);

export default router;