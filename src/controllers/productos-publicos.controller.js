import { productosPublicosRepository } from "../repositories/productos-publicos.repository.js";

export const productosPublicosController = {
  async getProductos(req, res, next) {
    try {
      res.json(await productosPublicosRepository.getProductos());
    } catch (err) { next(err); }
  },

  async getProductosPopulares(req, res, next) {
    try {
      res.json(await productosPublicosRepository.getProductosPopulares());
    } catch (err) { next(err); }
  },

  async getDescuentos(req, res, next) {
    try {
      const fecha = req.query.fecha || new Date().toISOString();
      res.json(await productosPublicosRepository.getDescuentos(fecha));
    } catch (err) { next(err); }
  },

  async buscarProductos(req, res, next) {
    try {
      const texto = req.query.q?.trim() || "";
      res.json(texto ? await productosPublicosRepository.buscarProductos(texto) : []);
    } catch (err) { next(err); }
  },

  async buscarProductosPorCategoria(req, res, next) {
    try {
      const texto = req.query.q?.trim() || "";
      res.json(texto ? await productosPublicosRepository.buscarProductosPorCategoria(texto) : []);
    } catch (err) { next(err); }
  },

  async getCategorias(req, res, next) {
    try {
      res.json(await productosPublicosRepository.getCategorias());
    } catch (err) { next(err); }
  },

  async getCategoriasConProductosResumen(req, res, next) {
    try {
      res.json(await productosPublicosRepository.getCategoriasConProductosResumen());
    } catch (err) { next(err); }
  },

  async getCategoriasConProductosCompleto(req, res, next) {
    try {
      res.json(await productosPublicosRepository.getCategoriasConProductosCompleto());
    } catch (err) { next(err); }
  },

  async buscarCategoriasPorNombre(req, res, next) {
    try {
      const texto = req.query.q?.trim() || "";
      res.json(texto ? await productosPublicosRepository.buscarCategoriasPorNombre(texto) : []);
    } catch (err) { next(err); }
  },

  async incrementarVisualizacion(req, res, next) {
    try {
      await productosPublicosRepository.incrementarVisualizacion(req.params.idProducto);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async incrementarClic(req, res, next) {
    try {
      await productosPublicosRepository.incrementarClic(req.params.idProducto);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
