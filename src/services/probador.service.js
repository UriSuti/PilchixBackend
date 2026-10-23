import { probadorRepository } from "../repositories/probador.repository.js";
import { productosPublicosRepository } from "../repositories/productos-publicos.repository.js";
import { usuarioRepository } from "../repositories/usuario.repository.js";
import { fashnClient } from "../config/fashn.js";
import { mailService } from "./mail.service.js";

const LIMITE_DIARIO = 20;

function dataUriABuffer(dataUri) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUri ?? "");
  if (!match) return null;
  return { mimetype: match[1], buffer: Buffer.from(match[2], "base64") };
}

// misma regla que la galería del front (getImagenesPorColor): las fotos del color
// elegido; si no hay, las generales (sin color); si no, todas. Dentro de ese grupo,
// la portada primero.
function elegirImagen(imagenes = [], color) {
  const normalizado = color?.toLowerCase();
  const delColor = normalizado ? imagenes.filter((img) => img.color?.toLowerCase() === normalizado) : [];
  const generales = imagenes.filter((img) => !img.color);
  const grupo = delColor.length ? delColor : generales.length ? generales : imagenes;
  return grupo.find((img) => img.es_portada) ?? grupo[0];
}

export const probadorService = {
  // foto: archivo subido ahora (opcional). Si no viene, se usa la foto guardada
  // en el perfil. guardarFoto: si es true, la foto subida queda guardada en el perfil.
  // color: hex del color elegido, para probar la foto de ese color y no la portada.
  async generar(idUsuario, idProducto, foto, { guardarFoto = false, color } = {}) {
    let modelImage;
    if (foto) {
      modelImage = `data:${foto.mimetype};base64,${foto.buffer.toString("base64")}`;
    } else {
      modelImage = await probadorRepository.getFotoProbador(idUsuario);
      if (!modelImage) {
        const err = new Error("Falta la foto");
        err.status = 400;
        throw err;
      }
    }

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

    const imagen = elegirImagen(producto.Imagen, color);
    if (!imagen?.imagen) {
      const err = new Error("Este producto todavía no tiene una foto para probar");
      err.status = 422;
      throw err;
    }

    const jobId = await fashnClient.run({ productImage: imagen.imagen, modelImage });
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

    // se guarda recién acá, así una generación fallida no cambia la foto del perfil
    const fotoGuardada = foto && guardarFoto ? await this.guardarFoto(idUsuario, foto) : undefined;

    // le mandamos la foto al mail registrado; si falla, la prueba igual se devuelve
    const usuario = await usuarioRepository.findById(idUsuario).catch(() => null);
    const mailEnviado = await mailService.enviarPruebaVirtual({
      email: usuario?.email,
      nombre: usuario?.nombre,
      producto,
      imagen: parseada.buffer,
      mimetype: parseada.mimetype,
    });

    return { imagen: urlResultado, fotoProbador: fotoGuardada, mailEnviado };
  },

  listarHistorial(idUsuario) {
    return probadorRepository.getHistorial(idUsuario);
  },

  async borrarPrueba(idUsuario, idPrueba) {
    const borrada = await probadorRepository.borrarPrueba(idUsuario, idPrueba);
    if (!borrada) {
      const err = new Error("Prueba no encontrada");
      err.status = 404;
      throw err;
    }
  },

  /* ---------- foto guardada del usuario ---------- */
  getFoto(idUsuario) {
    return probadorRepository.getFotoProbador(idUsuario);
  },

  // sube la foto nueva, la deja como la del perfil y borra la anterior
  async guardarFoto(idUsuario, foto) {
    const anterior = await probadorRepository.getFotoProbador(idUsuario);
    const url = await probadorRepository.subirFotoModelo(foto.buffer, foto.mimetype, idUsuario);
    await probadorRepository.setFotoProbador(idUsuario, url);
    if (anterior) await probadorRepository.borrarArchivo(anterior);
    return url;
  },

  async borrarFoto(idUsuario) {
    const anterior = await probadorRepository.getFotoProbador(idUsuario);
    await probadorRepository.setFotoProbador(idUsuario, null);
    if (anterior) await probadorRepository.borrarArchivo(anterior);
  },
};
