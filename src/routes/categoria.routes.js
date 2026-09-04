import { Router } from "express";
import { categoriaController } from "../controllers/categoria.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(autenticar, soloMarca);

router.get("/", categoriaController.getModulo);
router.post("/:idCategoria/activar", categoriaController.activar);
router.delete("/:idCategoria/activar", categoriaController.desactivar);

router.post("/subcategorias", categoriaController.crearSub);
router.put("/subcategorias/:id", categoriaController.actualizarSub);
router.delete("/subcategorias/:id", categoriaController.borrarSub);

export default router;