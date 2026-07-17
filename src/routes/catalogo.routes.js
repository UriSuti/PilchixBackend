import { Router } from "express";
import { catalogoController } from "../controllers/catalogo.controller.js";
import { autenticar, soloMarca } from "../middlewares/auth.middleware.js";
import { uploadImagenes } from "../middlewares/upload.middleware.js";

const router = Router();

router.use(autenticar, soloMarca);

router.get("/categorias", catalogoController.getCategorias);
router.get("/dashboard", catalogoController.getDashboard);
router.get("/metricas", catalogoController.getMetricas);

router.get("/productos", catalogoController.getProductosDeMarca);
router.get("/productos/:idProducto", catalogoController.getProductoPorId);
router.post("/productos", catalogoController.crearProducto);
router.put("/productos/:idProducto", catalogoController.actualizarProducto);
router.delete("/productos/:idProducto", catalogoController.borrarProducto);

router.post("/productos/:idProducto/categorias", catalogoController.setCategoriasProducto);
router.put("/productos/:idProducto/categorias", catalogoController.actualizarCategoriasProducto);

router.post("/productos/:idProducto/imagenes", uploadImagenes, catalogoController.subirImagenesProducto);
router.put("/productos/:idProducto/imagenes/:idImagen/portada", catalogoController.marcarPortada);
router.put("/imagenes/:idImagen/color", catalogoController.actualizarColorImagen);
router.delete("/imagenes/:idImagen", catalogoController.borrarImagen);

export default router;
