import { favoritoRepository } from "../repositories/favorito.repository.js";

function esDuplicado(err) {
  return err?.code === "23505";
}

export const favoritoController = {
  async listar(req, res, next) {
    try {
      res.json(await favoritoRepository.getDeUsuario(req.auth.id));
    } catch (err) { next(err); }
  },

  async obtener(req, res, next) {
    try {
      const data = await favoritoRepository.get(req.auth.id, req.params.idProducto);
      res.json({ favorito: Boolean(data) });
    } catch (err) { next(err); }
  },

  async agregar(req, res, next) {
    try {
      await favoritoRepository.agregar(req.auth.id, req.params.idProducto);
      res.status(201).json({ ok: true });
    } catch (err) {
      if (esDuplicado(err)) return res.json({ ok: true });
      next(err);
    }
  },

  async quitar(req, res, next) {
    try {
      await favoritoRepository.quitar(req.auth.id, req.params.idProducto);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
