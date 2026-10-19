import { pedirJson, pedirTexto, enParalelo } from "./red.js";
import { decodificarEntidades, htmlATexto, tipoDeOpcion, limpiarTalles } from "./mapeo.js";

// Lectores de catálogos públicos. Cada uno devuelve "productos crudos" con la forma:
//   { url, nombre, descripcion, precio, stock (null = sin dato), talles: [], colores: [nombres],
//     imagenes: [{ url, color (nombre o null) }], categoriasTienda: [] }
// Orden de intento: Shopify (/products.json) → WooCommerce (Store API) → sitemap + página
// de cada producto (Tiendanube y cualquier sitio que publique datos schema.org).

export const MAX_PRODUCTOS = 500;
const MAX_IMAGENES = 6;
const PARALELO_PAGINAS = 6;

const numero = (v) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const absoluta = (url, base) => {
  if (!url) return null;
  try {
    return new URL(String(url).replace(/^\/\//, "https://"), base).href;
  } catch {
    return null;
  }
};

// misma imagen en distintos tamaños ("foto-480-0.webp" / "foto-1024-1024.webp") cuenta una vez
const claveImagen = (url) => url.split("?")[0].replace(/-\d+-\d+(\.\w+)$/, "$1");

function agregarImagenes(destino, nuevas) {
  const vistas = new Set(destino.map((i) => claveImagen(i.url)));
  for (const img of nuevas) {
    if (!img?.url || destino.length >= MAX_IMAGENES) continue;
    const clave = claveImagen(img.url);
    if (vistas.has(clave)) {
      // si ya estaba sin color y esta trae el color de su variante, se lo sumamos
      const existente = destino.find((i) => claveImagen(i.url) === clave);
      if (existente && !existente.color && img.color) existente.color = img.color;
      continue;
    }
    vistas.add(clave);
    destino.push({ url: img.url, color: img.color ?? null });
  }
  return destino;
}

// ---------- Shopify ----------

async function leerShopify(base, onProgreso) {
  const productos = [];
  for (let pagina = 1; productos.length < MAX_PRODUCTOS && pagina <= 20; pagina++) {
    const data = await pedirJson(`${base}/products.json?limit=250&page=${pagina}`, { maxBytes: 20 * 1024 * 1024 });
    if (!Array.isArray(data?.products)) return pagina === 1 ? null : productos;
    if (!data.products.length) break;

    for (const p of data.products) {
      const opciones = (p.options ?? []).map((o) => ({ ...o, tipo: tipoDeOpcion(o.name) }));
      const iColor = opciones.findIndex((o) => o.tipo === "color");
      let iTalle = opciones.findIndex((o) => o.tipo === "talle");
      if (iTalle === -1 && opciones.length === 1 && iColor === -1 && opciones[0].name !== "Title") iTalle = 0;

      const variantes = p.variants ?? [];
      const disponibles = variantes.filter((v) => v.available !== false);
      const colorDeVariante = Object.fromEntries(variantes.map((v) => [v.id, iColor >= 0 ? v[`option${iColor + 1}`] : null]));

      productos.push({
        url: `${base}/products/${p.handle}`,
        nombre: p.title,
        descripcion: htmlATexto(p.body_html),
        precio: numero(disponibles[0]?.price ?? variantes[0]?.price),
        stock: disponibles.length ? null : 0,
        talles: iTalle >= 0 ? limpiarTalles(opciones[iTalle].values) : [],
        colores: iColor >= 0 ? opciones[iColor].values : [],
        imagenes: agregarImagenes([], (p.images ?? []).map((img) => ({
          url: img.src,
          color: (img.variant_ids ?? []).map((id) => colorDeVariante[id]).find(Boolean) ?? null,
        }))),
        categoriasTienda: [p.product_type, ...(Array.isArray(p.tags) ? p.tags : String(p.tags ?? "").split(","))]
          .map((t) => String(t ?? "").trim()).filter(Boolean),
      });
    }
    onProgreso?.({ hechos: productos.length, total: null });
    if (data.products.length < 250) break;
  }
  return productos.slice(0, MAX_PRODUCTOS);
}

// ---------- WooCommerce ----------

async function leerWooCommerce(base, onProgreso) {
  const productos = [];
  for (let pagina = 1; productos.length < MAX_PRODUCTOS && pagina <= 20; pagina++) {
    const data = await pedirJson(`${base}/wp-json/wc/store/v1/products?per_page=100&page=${pagina}`, { maxBytes: 20 * 1024 * 1024 });
    if (!Array.isArray(data)) return pagina === 1 ? null : productos;
    if (!data.length) break;

    for (const p of data) {
      const decimales = Number(p.prices?.currency_minor_unit ?? 0);
      const precio = numero(p.prices?.price) ? numero(p.prices.price) / 10 ** decimales : null;
      const atributos = (p.attributes ?? []).map((a) => ({ tipo: tipoDeOpcion(a.name), valores: (a.terms ?? []).map((t) => decodificarEntidades(t.name)) }));

      productos.push({
        url: p.permalink,
        nombre: decodificarEntidades(p.name),
        descripcion: htmlATexto(p.description || p.short_description),
        precio,
        stock: p.is_in_stock === false ? 0 : null,
        talles: limpiarTalles(atributos.filter((a) => a.tipo === "talle").flatMap((a) => a.valores)),
        colores: atributos.filter((a) => a.tipo === "color").flatMap((a) => a.valores),
        imagenes: agregarImagenes([], (p.images ?? []).map((img) => ({ url: img.src }))),
        categoriasTienda: (p.categories ?? []).map((c) => decodificarEntidades(c.name)),
      });
    }
    onProgreso?.({ hechos: productos.length, total: null });
    if (data.length < 100) break;
  }
  return productos.slice(0, MAX_PRODUCTOS);
}

// ---------- sitemap + página de producto (Tiendanube y genérico) ----------

const ES_URL_PRODUCTO = /\/(productos?|products?|producto|item|p)\/[^/?#]+/i;

function bloquesUrl(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map(([, bloque]) => ({
    url: decodificarEntidades(/<loc>\s*([^<]+?)\s*<\/loc>/i.exec(bloque)?.[1] ?? ""),
    imagenes: [...bloque.matchAll(/<image:loc>\s*([^<]+?)\s*<\/image:loc>/gi)].map((m) => decodificarEntidades(m[1])),
  }));
}

// URLs de producto (con sus imágenes, si el sitemap las trae) del sitemap o índice de sitemaps
async function urlsDeProductos(base) {
  const candidatos = [`${base}/sitemap.xml`];
  const robots = await pedirTexto(`${base}/robots.txt`, { maxBytes: 512 * 1024 }).catch(() => null);
  if (robots?.status === 200) {
    for (const m of robots.texto.matchAll(/^sitemap:\s*(\S+)/gim)) candidatos.unshift(m[1]);
  }

  const vistos = new Set();
  const encontrados = new Map();
  const pendientes = [...new Set(candidatos)];
  while (pendientes.length && vistos.size < 15 && encontrados.size < MAX_PRODUCTOS) {
    const url = pendientes.shift();
    if (vistos.has(url)) continue;
    vistos.add(url);
    const r = await pedirTexto(url, { maxBytes: 30 * 1024 * 1024 }).catch(() => null);
    if (r?.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.texto)) continue;

    if (/<sitemapindex/i.test(r.texto)) {
      const hijos = [...r.texto.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decodificarEntidades(m[1]));
      // primero los que parecen de productos ("product-sitemap.xml", "sitemap_products_1.xml")
      pendientes.push(...hijos.filter((h) => /product/i.test(h)), ...hijos.filter((h) => !/product/i.test(h)));
      continue;
    }
    for (const b of bloquesUrl(r.texto)) {
      if (ES_URL_PRODUCTO.test(new URL(b.url, base).pathname) && !encontrados.has(b.url)) encontrados.set(b.url, b);
    }
  }
  return [...encontrados.values()].slice(0, MAX_PRODUCTOS);
}

function jsonLd(html) {
  const objetos = [];
  const juntar = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(juntar);
    objetos.push(o);
    if (o["@graph"]) juntar(o["@graph"]);
    if (o.mainEntity) juntar(o.mainEntity);
  };
  for (const [, contenido] of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      // algunos temas meten saltos de línea y tabs crudos dentro de los strings
      juntar(JSON.parse(contenido.trim().replace(/[\u0000-\u001f]+/g, " ")));
    } catch { /* bloque inválido: se ignora */ }
  }
  return objetos;
}

const esTipo = (o, tipo) => [].concat(o["@type"] ?? []).includes(tipo);
const sinBarra = (u) => String(u ?? "").split(/[?#]/)[0].replace(/\/+$/, "");

// en Tiendanube la página trae también los productos relacionados como Product:
// el principal es el que apunta a la URL de la página
function productoPrincipal(objetos, url) {
  const productos = objetos.filter((o) => esTipo(o, "Product"));
  const propia = sinBarra(url);
  return (
    productos.find((p) => [p["@id"], p.url, [].concat(p.offers ?? [])[0]?.url].some((u) => sinBarra(u) === propia)) ??
    objetos.find((o) => esTipo(o, "WebPage") && esTipo(o.mainEntity ?? {}, "Product"))?.mainEntity ??
    productos[0] ??
    null
  );
}

function migasDePan(objetos) {
  const lista = objetos.find((o) => esTipo(o, "BreadcrumbList")) ?? objetos.find((o) => o.breadcrumb)?.breadcrumb;
  const nombres = (lista?.itemListElement ?? [])
    .map((i) => decodificarEntidades(i.name ?? i.item?.name ?? ""))
    .filter(Boolean);
  return nombres.slice(1, -1); // sin "Inicio" ni el producto
}

const meta = (html, prop) =>
  decodificarEntidades(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)`, "i").exec(html)?.[1] ?? "") || null;

// bloque del producto principal en Tiendanube: variantes con stock por talle/color
function tiendanube(html) {
  const inicio = html.search(/id=["']single-product["']/);
  if (inicio === -1) return null;
  const siguiente = html.slice(inicio + 30).search(/js-product-container|js-quickshop-container/);
  const bloque = html.slice(inicio, siguiente === -1 ? undefined : inicio + 30 + siguiente);

  // data-variants es un atributo del mismo <div id="single-product">
  let variantes = [];
  const crudo = /^<[a-z]+[^>]*?data-variants=(["'])([\s\S]*?)\1/i.exec(html.slice(html.lastIndexOf("<", inicio)))?.[2];
  try {
    variantes = JSON.parse(decodificarEntidades(crudo ?? "[]"));
  } catch { /* sin variantes legibles */ }

  const etiquetas = {};
  for (const m of bloque.matchAll(/<label[^>]*for=["']variation_(\d)["'][^>]*>\s*([^<]*)/g)) {
    etiquetas[Number(m[1]) - 1] ??= decodificarEntidades(m[2]).trim();
  }
  const descripcionHtml = /<div[^>]*class=["'][^"']*user-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/.exec(bloque)?.[1];
  return { variantes, etiquetas, descripcion: descripcionHtml ? htmlATexto(descripcionHtml) : null };
}

async function leerPaginaProducto({ url, imagenes: imagenesSitemap }) {
  const r = await pedirTexto(url, { maxBytes: 6 * 1024 * 1024 });
  if (r.status !== 200) throw new Error(`la página respondió ${r.status}`);
  const html = r.texto;
  const objetos = jsonLd(html);
  const ld = productoPrincipal(objetos, url);
  const tn = tiendanube(html);

  const nombre = decodificarEntidades(ld?.name ?? meta(html, "og:title") ?? "").trim();
  if (!nombre) throw new Error("no se encontraron datos del producto");

  const ofertas = [].concat(ld?.offers ?? []).flatMap((o) => (esTipo(o, "AggregateOffer") ? [o, ...[].concat(o.offers ?? [])] : [o]));
  const precioLd = ofertas.map((o) => numero(o.price ?? o.lowPrice)).find(Boolean) ?? numero(meta(html, "product:price:amount"));
  const hayStock = ofertas.some((o) => !/OutOfStock|SoldOut|Discontinued/i.test(o.availability ?? ""));
  const stockLd = ofertas.map((o) => numero(o.inventoryLevel?.value)).find((n) => n !== null) ?? null;

  let talles = [];
  let colores = [];
  let stock = ofertas.length && !hayStock ? 0 : stockLd;
  const imagenes = agregarImagenes([], imagenesSitemap.map((u) => ({ url: absoluta(u, url) })));

  if (tn?.variantes.length) {
    const tipos = [0, 1, 2].map((i) => (tn.etiquetas[i] ? tipoDeOpcion(tn.etiquetas[i]) : null));
    // una sola opción sin etiqueta reconocible: casi siempre es el talle
    if (!tipos.includes("talle") && !tipos.includes("color") && tn.variantes.some((v) => v.option0) && !tn.variantes.some((v) => v.option1)) tipos[0] = "talle";
    const valores = (tipo) => tn.variantes.map((v) => v[`option${tipos.indexOf(tipo)}`]).filter(Boolean);
    if (tipos.includes("talle")) talles = limpiarTalles(valores("talle"));
    if (tipos.includes("color")) colores = [...new Set(valores("color"))];

    // stock null en Tiendanube = sin límite
    const conStock = tn.variantes.filter((v) => v.available !== false);
    stock = !conStock.length ? 0 : conStock.some((v) => v.stock == null) ? null : conStock.reduce((s, v) => s + (Number(v.stock) || 0), 0);

    const iColor = tipos.indexOf("color");
    agregarImagenes(imagenes, tn.variantes.map((v) => ({ url: absoluta(v.image_url, url), color: iColor >= 0 ? v[`option${iColor}`] : null })));
  }
  agregarImagenes(imagenes, [].concat(ld?.image ?? []).map((i) => ({ url: absoluta(typeof i === "string" ? i : i?.url, url) })));
  if (!imagenes.length) agregarImagenes(imagenes, [{ url: absoluta(meta(html, "og:image:secure_url") ?? meta(html, "og:image"), url) }]);

  // la del JSON-LD de Tiendanube viene recortada con "...": se prefiere la del cuerpo
  const descripcion = tn?.descripcion || htmlATexto(ld?.description ?? meta(html, "og:description") ?? "");

  return {
    url,
    nombre,
    descripcion,
    precio: tn?.variantes.find((v) => v.available !== false)?.price_number ?? tn?.variantes[0]?.price_number ?? precioLd,
    stock,
    talles,
    colores,
    imagenes,
    categoriasTienda: migasDePan(objetos),
  };
}

async function leerPorSitemap(base, onProgreso) {
  const urls = await urlsDeProductos(base);
  if (!urls.length) return null;

  const fallidos = [];
  let hechos = 0;
  onProgreso?.({ hechos, total: urls.length });
  const leidos = await enParalelo(urls, PARALELO_PAGINAS, async (u) => {
    try {
      return await leerPaginaProducto(u);
    } catch (err) {
      fallidos.push({ url: u.url, motivo: err.message });
      return null;
    } finally {
      onProgreso?.({ hechos: ++hechos, total: urls.length });
    }
  });
  const productos = leidos.filter(Boolean);
  if (!productos.length) return null;
  return Object.assign(productos, { fallidos });
}

// ---------- entrada ----------

export function normalizarLinkTienda(texto) {
  const limpio = String(texto ?? "").trim();
  if (!limpio || (/^[a-z][a-z0-9+.-]*:\/\//i.test(limpio) && !/^https?:\/\//i.test(limpio))) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Lee todos los productos de una tienda online a partir de su link.
 * Devuelve { plataforma, productos, fallidos } o tira error con .status.
 */
export async function leerTienda(base, onProgreso) {
  const portada = await pedirTexto(base, { maxBytes: 6 * 1024 * 1024 });
  if (portada.status >= 400) {
    const err = new Error(`La tienda respondió con error ${portada.status}. Revisá que el link sea correcto y que la tienda esté publicada.`);
    err.status = 400;
    throw err;
  }
  // la tienda puede redirigir a su dominio propio (x.mitiendanube.com → x.com.ar)
  const origen = new URL(portada.url).origin;
  const html = portada.texto;
  const esTiendanube = /mitiendanube\.com|nuvemshop|LS\.store/i.test(html);
  const esShopify = /cdn\.shopify\.com|Shopify\.shop/i.test(html);
  const esWoo = /woocommerce|wp-content/i.test(html);

  if (/\/password\/?$/.test(new URL(portada.url).pathname) || /<form[^>]+action=["'][^"']*\/password/i.test(html)) {
    const err = new Error("La tienda está protegida con contraseña. Publicala para poder importar los productos.");
    err.status = 400;
    throw err;
  }

  const intentos = [
    ...(esTiendanube ? [] : esShopify ? [["Shopify", leerShopify]] : esWoo ? [["WooCommerce", leerWooCommerce]] : [["Shopify", leerShopify], ["WooCommerce", leerWooCommerce]]),
    [esTiendanube ? "Tiendanube" : "Sitio web", leerPorSitemap],
  ];
  for (const [plataforma, leer] of intentos) {
    const productos = await leer(origen, onProgreso).catch((err) => {
      if (err.status && err.status !== 502) throw err;
      return null;
    });
    if (productos?.length) return { plataforma, productos, fallidos: productos.fallidos ?? [] };
  }

  const err = new Error(
    "No encontramos productos en ese link. Probá con la página principal de tu tienda (por ejemplo https://mitienda.com.ar)."
  );
  err.status = 422;
  throw err;
}
