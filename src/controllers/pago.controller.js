import { pagoService } from "../services/pago.service.js";

export const pagoController = {
  async crearPreferencia(req, res, next) {
    try {
      const data = await pagoService.crearPreferencia(req.body.items);
      res.json(data);
    } catch (err) { next(err); }
  },

  async procesarPago(req, res, next) {
    try {
      const data = await pagoService.procesarPago(req.body);
      res.json(data);
    } catch (err) { next(err); }
  },
};