import { tiendanubeRepository, RUTA_PRODUCTO } from "../repositories/tiendanube.repository.js";
import { importacionRepository } from "../repositories/importacion.repository.js";
import { productoRepository } from "../repositories/producto.repository.js";
import { categoriaRepository } from "../repositories/categoria.repository.js";

const MAX_PRODUCTOS = 300;
const MAX_IMAGENES = 6;
const STOCK_SI_ILIMITADO = 100;
const DIAS_DESCUENTO = 30;

const error = (status, mensaje) => Object.assign(new Error(mensaje), { status });

/* ---------------- texto ---------------- */

const norm = (s = "") =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// "Remeras" ~ "remera", "Pantalones" ~ "pantalon"
function mismaPalabra(a, b) {
  const x = norm(a);
  const y = norm(b);
  return x === y || `${x}s` === y || `${x}es` === y || `${y}s` === x || `${y}es` === x;
}

const contienePalabra = (texto, palabra) =>
  new RegExp(`\\b${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`).test(texto);

/* ---------------- URL ---------------- */

function validarUrl(texto) {
  const crudo = String(texto ?? "").trim();
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(crudo) ? crudo : `https://${crudo}`);
  } catch {
    throw error(400, "El link no es válido");
  }
  url.protocol = "https:";
  const host = url.hostname.toLowerCase();
  // evita que el backend se use para pedir direcciones internas
  const interno =
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.includes(":") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (interno) throw error(400, "El link no es válido");
  return url;
}

// misma forma para comparar duplicados: https://host/productos/slug/
export function normalizarUrlProducto(texto) {
  const url = new URL(texto);
  const ruta = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return `https://${url.hostname.toLowerCase()}${ruta}`;
}

const slugDeUrl = (texto) => new URL(texto).pathname.replace(/\/+$/, "").split("/").pop().toLowerCase();

// las categorías vienen del front (las devolvió /listar): se limpian por las dudas
const limpiarPistas = (pistas) =>
  (Array.isArray(pistas) ? pistas : [])
    .filter((p) => typeof p === "string")
    .map((p) => p.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 5);

/* ---------------- categoría ---------------- */

// palabras que delatan cada categoría global (por su nombre normalizado)
const PALABRAS_CATEGORIA = {
  remeras: ["remera", "musculosa", "camiseta", "t-shirt", "tee", "top", "chomba", "polo"],
  buzos: ["buzo", "sweater", "sueter", "cardigan", "polar", "pullover"],
  hoodies: ["hoodie", "canguro"],
  camperas: ["campera", "chaqueta", "rompeviento", "parka", "puffer", "chaleco", "anorak"],
  camisas: ["camisa", "blusa", "overshirt"],
  pantalones: ["pantalon", "jogger", "cargo", "babucha", "calza", "chupin", "palazzo"],
  jeans: ["jean", "denim"],
  shorts: ["short", "bermuda", "malla"],
  calzado: ["zapatilla", "zapato", "bota", "borcego", "sandalia", "ojota", "mocasin", "sneaker"],
  accesorios: [
    "accesorio", "anillo", "cadena", "pulsera", "aro", "collar", "dije", "reloj", "gorra", "gorro",
    "cinturon", "billetera", "rinonera", "bolso", "mochila", "lente", "anteojo", "medias", "bufanda", "perfume",
  ],
};

// breadcrumb de Tiendanube pesa 2, nombre del producto pesa 1; empate o cero = duda
function adivinarCategoria(globales, nombre, categoriaTienda) {
  const textoNombre = norm(nombre);
  const textoCategoria = norm(categoriaTienda ?? "");
  const candidatas = [];

  for (const cat of globales) {
    const clave = norm(cat.nombre);
    const palabras = [clave.replace(/s$/, ""), ...(PALABRAS_CATEGORIA[clave] ?? [])];
    let puntos = 0;
    if (textoCategoria && palabras.some((p) => contienePalabra(textoCategoria, p))) puntos += 2;
    if (palabras.some((p) => contienePalabra(textoNombre, p))) puntos += 1;
    if (puntos) candidatas.push({ id_categoria: cat.id_categoria, nombre: cat.nombre, puntos });
  }

  candidatas.sort((a, b) => b.puntos - a.puntos);
  const [primera, segunda] = candidatas;
  const segura = primera && (!segunda || primera.puntos > segunda.puntos);
  return { categoria: segura ? primera : null, candidatas };
}

/* ---------------- talles y colores ---------------- */

const COLORES = {
  negro: "#111111", blanco: "#ffffff", gris: "#8e8e8e", "gris melange": "#a7a9ac", grafito: "#4a4a4a",
  plata: "#c0c0c0", plateado: "#c0c0c0", acero: "#a8adb3", dorado: "#d4af37", oro: "#d4af37",
  amarillo: "#f2c94c", mostaza: "#d4a017", naranja: "#ef6c00", coral: "#ff7f6b",
  rojo: "#c62828", bordo: "#6d1a2b", vino: "#6d1a2b", rosa: "#f4a7b9", fucsia: "#d81b8c",
  violeta: "#7e57c2", lila: "#b39ddb", azul: "#1f3a93", "azul marino": "#14213d", marino: "#14213d",
  celeste: "#7cc3ea", turquesa: "#30b5b0", verde: "#2e7d32", "verde militar": "#4b5320", oliva: "#708238",
  beige: "#d8c3a5", crema: "#f3e9d2", hueso: "#f0ead6", natural: "#efe6d6", nude: "#e3bc9a",
  camel: "#c19a6b", marron: "#6d4c41", chocolate: "#5d4037", habano: "#a0522d", suela: "#a0522d",
};

function colorHex(valor) {
  const v = norm(valor);
  if (COLORES[v]) return COLORES[v];
  const primera = v.split(/[\s/-]+/)[0];
  return COLORES[primera] ?? null;
}

// talles de letra o número, y también medidas ("4mm", "50ml") para accesorios
const REGEX_TALLE =
  /^(?:talle|talla|t\.?)?\s*(?:xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|\d{1,3}(?:[.,]\d)?|u|unico|unica|\d+(?:[.,]\d+)?\s*(?:mm|cm|ml|lts?|kg|grs?|oz))$/i;
const esTalle = (valor) => REGEX_TALLE.test(norm(valor));
const limpiarTalle = (valor) => {
  const t = String(valor).replace(/^(talle|talla)\s*/i, "").trim();
  return /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-5]xl|u)$/i.test(t) ? t.toUpperCase() : t.toLowerCase();
};

// cada columna de opciones se clasifica por sus valores, no por el nombre de la opción
function clasificarOpciones(opciones) {
  const talles = [];
  const colores = [];
  const avisos = [];

  for (const valores of opciones) {
    const mitad = Math.ceil(valores.length / 2);
    const hexes = valores.map(colorHex);
    if (hexes.filter(Boolean).length >= mitad) {
      hexes.forEach((h) => h && !colores.includes(h) && colores.push(h));
      const sinColor = valores.filter((_, i) => !hexes[i]);
      if (sinColor.length) avisos.push(`Colores sin reconocer: ${sinColor.join(", ")}`);
    } else if (valores.filter(esTalle).length >= mitad) {
      valores.filter(esTalle).map(limpiarTalle).forEach((t) => !talles.includes(t) && talles.push(t));
    } else {
      avisos.push(`Variantes no importadas: ${valores.slice(0, 4).join(", ")}${valores.length > 4 ? "…" : ""}`);
    }
  }
  return { talles, colores, avisos };
}

/* ---------------- servicio ---------------- */

export const tiendanubeService = {
  async listar(idMarca, link) {
    const url = validarUrl(link);
    const { esTiendanube, productos, categorias = {} } = await tiendanubeRepository.listarProductos(url.origin);
    if (!esTiendanube) throw error(422, "Ese link no parece una tienda de Tiendanube");
    if (!productos.length) throw error(404, "No encontramos productos en esa tienda");

    const yaImportados = await importacionRepository.origenesImportados(idMarca);
    const lista = [...new Set(productos.map(normalizarUrlProducto))]
      .slice(0, MAX_PRODUCTOS)
      .map((u) => ({
        url: u,
        yaImportado: yaImportados.has(u),
        // categorías de la tienda donde aparece el producto (la más específica primero)
        categorias: categorias[slugDeUrl(u)] ?? [],
      }));

    return { tienda: url.hostname, total: productos.length, productos: lista };
  },

  // importa UN producto. Si no puede decidir la categoría, devuelve estado "revisar" sin crear nada.
  async importarProducto(idMarca, link, idCategoriaElegida, pistasCategorias) {
    const url = validarUrl(link);
    if (!RUTA_PRODUCTO.test(url.pathname)) throw error(400, "Ese link no es de un producto");
    const origen = normalizarUrlProducto(url.toString());

    const existente = await importacionRepository.buscarPorOrigen(idMarca, origen);
    if (existente) return { estado: "duplicado", url: origen, id_producto: existente };

    const html = await tiendanubeRepository.obtenerPagina(origen);
    const datos = tiendanubeRepository.parsearProducto(html, origen);
    if (!datos.esTiendanube) throw error(422, "La página no es de una tienda Tiendanube");
    if (!datos.nombre) throw error(422, "No pudimos leer el nombre del producto");

    // si el breadcrumb no trajo la categoría, se usa la del recorrido de categorías de la tienda
    const pistas = limpiarPistas(pistasCategorias);
    datos.categoriaTienda = datos.categoriaTienda ?? pistas[0] ?? null;
    const textoCategorias = [...new Set([datos.categoriaTienda, ...pistas].filter(Boolean))].join(" ");

    // categoría: la que eligió el admin, o la adivinada
    const globales = await categoriaRepository.getGlobales();
    let categoria;
    if (idCategoriaElegida) {
      categoria = globales.find((c) => c.id_categoria === Number(idCategoriaElegida));
      if (!categoria) throw error(400, "Categoría inválida");
    } else {
      const { categoria: adivinada, candidatas } = adivinarCategoria(globales, datos.nombre, textoCategorias);
      if (!adivinada) {
        return {
          estado: "revisar",
          url: origen,
          producto: {
            nombre: datos.nombre,
            precio: datos.precio,
            imagen: datos.imagenes[0] ?? null,
            categoriaTienda: datos.categoriaTienda,
          },
          sugeridas: candidatas.slice(0, 3).map(({ id_categoria, nombre }) => ({ id_categoria, nombre })),
        };
      }
      categoria = adivinada;
    }

    // la categoría queda activada para la marca (no rompe si ya lo estaba)
    await categoriaRepository.activarCategoria(idMarca, categoria.id_categoria);

    const { talles, colores, avisos } = clasificarOpciones(datos.opciones);

    // precio: si en Tiendanube está en oferta, guardamos el precio de lista y el descuento aparte
    const precioFinal = Math.round(datos.precio ?? 0);
    const precioLista = datos.precioLista ? Math.round(datos.precioLista) : null;
    const enOferta = precioLista && precioLista > precioFinal && precioFinal > 0;
    if (!precioFinal) avisos.push("No se encontró el precio: quedó en $0");

    let stock = datos.stock ?? 0;
    if (datos.stockIlimitado) {
      stock = STOCK_SI_ILIMITADO;
      avisos.push(`Stock ilimitado en Tiendanube: se cargó ${STOCK_SI_ILIMITADO}`);
    }

    // se usa el repositorio directo (no catalogoService) para no mandar
    // una notificación a los suscriptores por cada producto importado
    const idProducto = await productoRepository.crearProducto({
      id_marca: idMarca,
      nombre: datos.nombre.slice(0, 200),
      descripcion: datos.descripcion,
      precio: enOferta ? precioLista : precioFinal,
      stock: Math.max(0, Math.round(stock)),
      estado: true,
      guia_talles: talles,
      colores,
      origen_url: origen,
    });

    await productoRepository.setCategoriasProducto(idProducto, [categoria.id_categoria]);

    // la categoría de Tiendanube ("Pulseras") pasa a ser subcategoría de la marca
    if (datos.categoriaTienda && !mismaPalabra(datos.categoriaTienda, categoria.nombre)) {
      try {
        const subs = await productoRepository.getSubcategorias(categoria.id_categoria, idMarca);
        let sub = subs.find((s) => mismaPalabra(s.nombre, datos.categoriaTienda));
        if (!sub) {
          sub = await productoRepository.crearSubcategoria(datos.categoriaTienda, categoria.id_categoria, idMarca);
        }
        await productoRepository.setSubcategoriasProducto(idProducto, [sub.id_subcategoria]);
      } catch (e) {
        avisos.push(`No se pudo asignar la subcategoría "${datos.categoriaTienda}"`);
      }
    }

    if (enOferta) {
      try {
        const hoy = new Date();
        const fin = new Date(hoy);
        fin.setDate(fin.getDate() + DIAS_DESCUENTO);
        await productoRepository.setDescuentoProducto(idProducto, {
          porcentaje: Math.round((1 - precioFinal / precioLista) * 100),
          precio_anterior: precioLista,
          precio_final: precioFinal,
          fecha_inicio: hoy.toISOString().split("T")[0],
          fecha_fin: fin.toISOString().split("T")[0],
        });
      } catch {
        avisos.push("No se pudo copiar la oferta");
      }
    }

    // imágenes: se bajan del CDN de Tiendanube y se suben a nuestro Storage
    const resultados = await Promise.allSettled(
      datos.imagenes.slice(0, MAX_IMAGENES).map(async (src) => {
        const img = await tiendanubeRepository.descargarImagen(src);
        return productoRepository.subirImagen(img.buffer, img.nombre, img.tipo);
      })
    );
    const subidas = resultados.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const fallidas = resultados.length - subidas.length;
    if (subidas.length) {
      await productoRepository.insertarImagenes(
        idProducto,
        subidas.map((imagen, i) => ({ imagen, color: "", es_portada: i === 0 }))
      );
    }
    if (!datos.imagenes.length) avisos.push("No se encontraron imágenes");
    if (fallidas) avisos.push(`${fallidas} imagen(es) no se pudieron copiar`);

    return {
      estado: "importado",
      url: origen,
      id_producto: idProducto,
      nombre: datos.nombre,
      categoria: categoria.nombre,
      imagenes: subidas.length,
      avisos,
    };
  },
};

// exportado para poder probarlo sin base de datos
export const _internos = { adivinarCategoria, clasificarOpciones, mismaPalabra };
