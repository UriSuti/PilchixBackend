import { importacionService } from "../services/importacion.service.js";

export const importacionController = {
  async iniciar(req, res, next) {
    try {
      res.status(202).json(importacionService.iniciar(req.auth.id, req.body.link));
    } catch (err) { next(err); }
  },

  async estado(req, res, next) {
    try {
      res.json(importacionService.estado(req.params.id, req.auth.id));
    } catch (err) { next(err); }
  },

  async confirmar(req, res, next) {
    try {
      res.status(202).json(importacionService.confirmar(req.params.id, req.auth.id, req.body.productos));
    } catch (err) { next(err); }
  },

  async cancelar(req, res, next) {
    try {
      importacionService.cancelar(req.params.id, req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
