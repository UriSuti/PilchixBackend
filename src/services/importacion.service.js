import { randomUUID } from "node:crypto";
import { productoRepository } from "../repositories/producto.repository.js";
import { categoriaRepository } from "../repositories/categoria.repository.js";
import { leerTienda, normalizarLinkTienda, MAX_PRODUCTOS } from "./importador/fuentes.js";
import { hexDeColores, hexDeColor, hexDeNombreProducto, sugerirCategorias } from "./importador/mapeo.js";
import { pedir, enParalelo } from "./importador/red.js";
import { normalizar } from "./stylist/catalogo.js";

// Carga masiva de productos desde la tienda online del local (Tiendanube, Shopify,
// WooCommerce o cualquier sitio con datos schema.org). Dos pasos:
//   1. leer la tienda → vista previa que el local revisa y corrige
//   2. confirmar → se crean los productos y se copian las imágenes a Storage
// Las importaciones viven en memoria (como mucho una activa por marca): si el
// servidor se reinicia a mitad de camino, el local tiene que volver a empezar.

// sin dato de stock (Tiendanube "sin límite", Shopify no lo publica): se carga este
// valor y en la vista previa se marca como estimado para que el local lo corrija
const STOCK_SIN_DATO = 10;
const PARALELO_CREACION = 3;
const MAX_BYTES_IMAGEN = 8 * 1024 * 1024;
const VIDA_MS = 2 * 60 * 60 * 1000;
const HEX = /^#[0-9a-f]{6}$/i;

const importaciones = new Map();

function error(mensaje, status = 400) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

function limpiarViejas() {
  const limite = Date.now() - VIDA_MS;
  for (const [id, imp] of importaciones) {
    if (imp.actualizado < limite && !["leyendo", "importando"].includes(imp.estado)) importaciones.delete(id);
  }
}

function tocar(imp, cambios) {
  Object.assign(imp, cambios, { actualizado: Date.now() });
}

function obtener(id, idMarca) {
  const imp = importaciones.get(id);
  if (!imp || imp.idMarca !== idMarca) throw error("Importación no encontrada", 404);
  return imp;
}

// lo que ve el front (sin datos internos)
function vista(imp) {
  return {
    id: imp.id,
    estado: imp.estado,
    link: imp.link,
    plataforma: imp.plataforma,
    progreso: imp.progreso,
    // la lista solo hace falta para revisar; mientras se guarda el front consulta seguido
    productos: imp.estado === "listo" ? imp.productos : [],
    noLeidos: imp.noLeidos,
    resultado: imp.resultado,
    error: imp.error,
    maxProductos: MAX_PRODUCTOS,
  };
}

// producto crudo de la tienda → fila de la vista previa con datos de Pilchix
function aVistaPrevia(crudo, indice, { categorias, nombresExistentes, vistosEnLote }) {
  const coloresVariantes = hexDeColores(crudo.colores);
  const colores = coloresVariantes.length ? coloresVariantes : hexDeNombreProducto(crudo.nombre);
  const clave = normalizar(crudo.nombre).trim();
  const advertencias = [];

  if (!crudo.precio) advertencias.push("sin precio");
  if (!colores.length) advertencias.push("sin color");
  if (!crudo.imagenes.length) advertencias.push("sin imágenes");
  if (crudo.stock === null) advertencias.push("stock estimado");

  const yaExiste = nombresExistentes.has(clave);
  const repetido = !yaExiste && vistosEnLote.has(clave);
  vistosEnLote.add(clave);

  return {
    indice,
    url: crudo.url,
    nombre: crudo.nombre.slice(0, 200),
    descripcion: crudo.descripcion || null,
    precio: crudo.precio ? Math.round(crudo.precio) : 0,
    stock: crudo.stock ?? STOCK_SIN_DATO,
    stockEstimado: crudo.stock === null,
    talles: crudo.talles,
    colores,
    imagenes: crudo.imagenes.map((img) => ({ url: img.url, color: img.color ? hexDeColor(img.color) : null })),
    categorias: sugerirCategorias(crudo, categorias),
    categoriasTienda: crudo.categoriasTienda,
    yaExiste,
    repetido,
    // los que ya están cargados o repetidos arrancan destildados
    seleccionado: !yaExiste && !repetido,
    advertencias,
  };
}

async function correrLectura(imp) {
  try {
    const [{ plataforma, productos, fallidos }, categorias, existentes] = await Promise.all([
      leerTienda(imp.link, (progreso) => tocar(imp, { progreso })),
      productoRepository.getCategorias(),
      productoRepository.getProductosDeMarca(imp.idMarca),
    ]);
    const contexto = {
      categorias,
      nombresExistentes: new Set(existentes.map((p) => normalizar(p.nombre).trim())),
      vistosEnLote: new Set(),
    };
    tocar(imp, {
      estado: "listo",
      plataforma,
      productos: productos.map((p, i) => aVistaPrevia(p, i, contexto)),
      noLeidos: fallidos,
    });
  } catch (err) {
    if (!err.status) console.error("Importación: error leyendo", imp.link, err);
    tocar(imp, { estado: "error", error: err.status ? err.message : "No se pudo leer la tienda. Probá de nuevo en un rato." });
  }
}

const EXTENSION_POR_TIPO = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

async function copiarImagen(url) {
  const r = await pedir(url, { maxBytes: MAX_BYTES_IMAGEN, accept: "image/*" });
  const tipo = r.tipo.split(";")[0].trim().toLowerCase();
  if (r.status !== 200 || !tipo.startsWith("image/")) throw new Error(`imagen no válida (${r.status})`);
  return productoRepository.subirImagen(r.cuerpo, `importada.${EXTENSION_POR_TIPO[tipo] ?? "jpg"}`, tipo);
}

async function crearUno(imp, item, categoriasValidas) {
  const idProducto = await productoRepository.crearProducto({
    id_marca: imp.idMarca,
    nombre: item.nombre,
    descripcion: item.descripcion,
    precio: item.precio,
    stock: item.stock,
    estado: true,
    guia_talles: item.talles,
    colores: item.colores,
  });

  const categorias = item.categorias.filter((id) => categoriasValidas.has(id));
  if (categorias.length) await productoRepository.setCategoriasProducto(idProducto, categorias);

  // imágenes en orden (la primera es la portada); una que falla no frena el producto
  const filas = [];
  let imagenesFallidas = 0;
  for (const img of item.imagenes) {
    try {
      filas.push({ imagen: await copiarImagen(img.url), color: img.color, es_portada: filas.length === 0 });
    } catch {
      imagenesFallidas++;
    }
  }
  if (filas.length) await productoRepository.insertarImagenes(idProducto, filas);
  return { idProducto, categorias, imagenesFallidas };
}

async function correrCreacion(imp, items) {
  const categoriasValidas = new Set((await productoRepository.getCategorias()).map((c) => c.id_categoria));
  const resultado = { creados: 0, errores: [], imagenesFallidas: 0 };
  const usadas = new Set();
  tocar(imp, { resultado, progreso: { hechos: 0, total: items.length } });

  await enParalelo(items, PARALELO_CREACION, async (item) => {
    try {
      const r = await crearUno(imp, item, categoriasValidas);
      resultado.creados++;
      resultado.imagenesFallidas += r.imagenesFallidas;
      r.categorias.forEach((id) => usadas.add(id));
    } catch (err) {
      console.error("Importación: no se pudo crear", item.nombre, err.message);
      resultado.errores.push({ nombre: item.nombre, motivo: "No se pudo guardar el producto" });
    } finally {
      tocar(imp, { progreso: { hechos: imp.progreso.hechos + 1, total: items.length } });
    }
  });

  // las categorías usadas quedan activas en el módulo de categorías de la marca
  for (const id of usadas) {
    await categoriaRepository.activarCategoria(imp.idMarca, id).catch((err) =>
      console.error("Importación: no se pudo activar la categoría", id, err.message)
    );
  }
  tocar(imp, { estado: "terminado", resultado });
}

// valida lo que manda el front contra lo que se leyó de la tienda: las imágenes
// solo pueden ser las encontradas ahí (el servidor no descarga URLs arbitrarias)
function validarItem(enviado, original) {
  const nombre = String(enviado.nombre ?? "").trim().slice(0, 200);
  if (!nombre) throw error(`Hay un producto sin nombre (fila ${original.indice + 1})`);

  const colores = (Array.isArray(enviado.colores) ? enviado.colores : original.colores).filter((c) => HEX.test(c));
  const permitidas = new Map(original.imagenes.map((img) => [img.url, img]));
  const imagenes = (Array.isArray(enviado.imagenes) ? enviado.imagenes : original.imagenes.map((i) => i.url))
    .map((u) => (typeof u === "string" ? u : u?.url))
    .filter((u) => permitidas.has(u))
    .map((u) => permitidas.get(u));
  const talles = (Array.isArray(enviado.talles) ? enviado.talles : original.talles)
    .map((t) => String(t ?? "").trim().slice(0, 20))
    .filter(Boolean);

  return {
    nombre,
    descripcion: enviado.descripcion === undefined ? original.descripcion : String(enviado.descripcion ?? "").trim() || null,
    precio: Math.max(0, Math.round(Number(enviado.precio ?? original.precio) || 0)),
    stock: Math.max(0, Math.round(Number(enviado.stock ?? original.stock) || 0)),
    talles: [...new Set(talles)],
    colores: [...new Set(colores)],
    imagenes,
    categorias: (Array.isArray(enviado.categorias) ? enviado.categorias : original.categorias).map(Number).filter(Number.isInteger),
  };
}

export const importacionService = {
  iniciar(idMarca, linkTexto) {
    limpiarViejas();
    const link = normalizarLinkTienda(linkTexto);
    if (!link) throw error("Pegá el link de tu tienda (por ejemplo https://mitienda.com.ar)");

    const activa = [...importaciones.values()].find(
      (i) => i.idMarca === idMarca && ["leyendo", "importando"].includes(i.estado)
    );
    if (activa) throw error("Ya tenés una importación en curso. Esperá a que termine.", 409);

    const imp = {
      id: randomUUID(),
      idMarca,
      link,
      estado: "leyendo",
      plataforma: null,
      progreso: { hechos: 0, total: null },
      productos: [],
      noLeidos: [],
      resultado: null,
      error: null,
      actualizado: Date.now(),
    };
    importaciones.set(imp.id, imp);
    correrLectura(imp); // en segundo plano: el front consulta el estado
    return vista(imp);
  },

  estado(id, idMarca) {
    return vista(obtener(id, idMarca));
  },

  // `elegidos`: [{ indice, ...campos editados }]. Lo que no venga se toma de la vista previa.
  confirmar(id, idMarca, elegidos) {
    const imp = obtener(id, idMarca);
    if (imp.estado !== "listo") throw error("Esta importación ya no se puede confirmar", 409);
    if (!Array.isArray(elegidos) || !elegidos.length) throw error("Elegí al menos un producto para importar");

    const vistos = new Set();
    const items = elegidos.map((enviado) => {
      const original = imp.productos[Number(enviado?.indice)];
      if (!original) throw error("Hay un producto que no pertenece a esta importación");
      if (vistos.has(original.indice)) throw error("Hay productos repetidos en la selección");
      vistos.add(original.indice);
      return validarItem(enviado, original);
    });

    tocar(imp, { estado: "importando" });
    correrCreacion(imp, items).catch((err) => {
      console.error("Importación: error creando productos", err);
      tocar(imp, { estado: "error", error: "Se cortó la importación. Revisá tu catálogo: puede que algunos productos ya se hayan cargado." });
    });
    return vista(imp);
  },

  cancelar(id, idMarca) {
    const imp = obtener(id, idMarca);
    if (imp.estado === "importando") throw error("La importación ya está guardando productos y no se puede cancelar", 409);
    importaciones.delete(id);
  },
};
