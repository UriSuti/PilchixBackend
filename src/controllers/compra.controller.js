import { compraService } from "../services/compra.service.js";

export const compraController = {
  async confirmar(req, res, next) {
    try {
      const { idPagoMp } = req.body;
      const data = await compraService.confirmarCompra(req.auth.id, idPagoMp);
      res.json(data);
    } catch (err) { next(err); }
  },
};
