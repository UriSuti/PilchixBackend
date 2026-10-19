import { stylistRepository } from "../../repositories/stylist.repository.js";

// El agente no ve el catálogo entero: lo consulta con buscar_productos / ver_producto.
// Acá vive el índice que usan esas herramientas (en memoria, con un TTL corto para
// no ir a Supabase en cada búsqueda del mismo pedido).

const TTL_MS = 60_000;
let cache = { catalogo: null, hasta: 0 };

export const ROLES = ["parte de arriba", "parte de abajo", "calzado", "abrigo", "accesorio", "otro"];

const ROL_POR_CATEGORIA = {
  remeras: "parte de arriba",
  camisas: "parte de arriba",
  buzos: "parte de arriba",
  hoodies: "parte de arriba",
  pantalones: "parte de abajo",
  jeans: "parte de abajo",
  shorts: "parte de abajo",
  calzado: "calzado",
  camperas: "abrigo",
  bijouter: "accesorio",
};

// muchas prendas no tienen categoría cargada: se infiere por palabras del nombre
// (y, si no alcanza, de la descripción)
const ROL_POR_PALABRA = [
  ["calzado", ["zapatilla", "zapato", "sneaker", "bota", "botin", "ojota", "sandalia", "mocasin"]],
  ["abrigo", ["campera", "parka", "puffer", "chaqueta", "tapado", "saco", "rompeviento", "chaleco"]],
  ["parte de abajo", ["jean", "pantalon", "jogging", "jogger", "cargo", "short", "bermuda", "pollera", "falda", "baggy"]],
  ["parte de arriba", ["remera", "tee", "t-shirt", "camisa", "hoodie", "buzo", "sweater", "polo", "chomba", "musculosa", "top", "crop", "longsleeve", "waffle", "sueter", "cardigan"]],
  ["accesorio", ["anillo", "pulsera", "collar", "cadena", "aro", "gorra", "gorro", "cinturon", "billetera", "lentes", "bolso", "mochila", "rinonera", "medias"]],
];

// roles de prenda mencionados en un texto libre ("agregale zapatillas", "tengo una gorra")
export function rolesEnTexto(texto) {
  const t = normalizar(texto);
  return ROL_POR_PALABRA.filter(([, palabras]) => palabras.some((p) => new RegExp(`\\b${p}`).test(t))).map(([rol]) => rol);
}

// colores mencionados en un texto libre, como familias ("algo negro" → negro)
const FAMILIA_POR_PALABRA = [
  ["negro", ["negr"]],
  ["blanco", ["blanc"]],
  ["gris", ["gris"]],
  ["beige", ["beige", "crema", "arena", "hueso"]],
  ["marron", ["marron", "camel", "chocolate", "cafe"]],
  ["azul", ["azul", "celeste", "denim", "marino"]],
  ["verde", ["verde", "oliva", "militar"]],
  ["rojo", ["roj", "bordo"]],
  ["rosa", ["rosa"]],
  ["violeta", ["violet", "lila", "purpura"]],
  ["naranja", ["naranj"]],
  ["amarillo", ["amarill"]],
];

export function familiasEnTexto(texto) {
  const t = normalizar(texto);
  return FAMILIA_POR_PALABRA.filter(([, raices]) => raices.some((r) => new RegExp(`\\b${r}`).test(t))).map(([f]) => f);
}

// paleta de referencia para nombrar los hex (solo colores "con color": los
// grises, el negro y el blanco se resuelven aparte por luminosidad).
// "familia" agrupa matices para filtrar: pedir "azul" trae también azul marino y denim
export const NOMBRES_COLOR = [
  ["crema", "beige", [236, 228, 212]],
  ["beige", "beige", [212, 198, 178]],
  ["camel", "marron", [190, 150, 105]],
  ["marrón", "marron", [125, 85, 60]],
  ["azul marino", "azul", [22, 33, 60]],
  ["azul", "azul", [30, 70, 175]],
  ["denim", "azul", [96, 129, 164]],
  ["celeste", "azul", [140, 190, 230]],
  ["verde oliva", "verde", [85, 100, 60]],
  ["verde", "verde", [60, 140, 70]],
  ["verde claro", "verde", [140, 185, 80]],
  ["bordó", "rojo", [110, 25, 40]],
  ["rojo", "rojo", [200, 35, 35]],
  ["rosa", "rosa", [225, 165, 185]],
  ["violeta", "violeta", [140, 75, 170]],
  ["naranja", "naranja", [240, 120, 50]],
  ["amarillo", "amarillo", [235, 205, 60]],
];

export function normalizar(texto) {
  return (texto ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function hexARgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// distancia "redmean": aproxima la percepción mejor que la euclídea pura
function distancia([r1, g1, b1], [r2, g2, b2]) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function nombrarColor(hex) {
  const rgb = hexARgb(hex);
  if (!rgb) return null;
  const [r, , b] = rgb;
  const max = Math.max(...rgb), min = Math.min(...rgb);
  const croma = max - min;
  // neutros cálidos (crema, arena) tienen poca croma pero tiran a rojo/amarillo
  const calido = croma >= 12 && r - b >= 10;
  if (croma < 22 && !calido) {
    const luz = (max + min) / 2;
    if (luz < 45) return { nombre: "negro", familia: "negro" };
    if (luz < 110) return { nombre: "gris oscuro", familia: "gris" };
    if (luz < 170) return { nombre: "gris", familia: "gris" };
    if (luz < 225) return { nombre: "gris claro", familia: "gris" };
    return { nombre: "blanco", familia: "blanco" };
  }
  let mejor = null;
  for (const [nombre, familia, ref] of NOMBRES_COLOR) {
    const d = distancia(rgb, ref);
    if (!mejor || d < mejor.d) mejor = { nombre, familia, d };
  }
  return { nombre: mejor.nombre, familia: mejor.familia };
}

function inferirRol(nombre, descripcion, categorias) {
  for (const c of categorias) {
    const rol = ROL_POR_CATEGORIA[normalizar(c)];
    if (rol) return rol;
  }
  for (const texto of [normalizar(nombre), normalizar(descripcion)]) {
    for (const [rol, palabras] of ROL_POR_PALABRA) {
      if (palabras.some((p) => new RegExp(`\\b${p}`).test(texto))) return rol;
    }
  }
  return "otro";
}

function precioVigente(producto, ahora = new Date()) {
  const descuento = (producto.Descuento ?? []).find(
    (d) => new Date(d.fecha_inicio) <= ahora && ahora <= new Date(d.fecha_fin)
  );
  return descuento ? Number(descuento.precio_final) : Number(producto.precio);
}

// fila de Supabase → producto indexado (lo que usan las herramientas y el front)
export function indexar(p) {
  const categorias = (p.Producto_Categoria ?? []).map((pc) => pc.Categoria?.nombre).filter(Boolean);
  const etiquetas = (p.Producto_Etiqueta ?? []).map((pe) => pe.Etiqueta?.nombre).filter(Boolean);
  const colores = (p.colores ?? []).map((hex) => ({ hex, ...nombrarColor(hex) })).filter((c) => c.nombre);
  const precio = precioVigente(p);
  const portada = p.Imagen?.find((img) => img.es_portada) ?? p.Imagen?.[0];
  const marca = p.Marca?.nombre ?? null;
  const descripcion = (p.descripcion ?? "").replace(/\s+/g, " ").trim();
  const rol = inferirRol(p.nombre, descripcion, categorias);

  return {
    id_producto: p.id_producto,
    nombre: p.nombre,
    marca,
    descripcion,
    rol,
    categorias,
    etiquetas,
    colores,
    talles: p.guia_talles ?? [],
    precio,
    precio_original: precio < Number(p.precio) ? Number(p.precio) : null,
    imagen: portada?.imagen ?? null,
    stock: p.stock,
    // texto plano para la búsqueda libre
    _texto: normalizar([p.nombre, marca, descripcion, rol, ...categorias, ...etiquetas, ...colores.map((c) => c.nombre)].join(" ")),
  };
}

export async function obtenerCatalogo() {
  if (cache.catalogo && Date.now() < cache.hasta) return cache.catalogo;
  const filas = await stylistRepository.getCatalogo();
  const catalogo = filas.map(indexar);
  cache = { catalogo, hasta: Date.now() + TTL_MS };
  return catalogo;
}

/* ---------- lo que ve el agente ---------- */

export function resumenParaAgente(p, { conDescripcion = false } = {}) {
  return {
    id: p.id_producto,
    nombre: p.nombre,
    marca: p.marca,
    rol: p.rol,
    categorias: p.categorias,
    colores: p.colores.map((c) => c.nombre),
    precio: p.precio,
    ...(p.precio_original ? { precio_sin_descuento: p.precio_original } : {}),
    talles: p.talles,
    ...(p.etiquetas.length ? { etiquetas: p.etiquetas } : {}),
    descripcion: conDescripcion ? p.descripcion.slice(0, 400) : p.descripcion.slice(0, 120),
  };
}

// panorama del catálogo para el system prompt: qué roles hay, cuántos y a qué precio
export function panorama(catalogo) {
  const porRol = {};
  for (const p of catalogo) {
    const r = (porRol[p.rol] ??= { cantidad: 0, min: Infinity, max: 0 });
    r.cantidad++;
    r.min = Math.min(r.min, p.precio);
    r.max = Math.max(r.max, p.precio);
  }
  const lineas = ROLES.map((rol) => {
    const r = porRol[rol];
    return r
      ? `- ${rol}: ${r.cantidad} productos, de $${r.min} a $${r.max}`
      : `- ${rol}: no hay productos disponibles`;
  });
  const marcas = [...new Set(catalogo.map((p) => p.marca).filter(Boolean))];
  return `Total: ${catalogo.length} productos disponibles de ${marcas.length} marcas (${marcas.join(", ")}).\n${lineas.join("\n")}`;
}

const STOPWORDS = new Set(["para", "con", "que", "una", "unos", "unas", "los", "las", "del", "algo", "por", "sin", "mas", "muy", "como"]);

// raíz muy simple para que "blancas" encuentre "blanco" y "zapatillas" "zapatilla"
function raiz(palabra) {
  if (palabra.length <= 4) return palabra;
  return palabra.replace(/(es|s)$/, "").replace(/[aoe]$/, "");
}

// búsqueda con filtros estructurados + texto libre (puntaje por palabras que coinciden)
export function buscarProductos(catalogo, filtros = {}) {
  const { texto, roles, colores, precio_min, precio_max, talle, excluir_ids, limite } = filtros;
  const max = Math.min(Math.max(Number(limite) || 12, 1), 25);

  let resultado = catalogo;
  if (roles?.length) resultado = resultado.filter((p) => roles.includes(p.rol));
  if (colores?.length) {
    const buscados = colores.map(normalizar);
    resultado = resultado.filter((p) =>
      p.colores.some((c) => buscados.includes(normalizar(c.nombre)) || buscados.includes(normalizar(c.familia)))
    );
  }
  if (Number.isFinite(precio_min)) resultado = resultado.filter((p) => p.precio >= precio_min);
  if (Number.isFinite(precio_max)) resultado = resultado.filter((p) => p.precio <= precio_max);
  if (talle) resultado = resultado.filter((p) => p.talles.length === 0 || p.talles.some((t) => normalizar(t) === normalizar(talle)));
  if (excluir_ids?.length) resultado = resultado.filter((p) => !excluir_ids.includes(p.id_producto));

  let nota;
  const palabras = normalizar(texto)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map(raiz);
  if (palabras.length) {
    const puntuados = resultado
      .map((p) => ({ p, puntos: palabras.filter((w) => p._texto.includes(w)).length }))
      .filter((x) => x.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos || a.p.precio - b.p.precio);
    if (puntuados.length) {
      resultado = puntuados.map((x) => x.p);
    } else {
      nota = "Ningún producto coincide con el texto; se muestran los que cumplen el resto de los filtros.";
      resultado = [...resultado].sort((a, b) => a.precio - b.precio);
    }
  } else {
    resultado = [...resultado].sort((a, b) => a.precio - b.precio);
  }

  return {
    total_encontrados: resultado.length,
    productos: resultado.slice(0, max).map((p) => resumenParaAgente(p)),
    ...(nota ? { nota } : {}),
  };
}
