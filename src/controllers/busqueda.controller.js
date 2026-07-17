import { busquedaRepository } from "../repositories/busqueda.repository.js";

export const busquedaController = {
  async guardar(req, res, next) {
    try {
      const texto = (req.body.texto ?? "").trim();
      if (!texto) return res.status(400).json({ error: "Falta el texto de búsqueda" });
      await busquedaRepository.guardar(req.auth.id, texto);
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  },
};
