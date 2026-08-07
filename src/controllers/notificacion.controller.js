import { notificacionService } from "../services/notificacion.service.js";

export const notificacionController = {
  async listar(req, res, next) {
    try { res.json(await notificacionService.listar(req.auth.id)); }
    catch (err) { next(err); }
  },
  async contar(req, res, next) {
    try { res.json({ noLeidas: await notificacionService.contar(req.auth.id) }); }
    catch (err) { next(err); }
  },
  async marcarLeidas(req, res, next) {
    try { await notificacionService.marcarLeidas(req.auth.id); res.json({ ok: true }); }
    catch (err) { next(err); }
  },
};