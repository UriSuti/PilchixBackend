import { Router } from "express";
import { stylistController } from "../controllers/stylist.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

// AI Stylist: solo usuarios logueados (cada consulta usa la cuota de la API de IA)
const router = Router();
router.use(autenticar, soloUsuario);

router.get("/preferencias", stylistController.getPreferencias);
router.put("/preferencias", stylistController.guardarPreferencias);

router.post("/outfits", stylistController.generarOutfits);
router.post("/outfits/cambiar-prenda", stylistController.cambiarPrenda);

export default router;
