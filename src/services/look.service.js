import { lookRepository } from "../repositories/look.repository.js";

async function exigirPropietario(idLook, idMarca) {
  const ok = await lookRepository.esPropietario(idLook, idMarca);
  if (!ok) {
    const err = new Error("Ese look no pertenece a tu marca");
    err.status = 403;
    throw err;
  }
}

export const lookService = {
  getPublicos() {
    return lookRepository.getPublicos();
  },

  getDeMarca(idMarca) {
    return lookRepository.getDeMarca(idMarca);
  },

  async crear(idMarca, { titulo, productos }, { imagen, imagenHover } = {}) {
    if (!imagen) {
      const err = new Error("Falta la foto del look");
      err.status = 400;
      throw err;
    }
    const imagenUrl = await lookRepository.subirImagen(imagen.buffer, imagen.originalname, imagen.mimetype);
    // 2da foto opcional (para el efecto hover en la landing)
    const imagenHoverUrl = imagenHover
      ? await lookRepository.subirImagen(imagenHover.buffer, imagenHover.originalname, imagenHover.mimetype)
      : null;

    const look = await lookRepository.crear({
      id_marca: idMarca,
      titulo,
      imagen: imagenUrl,
      imagen_hover: imagenHoverUrl,
    });
    if (productos?.length) {
      await lookRepository.setProductos(look.id_look, productos);
    }
    return look;
  },

  async setProductos(idLook, idMarca, productos) {
    await exigirPropietario(idLook, idMarca);
    await lookRepository.setProductos(idLook, productos ?? []);
  },

  async borrar(idLook, idMarca) {
    await exigirPropietario(idLook, idMarca);
    await lookRepository.borrar(idLook);
  },
};
