import { superadminService } from "../services/superadmin.service.js";

export const superadminController = {
  async getPendientes(req, res, next) {
    try { res.json(await superadminService.getPendientes()); }
    catch (err) { next(err); }
  },

  // multipart: comprobante (archivo), ids (JSON con los id_venta), nota (opcional)
  async liquidar(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "Falta el comprobante" });
      let ids;
      try { ids = JSON.parse(req.body.ids ?? "[]"); } catch { ids = []; }
      ids = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger))];
      if (!ids.length) return res.status(400).json({ error: "No se eligió ninguna venta" });

      const nota = req.body.nota?.trim() || null;
      const data = await superadminService.liquidar({ ids, archivo: req.file, nota, idAdmin: req.auth.id });
      res.status(201).json(data);
    } catch (err) { next(err); }
  },

  async getLiquidaciones(req, res, next) {
    try { res.json(await superadminService.getLiquidaciones()); }
    catch (err) { next(err); }
  },

  async getComprobante(req, res, next) {
    try { res.json(await superadminService.urlComprobante(Number(req.params.idLiquidacion))); }
    catch (err) { next(err); }
  },
};
