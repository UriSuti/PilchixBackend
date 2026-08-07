import { notificacionRepository } from "../repositories/notificacion.repository.js";

export const notificacionService = {
  // genera notificaciones para todos los suscriptores de una marca
  async notificarSuscriptores({ idMarca, idProducto, tipo }) {
    const suscriptores = await notificacionRepository.getSuscriptores(idMarca);
    const filas = suscriptores.map((id_usuario) => ({
      id_usuario,
      id_marca: idMarca,
      id_producto: idProducto,
      tipo,
    }));
    await notificacionRepository.crearEnLote(filas);  // ← lote
  },

  listar: (idUsuario) => notificacionRepository.getPorUsuario(idUsuario),
  contar: (idUsuario) => notificacionRepository.contarNoLeidas(idUsuario),
  marcarLeidas: (idUsuario) => notificacionRepository.marcarTodasLeidas(idUsuario),
};