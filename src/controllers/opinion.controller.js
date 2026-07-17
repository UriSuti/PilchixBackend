import { opinionService } from "../services/opinion.service.js";

export const opinionController = {
  async listarPorProducto(req, res, next) {
    try {
      const data = await opinionService.listar(req.params.idProducto);
      res.json(data);
    } catch (err) { next(err); }
  },

  async getEstado(req, res, next) {
    try {
      const data = await opinionService.getEstado(req.params.idProducto, req.auth.id);
      res.json(data);
    } catch (err) { next(err); }
  },

  async crear(req, res, next) {
    try {
      const { id_producto, texto, recomienda } = req.body;
      if (!id_producto) return res.status(400).json({ error: "Falta id_producto" });
      const data = await opinionService.crear({
        idProducto: id_producto,
        idUsuario: req.auth.id,
        texto,
        recomienda,
      });
      res.status(201).json(data);
    } catch (err) { next(err); }
  },

  async eliminar(req, res, next) {
    try {
      await opinionService.eliminar(req.params.id, req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
