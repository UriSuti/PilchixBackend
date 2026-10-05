import { ventaService } from "../services/venta.service.js";

export const ventaController = {
  async getVentas(req, res, next) {
    try { res.json(await ventaService.getVentas(req.auth.id)); }
    catch (err) { next(err); }
  },

  async getComprobante(req, res, next) {
    try { res.json(await ventaService.urlComprobante(req.auth.id, Number(req.params.idLiquidacion))); }
    catch (err) { next(err); }
  },
};
