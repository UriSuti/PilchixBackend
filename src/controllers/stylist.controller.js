import { stylistService } from "../services/stylist.service.js";

export const stylistController = {
  async getPreferencias(req, res, next) {
    try {
      res.json({ preferencias: await stylistService.getPreferencias(req.auth.id) });
    } catch (err) { next(err); }
  },

  async guardarPreferencias(req, res, next) {
    try {
      res.json({ preferencias: await stylistService.guardarPreferencias(req.auth.id, req.body) });
    } catch (err) { next(err); }
  },

  async generarOutfits(req, res, next) {
    try {
      res.json(await stylistService.generarOutfits(req.auth.id, req.body ?? {}));
    } catch (err) { next(err); }
  },

  async cambiarPrenda(req, res, next) {
    try {
      res.json(await stylistService.cambiarPrenda(req.auth.id, req.body ?? {}));
    } catch (err) { next(err); }
  },
};
