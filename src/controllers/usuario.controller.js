import { usuarioRepository } from "../repositories/usuario.repository.js";

export const usuarioController = {
  async actualizarPerfil(req, res, next) {
    try {
      const { nombre, email, foto_perfil } = req.body;
      const datos = {};
      if (nombre?.trim()) datos.nombre = nombre.trim();
      if (email?.trim()) datos.email = email.trim();
      if (foto_perfil) datos.foto_perfil = foto_perfil;

      if (Object.keys(datos).length === 0) {
        return res.status(400).json({ error: "No hay datos para actualizar" });
      }

      const usuario = await usuarioRepository.actualizar(req.auth.id, datos);
      res.json(usuario);
    } catch (err) { next(err); }
  },

  async subirFoto(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "No se envió ninguna imagen" });
      const url = await usuarioRepository.subirFoto(
        req.auth.id,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      const usuario = await usuarioRepository.actualizar(req.auth.id, { foto_perfil: url });
      res.json(usuario);
    } catch (err) { next(err); }
  },
};
