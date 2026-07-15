import { Router } from "express";
import { productosPublicosController } from "../controllers/productos-publicos.controller.js";

// rutas públicas: catálogo de productos/categorías para la landing y las vistas de compra
const router = Router();

router.get("/", productosPublicosController.getProductos);
router.get("/populares", productosPublicosController.getProductosPopulares);
router.get("/descuentos", productosPublicosController.getDescuentos);
router.get("/buscar", productosPublicosController.buscarProductos);
router.get("/buscar/categorias", productosPublicosController.buscarProductosPorCategoria);

router.get("/categorias", productosPublicosController.getCategorias);
router.get("/categorias/resumen", productosPublicosController.getCategoriasConProductosResumen);
router.get("/categorias/completo", productosPublicosController.getCategoriasConProductosCompleto);
router.get("/categorias/buscar", productosPublicosController.buscarCategoriasPorNombre);

router.post("/:idProducto/visualizacion", productosPublicosController.incrementarVisualizacion);
router.post("/:idProducto/clic", productosPublicosController.incrementarClic);

export default router;
