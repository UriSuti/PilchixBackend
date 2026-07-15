import { localesRepository } from "../repositories/locales.repository.js";

export const localesController = {
  async getLocales(req, res, next) {
    try {
      const data = await localesRepository.getLocalesConProductos();
      res.json(data);
    } catch (err) { next(err); }
  },

  async getMarcas(req, res, next) {
    try {
      const data = await localesRepository.getMarcasActivas();
      res.json(data);
    } catch (err) { next(err); }
  },

  async getMarcasPopulares(req, res, next) {
    try {
      const data = await localesRepository.getMarcasPopulares();
      res.json(data);
    } catch (err) { next(err); }
  },

  async buscarMarcas(req, res, next) {
    try {
      const texto = req.query.q?.trim() || "";
      const data = texto ? await localesRepository.buscarMarcas(texto) : [];
      res.json(data);
    } catch (err) { next(err); }
  },

  async getFachada(req, res, next) {
    try {
      const data = await localesRepository.getFachada(req.params.idMarca);
      res.json(data);
    } catch (err) { next(err); }
  },

  async getProductos(req, res, next) {
    try {
      const data = await localesRepository.getProductosDeLocal(req.params.idMarca);
      res.json(data);
    } catch (err) { next(err); }
  },
};
