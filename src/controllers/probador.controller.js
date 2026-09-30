import { probadorService } from "../services/probador.service.js";

export const probadorController = {
  async generar(req, res, next) {
    try {
      // sin archivo se usa la foto guardada en el perfil
      const resultado = await probadorService.generar(req.auth.id, req.params.idProducto, req.file, {
        guardarFoto: req.body?.guardarFoto === "true",
      });
      res.json(resultado);
    } catch (err) { next(err); }
  },

  async listar(req, res, next) {
    try {
      res.json(await probadorService.listarHistorial(req.auth.id));
    } catch (err) { next(err); }
  },

  async borrarPrueba(req, res, next) {
    try {
      await probadorService.borrarPrueba(req.auth.id, req.params.idPrueba);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async getFoto(req, res, next) {
    try {
      res.json({ foto: await probadorService.getFoto(req.auth.id) });
    } catch (err) { next(err); }
  },

  async subirFoto(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "Falta la foto" });
      res.json({ foto: await probadorService.guardarFoto(req.auth.id, req.file) });
    } catch (err) { next(err); }
  },

  async borrarFoto(req, res, next) {
    try {
      await probadorService.borrarFoto(req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
