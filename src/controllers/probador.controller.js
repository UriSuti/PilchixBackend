import { probadorService } from "../services/probador.service.js";

export const probadorController = {
  async generar(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "Falta la foto" });
      const resultado = await probadorService.generar(req.auth.id, req.params.idProducto, req.file);
      res.json(resultado);
    } catch (err) { next(err); }
  },

  async listar(req, res, next) {
    try {
      res.json(await probadorService.listarHistorial(req.auth.id));
    } catch (err) { next(err); }
  },
};
