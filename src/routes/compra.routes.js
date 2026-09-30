import { Router } from "express";
import { compraController } from "../controllers/compra.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/confirmar", autenticar, soloUsuario, compraController.confirmar);
// TEMPORAL: registra la compra al hacer click en pagar, sin verificar con Mercado Pago
router.post("/registrar-al-pagar", autenticar, soloUsuario, compraController.registrarAlPagar);

export default router;
