import { marcaRepository } from "../repositories/marca.repository.js";

export const marcaController = {
  async getPerfil(req, res, next) {
    try {
      res.json(await marcaRepository.getPerfil(req.auth.id));
    } catch (err) { next(err); }
  },

  async actualizarPerfil(req, res, next) {
    try {
      const { descripcion, ubicacion, sitio_web, instagram, tiktok } = req.body;
      const campos = {};
      // solo tocamos lo que venga en el body
      if (descripcion !== undefined) campos.descripcion = descripcion?.trim() || null;
      if (ubicacion !== undefined) campos.ubicacion = ubicacion?.trim() || null;
      if (sitio_web !== undefined) campos.sitio_web = sitio_web?.trim() || null;
      if (instagram !== undefined) campos.instagram = instagram?.trim() || null;
      if (tiktok !== undefined) campos.tiktok = tiktok?.trim() || null;

      await marcaRepository.actualizarPerfil(req.auth.id, campos);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
