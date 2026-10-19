import { NOMBRES_COLOR, normalizar } from "../stylist/catalogo.js";

// Convierte lo que trae cada tienda (nombres de color, opciones de variantes,
// categorías propias) a los datos de Pilchix. Todo por reglas, sin IA.

// ---------- texto ----------

const ENTIDADES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", iexcl: "¡", iquest: "¿",
  ordm: "º", ordf: "ª", deg: "°", hellip: "…", ndash: "–", mdash: "—",
  laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", bull: "•",
};

export function decodificarEntidades(texto) {
  return (texto ?? "").replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entera, cod) => {
    if (cod[0] === "#") {
      const n = cod[1].toLowerCase() === "x" ? parseInt(cod.slice(2), 16) : Number(cod.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : entera;
    }
    return ENTIDADES[cod] ?? entera;
  });
}

// HTML de una descripción → texto plano conservando los saltos de párrafo
export function htmlATexto(html) {
  const texto = (html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return decodificarEntidades(texto)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
}

// ---------- colores ----------

const aHex = ([r, g, b]) => "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");

// nombre normalizado → hex. Los hex salen de la misma paleta que usa el estilista
// para nombrar colores, así un "Fucsia" importado el estilista lo reconoce como rosa.
const HEX_POR_COLOR = new Map([
  ...NOMBRES_COLOR.map(([nombre, , rgb]) => [normalizar(nombre), aHex(rgb)]),
  ["negro", "#111111"], ["blanco", "#ffffff"], ["gris", "#8c8c8c"],
  ["gris oscuro", "#4a4a4a"], ["gris claro", "#c8c8c8"],
]);

// sinónimos (en español e inglés) → nombre de la paleta
const SINONIMOS_COLOR = {
  black: "negro", white: "blanco", grey: "gris", gray: "gris", "gris melange": "gris", melange: "gris",
  topo: "gris oscuro", plomo: "gris oscuro", antracita: "gris oscuro", grafito: "gris oscuro", charcoal: "gris oscuro",
  perla: "gris claro", plata: "gris claro", plateado: "gris claro", silver: "gris claro",
  "off white": "crema", offwhite: "crema", natural: "crema", hueso: "crema", marfil: "crema", ivory: "crema", cream: "crema", vainilla: "crema",
  arena: "beige", nude: "beige", tostado: "beige", khaki: "beige", kaki: "beige", caqui: "beige", sand: "beige",
  suela: "camel", cognac: "camel", caramelo: "camel", tan: "camel",
  marron: "marrón", brown: "marrón", chocolate: "marrón", cafe: "marrón", habano: "marrón", tabaco: "marrón",
  marino: "azul marino", navy: "azul marino", "azul oscuro": "azul marino",
  blue: "azul", azulino: "azul", francia: "azul", royal: "azul", "azul francia": "azul",
  jean: "denim", "azul jean": "denim",
  "light blue": "celeste", "baby blue": "celeste", turquesa: "celeste", aqua: "celeste", aguamarina: "celeste",
  oliva: "verde oliva", olive: "verde oliva", militar: "verde oliva", "verde militar": "verde oliva", musgo: "verde oliva",
  green: "verde", "verde botella": "verde", esmeralda: "verde", benetton: "verde",
  "verde agua": "verde claro", "verde manzana": "verde claro", lima: "verde claro", menta: "verde claro", pistacho: "verde claro",
  bordo: "bordó", burdeos: "bordó", vino: "bordó", borravino: "bordó", burgundy: "bordó", granate: "bordó",
  red: "rojo", carmin: "rojo", punzo: "rojo",
  pink: "rosa", rosado: "rosa", fucsia: "rosa", fuxia: "rosa", magenta: "rosa", coral: "rosa", salmon: "rosa", "rosa viejo": "rosa", "rosa bebe": "rosa",
  purple: "violeta", lila: "violeta", lavanda: "violeta", morado: "violeta", uva: "violeta", berenjena: "violeta",
  orange: "naranja", terracota: "naranja", ladrillo: "naranja", oxido: "naranja", mostaza: "amarillo",
  yellow: "amarillo", oro: "amarillo", dorado: "amarillo", gold: "amarillo", manteca: "crema",
  // femeninos ("remera negra", "camisa blanca")
  negra: "negro", blanca: "blanco", roja: "rojo", amarilla: "amarillo", morada: "violeta", rosada: "rosa",
  dorada: "amarillo", plateada: "gris claro", tostada: "beige",
};

// "negras" → "negra", "azules" → "azul", "grises" → "gris"
const singular = (p) => (/(les|ses|res)$/.test(p) ? p.slice(0, -2) : p.replace(/s$/, ""));

const buscarColor = (frase) =>
  HEX_POR_COLOR.get(frase) ??
  HEX_POR_COLOR.get(normalizar(SINONIMOS_COLOR[frase] ?? "")) ??
  HEX_POR_COLOR.get(singular(frase)) ??
  HEX_POR_COLOR.get(normalizar(SINONIMOS_COLOR[singular(frase)] ?? ""));

// "Negro/Blanco", "Azul marino" o "Jean claro" → hex del primer color reconocido
export function hexDeColor(nombre) {
  const texto = normalizar(nombre).replace(/[^a-z\s/-]/g, " ").trim();
  if (!texto) return null;
  for (const parte of texto.split(/[/,-]| y /).map((p) => p.trim()).filter(Boolean)) {
    const directo = buscarColor(parte);
    if (directo) return directo;
    // la frase más larga conocida que aparezca adentro ("remera azul marino lisa" → azul marino)
    const palabras = parte.split(/\s+/);
    for (let largo = Math.min(3, palabras.length); largo >= 1; largo--) {
      for (let i = 0; i + largo <= palabras.length; i++) {
        const hex = buscarColor(palabras.slice(i, i + largo).join(" "));
        if (hex) return hex;
      }
    }
  }
  return null;
}

// colores mencionados en el nombre ("Remera negra y blanca") cuando la tienda no tiene
// variantes de color. Solo el nombre: la descripción suele listar todos los colores posibles.
const AMBIGUAS_EN_NOMBRE = new Set(["tan", "natural"]); // "tan cómoda", "algodón natural"

export function hexDeNombreProducto(nombre) {
  const palabras = normalizar(nombre).replace(/[^a-z\s]/g, " ").split(/\s+/).filter((p) => p && !AMBIGUAS_EN_NOMBRE.has(p));
  const hexes = [];
  for (let i = 0; i < palabras.length; i++) {
    // primero la frase de dos palabras ("azul marino") y si no, la palabra sola
    const doble = i + 1 < palabras.length ? buscarColor(`${palabras[i]} ${palabras[i + 1]}`) : null;
    const hex = doble ?? buscarColor(palabras[i]);
    if (doble) i++;
    if (hex && !hexes.includes(hex)) hexes.push(hex);
  }
  return hexes;
}

export function hexDeColores(nombres) {
  return [...new Set(nombres.map(hexDeColor).filter(Boolean))];
}

// ---------- variantes ----------

const ES_TALLE = /\b(talles?|tallas?|size|medidas?|numeros?|numeracion)\b/;
const ES_COLOR = /\b(colou?r(es)?|tonos?)\b/;

export const tipoDeOpcion = (nombre) => {
  const n = normalizar(nombre);
  if (ES_COLOR.test(n)) return "color";
  if (ES_TALLE.test(n)) return "talle";
  return null;
};

// talles únicos en el orden en que vienen; descarta los "Único"/"U" sin sentido para elegir
export function limpiarTalles(valores) {
  const vistos = new Set();
  const talles = [];
  for (const v of valores) {
    const t = String(v ?? "").trim();
    if (!t || vistos.has(t.toUpperCase())) continue;
    vistos.add(t.toUpperCase());
    talles.push(t);
  }
  return talles;
}

// ---------- categorías ----------

// palabras clave por categoría global. Si se agrega una categoría nueva en la base
// sin entrada acá, igual se reconoce por su propio nombre.
const PALABRAS_POR_CATEGORIA = {
  remeras: ["remera", "remeron", "t-shirt", "tshirt", "tee", "musculosa", "top", "crop", "polo", "chomba", "body"],
  buzos: ["buzo", "sweater", "sweatshirt", "sueter", "pullover", "cardigan", "polar", "tejido", "sweat"],
  hoodies: ["hoodie", "canguro", "capucha"],
  camisas: ["camisa", "shirt", "blusa", "camisola"],
  camperas: ["campera", "jacket", "chaqueta", "abrigo", "tapado", "parka", "puffer", "rompeviento", "chaleco", "saco", "blazer"],
  jeans: ["jean", "jeans", "denim"],
  pantalones: ["pantalon", "pants", "jogger", "babucha", "calza", "legging", "cargo", "palazzo", "chino"],
  shorts: ["short", "bermuda", "pollera short"],
  calzado: ["calzado", "zapatilla", "zapato", "sneaker", "bota", "borcego", "sandalia", "ojota", "mocasin", "shoes", "botineta", "alpargata"],
  bijouterie: ["bijou", "aro", "collar", "pulsera", "anillo", "cadenita", "dije", "tobillera", "accesorio"],
};

const contienePalabra = (texto, palabra) =>
  new RegExp(`(^|[^a-z])${palabra.replace(/[-]/g, "\\-")}(s|es)?([^a-z]|$)`).test(texto);

/**
 * Elige categorías globales para un producto mirando primero las categorías de la
 * tienda (más confiables) y si no, el nombre. Devuelve ids (a lo sumo 2).
 */
export function sugerirCategorias({ nombre, categoriasTienda = [] }, categoriasGlobales) {
  const reglas = categoriasGlobales.map((c) => {
    const clave = normalizar(c.nombre);
    const propia = Object.entries(PALABRAS_POR_CATEGORIA).find(([k]) => clave.startsWith(k.slice(0, 6)))?.[1] ?? [];
    return { id: c.id_categoria, palabras: [...new Set([clave.replace(/e?s$/, ""), ...propia])] };
  });
  const buscarEn = (texto) =>
    reglas.filter((r) => r.palabras.some((p) => contienePalabra(texto, p))).map((r) => r.id);

  const deTienda = buscarEn(normalizar(categoriasTienda.join(" | ")));
  const ids = deTienda.length ? deTienda : buscarEn(normalizar(nombre));
  return [...new Set(ids)].slice(0, 2);
}
