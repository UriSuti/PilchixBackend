import { compraService } from "../services/compra.service.js";

export const compraController = {
  async confirmar(req, res, next) {
    try {
      const { idPagoMp } = req.body;
      const data = await compraService.confirmarCompra(req.auth.id, idPagoMp);
      res.json(data);
    } catch (err) { next(err); }
  },

  // TEMPORAL: ver compraService.registrarCompraSinVerificar
  async registrarAlPagar(req, res, next) {
    try {
      const data = await compraService.registrarCompraSinVerificar(req.auth.id);
      res.json(data);
    } catch (err) { next(err); }
  },
};
