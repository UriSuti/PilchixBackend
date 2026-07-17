import { opinionRepository } from "../repositories/opinion.repository.js";

export const opinionService = {
  async listar(idProducto) {
    return opinionRepository.getPorProducto(idProducto);
  },

  async getEstado(idProducto, idUsuario) {
    const [comprado, yaOpino] = await Promise.all([
      opinionRepository.comprado(idProducto, idUsuario),
      opinionRepository.yaOpino(idProducto, idUsuario),
    ]);
    return { comprado, yaOpino };
  },

  async crear({ idProducto, idUsuario, texto, recomienda }) {
    const t = (texto ?? "").trim();
    if (t.length < 3) {
      const err = new Error("La opinión debe tener al menos 3 caracteres");
      err.status = 400;
      throw err;
    }

    const comprado = await opinionRepository.comprado(idProducto, idUsuario);
    if (!comprado) {
      const err = new Error("Solo pueden opinar quienes compraron este producto");
      err.status = 403;
      throw err;
    }

    const yaOpino = await opinionRepository.yaOpino(idProducto, idUsuario);
    if (yaOpino) {
      const err = new Error("Ya dejaste tu opinión sobre este producto");
      err.status = 409;
      throw err;
    }

    return opinionRepository.crear({
      id_producto: idProducto,
      id_usuario: idUsuario,
      texto: t,
      recomienda: Boolean(recomienda),
    });
  },

  async eliminar(idOpinion, idUsuario) {
    const borrado = await opinionRepository.eliminar(idOpinion, idUsuario);
    if (!borrado) {
      const err = new Error("No se pudo borrar la opinión");
      err.status = 404;
      throw err;
    }
  },
};
