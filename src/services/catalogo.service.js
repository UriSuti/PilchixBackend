import { productoRepository } from "../repositories/producto.repository.js";
import { notificacionService } from "./notificacion.service.js";

function errorNoEncontrado(msg = "No encontrado") {
  const err = new Error(msg);
  err.status = 404;
  return err;
}

async function exigirPropietario(idProducto, idMarca) {
  const esPropietario = await productoRepository.esPropietario(idProducto, idMarca);
  if (!esPropietario) throw errorNoEncontrado("Producto no encontrado");
}

function fechaDesde(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split("T")[0];
}

export const catalogoService = {
  getCategorias: () => productoRepository.getCategorias(),

  getEtiquetas: (idMarca) => productoRepository.getEtiquetas(idMarca),

  async crearEtiqueta(nombre, idMarca) {
    return productoRepository.crearEtiqueta(nombre, idMarca);
  },

  getSubcategorias: (idCategoria, idMarca) => productoRepository.getSubcategorias(idCategoria, idMarca),

  async crearSubcategoria(nombre, idCategoria, idMarca) {
    return productoRepository.crearSubcategoria(nombre, idCategoria, idMarca);
  },

  getProductosDeMarca: (idMarca) => productoRepository.getProductosDeMarca(idMarca),

  getDashboardData: (idMarca, dias = 30) =>
    productoRepository.getDashboardData(idMarca, fechaDesde(dias)),

  getMetricasData: (idMarca, dias = 30) =>
    productoRepository.getMetricasData(idMarca, fechaDesde(dias)),

  async getProductoPorId(idProducto, idMarca) {
    const producto = await productoRepository.getProductoPorId(idProducto, idMarca);
    if (!producto) throw errorNoEncontrado("Producto no encontrado");
    return producto;
  },

  async crearProducto(idMarca, datos) {
    const idProducto = await productoRepository.crearProducto({ ...datos, id_marca: idMarca });

    try {
      await notificacionService.notificarSuscriptores({
        idMarca,
        idProducto,
        tipo: "nuevo_producto",
      });
    } catch (e) {
      console.error("No se pudieron generar notificaciones:", e.message);
    }

    return idProducto;
  },

  async actualizarProducto(idProducto, idMarca, datos) {
    const ok = await productoRepository.actualizarProducto(idProducto, idMarca, datos);
    if (!ok) throw errorNoEncontrado("Producto no encontrado");
  },

  async borrarProducto(idProducto, idMarca) {
    const ok = await productoRepository.borrarProducto(idProducto, idMarca);
    if (!ok) throw errorNoEncontrado("Producto no encontrado");
  },

  async setCategoriasProducto(idProducto, idMarca, idsCategorias) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.setCategoriasProducto(idProducto, idsCategorias);
  },

  async actualizarCategoriasProducto(idProducto, idMarca, idsCategorias) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.actualizarCategoriasProducto(idProducto, idsCategorias);
  },

  async setSubcategoriasProducto(idProducto, idMarca, idsSubcategorias) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.setSubcategoriasProducto(idProducto, idsSubcategorias);
  },

  async actualizarSubcategoriasProducto(idProducto, idMarca, idsSubcategorias) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.actualizarSubcategoriasProducto(idProducto, idsSubcategorias);
  },

  async setEtiquetasProducto(idProducto, idMarca, idsEtiquetas) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.setEtiquetasProducto(idProducto, idsEtiquetas);
  },

  async actualizarEtiquetasProducto(idProducto, idMarca, idsEtiquetas) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.actualizarEtiquetasProducto(idProducto, idsEtiquetas);
  },

  async subirImagenesProducto(idProducto, idMarca, files, metaPorArchivo) {
    await exigirPropietario(idProducto, idMarca);
    const filas = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const meta = metaPorArchivo[i] ?? {};
      const url = await productoRepository.subirImagen(file.buffer, file.originalname, file.mimetype);
      filas.push({ imagen: url, color: meta.color ?? "", es_portada: !!meta.esPortada });
    }
    return productoRepository.insertarImagenes(idProducto, filas);
  },

  async marcarPortada(idProducto, idImagen, idMarca) {
    await exigirPropietario(idProducto, idMarca);
    await productoRepository.marcarPortada(idProducto, idImagen);
  },

  async actualizarColorImagen(idImagen, idMarca, color) {
    const imagen = await productoRepository.getImagenConMarca(idImagen);
    if (!imagen || imagen.Producto?.id_marca !== idMarca) throw errorNoEncontrado("Imagen no encontrada");
    await productoRepository.actualizarColorImagen(idImagen, color);
  },

  async borrarImagen(idImagen, idMarca) {
    const imagen = await productoRepository.getImagenConMarca(idImagen);
    if (!imagen || imagen.Producto?.id_marca !== idMarca) throw errorNoEncontrado("Imagen no encontrada");
    await productoRepository.borrarImagen(idImagen, imagen.imagen);
  },
};