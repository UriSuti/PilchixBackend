import { probadorRepository } from "../repositories/probador.repository.js";
import { productosPublicosRepository } from "../repositories/productos-publicos.repository.js";
import { fashnClient } from "../config/fashn.js";

const LIMITE_DIARIO = 20;

function dataUriABuffer(dataUri) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUri ?? "");
  if (!match) return null;
  return { mimetype: match[1], buffer: Buffer.from(match[2], "base64") };
}

export const probadorService = {
  async generar(idUsuario, idProducto, foto) {
    const usos = await probadorRepository.contarUsosUltimas24hs(idUsuario);
    if (usos >= LIMITE_DIARIO) {
      const err = new Error(
        `Llegaste al límite de ${LIMITE_DIARIO} pruebas virtuales por día. Volvé a intentarlo mañana.`
      );
      err.status = 429;
      throw err;
    }

    const producto = await productosPublicosRepository.getProductoPublicoPorId(idProducto);
    if (!producto) {
      const err = new Error("Producto no encontrado");
      err.status = 404;
      throw err;
    }

    const portada = producto.Imagen?.find((img) => img.es_portada) ?? producto.Imagen?.[0];
    if (!portada?.imagen) {
      const err = new Error("Este producto todavía no tiene una foto para probar");
      err.status = 422;
      throw err;
    }

    const modelImage = `data:${foto.mimetype};base64,${foto.buffer.toString("base64")}`;

    const jobId = await fashnClient.run({ productImage: portada.imagen, modelImage });
    const imagenResultado = await fashnClient.esperarResultado(jobId);
    if (!imagenResultado) {
      const err = new Error("FASHN no devolvió ninguna imagen");
      err.status = 502;
      throw err;
    }

    const parseada = dataUriABuffer(imagenResultado);
    if (!parseada) {
      const err = new Error("FASHN devolvió un formato de imagen inesperado");
      err.status = 502;
      throw err;
    }

    // se guarda solo el resultado (persona + prenda), no la foto original que
    // subió el usuario, para poder mostrar el historial en el perfil
    const urlResultado = await probadorRepository.subirResultado(
      parseada.buffer,
      parseada.mimetype,
      idUsuario
    );

    // el uso cuenta recién si la generación salió bien (no gastamos "intentos"
    // fallidos del límite diario)
    await probadorRepository.registrarUso(idUsuario, idProducto, urlResultado);

    return { imagen: urlResultado };
  },

  listarHistorial(idUsuario) {
    return probadorRepository.getHistorial(idUsuario);
  },
};
