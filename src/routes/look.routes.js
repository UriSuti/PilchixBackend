import { Router } from "express";
import { lookController } from "../controllers/look.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";
import { uploadImagenLook } from "../middlewares/upload.middleware.js";

const router = Router();

// público (landing "Shop the look")
router.get("/", lookController.getPublicos);

// back-office (marca)
router.get("/mis", autenticar, soloMarca, lookController.getMisLooks);
router.post("/", autenticar, soloMarca, uploadImagenLook, lookController.crear);
router.put("/:idLook", autenticar, soloMarca, uploadImagenLook, lookController.actualizar);
router.put("/:idLook/productos", autenticar, soloMarca, lookController.setProductos);
router.delete("/:idLook", autenticar, soloMarca, lookController.borrar);

export default router;
