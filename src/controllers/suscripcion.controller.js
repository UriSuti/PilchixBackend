import { suscripcionRepository } from "../repositories/suscripcion.repository.js";

function esDuplicado(err) {
  return err?.code === "23505";
}

export const suscripcionController = {
  async listar(req, res, next) {
    try {
      res.json(await suscripcionRepository.getDeUsuario(req.auth.id));
    } catch (err) { next(err); }
  },

  async obtener(req, res, next) {
    try {
      const data = await suscripcionRepository.get(req.auth.id, req.params.idMarca);
      res.json({ suscripto: Boolean(data) });
    } catch (err) { next(err); }
  },

  async agregar(req, res, next) {
    try {
      await suscripcionRepository.agregar(req.auth.id, req.params.idMarca);
      res.status(201).json({ ok: true });
    } catch (err) {
      if (esDuplicado(err)) return res.json({ ok: true });
      next(err);
    }
  },

  async quitar(req, res, next) {
    try {
      await suscripcionRepository.quitar(req.auth.id, req.params.idMarca);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
