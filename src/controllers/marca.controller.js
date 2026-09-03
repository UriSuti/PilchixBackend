import { marcaRepository } from "../repositories/marca.repository.js";

export const marcaController = {
  async getPerfil(req, res, next) {
    try {
      res.json(await marcaRepository.getPerfil(req.auth.id));
    } catch (err) { next(err); }
  },

  async actualizarPerfil(req, res, next) {
    try {
      const { descripcion, ubicacion, sitio_web, instagram, tiktok, sonido_ambiente } = req.body;
      const campos = {};
      // solo tocamos lo que venga en el body
      if (descripcion !== undefined) campos.descripcion = descripcion?.trim() || null;
      if (ubicacion !== undefined) campos.ubicacion = ubicacion?.trim() || null;
      if (sitio_web !== undefined) campos.sitio_web = sitio_web?.trim() || null;
      if (instagram !== undefined) campos.instagram = instagram?.trim() || null;
      if (tiktok !== undefined) campos.tiktok = tiktok?.trim() || null;
      if (sonido_ambiente !== undefined) {
        // solo un id conocido del catálogo (o null/"ninguno"): nunca texto libre
        const PRESETS_VALIDOS = ["boutique", "urbano", "acustico", "energico", "minimal", "nocturno", "ninguno"];
        campos.sonido_ambiente = PRESETS_VALIDOS.includes(sonido_ambiente) ? sonido_ambiente : null;
      }

      await marcaRepository.actualizarPerfil(req.auth.id, campos);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async subirLogo(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "No se envió ninguna imagen" });
      const url = await marcaRepository.subirImagen(
        req.auth.id, req.file.buffer, req.file.originalname, req.file.mimetype, "logo"
      );
      await marcaRepository.actualizarPerfil(req.auth.id, { logo: url });
      res.json({ logo: url });
    } catch (err) { next(err); }
  },

  async subirFachada(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "No se envió ninguna imagen" });
      const url = await marcaRepository.subirImagen(
        req.auth.id, req.file.buffer, req.file.originalname, req.file.mimetype, "fachada"
      );
      await marcaRepository.actualizarPerfil(req.auth.id, { imagen_fachada: url });
      res.json({ imagen_fachada: url });
    } catch (err) { next(err); }
  },
};
