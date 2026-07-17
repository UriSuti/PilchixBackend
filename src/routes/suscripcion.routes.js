import { Router } from "express";
import { suscripcionController } from "../controllers/suscripcion.controller.js";
import { autenticar, soloUsuario } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloUsuario);

router.get("/", suscripcionController.listar);
router.get("/:idMarca", suscripcionController.obtener);
router.post("/:idMarca", suscripcionController.agregar);
router.delete("/:idMarca", suscripcionController.quitar);

export default router;
