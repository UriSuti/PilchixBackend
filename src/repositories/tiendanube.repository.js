import { gunzipSync } from "node:zlib";

// Lectura de tiendas Tiendanube desde su storefront público (sitemap + páginas de producto).
// Solo lee lo que la tienda publica y respeta su robots.txt: no entra a /search/, /comprar/, etc.

const UA = "Mozilla/5.0 (compatible; PilchixImporter/1.0)";
const TIMEOUT_MS = 15000;
const MAX_HTML = 5 * 1024 * 1024;   // 5 MB
const MAX_IMAGEN = 8 * 1024 * 1024; // 8 MB
const MAX_PAGINAS_LISTADO = 30;

export const RUTA_PRODUCTO = /\/(?:productos|produtos)\/[^/?#]+\/?$/i;
const HOSTS_IMAGENES = [/\.mitiendanube\.com$/i, /\.nuvemshop\.com\.br$/i, /\.cloudfront\.net$/i];

/* ---------------- HTTP ---------------- */

async function pedirBuffer(url, maxBytes) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xml,image/*,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`La tienda respondió ${res.status} en ${url}`);
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("El archivo de la tienda es demasiado grande");
  return { buffer, tipo: res.headers.get("content-type") ?? "", urlFinal: res.url };
}

const pedirTexto = async (url) => (await pedirBuffer(url, MAX_HTML)).buffer.toString("utf8");

/* ---------------- utilidades de HTML ---------------- */

const ENTIDADES = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", Uuml: "Ü", iexcl: "¡", iquest: "¿",
  ordm: "º", ordf: "ª", deg: "°", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”",
  lsquo: "‘", rsquo: "’", hellip: "…", mdash: "—", ndash: "–", bull: "•", middot: "·",
  reg: "®", copy: "©", trade: "™", euro: "€", times: "×",
};

function decodificarUnaVez(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (todo, nombre) => ENTIDADES[nombre] ?? todo);
}

// dos pasadas como máximo: Tiendanube a veces escapa dos veces ("&amp;ntilde;")
function decodificar(s = "") {
  const una = decodificarUnaVez(String(s));
  return /&(#\d+|#x[0-9a-f]+|[a-z]+);/i.test(una) ? decodificarUnaVez(una) : una;
}

function sinTags(html = "") {
  const texto = String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodificar(texto)
    .replace(/<[^>]+>/g, "") // por si la descripción venía con HTML escapado
    .replace(/([a-záéíóúñ0-9][.!?])([A-ZÁÉÍÓÚÑ¿¡])/g, "$1 $2") // "eléctrico.Este" -> "eléctrico. Este"
    .split("\n")
    .map((linea) => linea.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escaparRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function meta(html, prop) {
  const p = escaparRegex(prop);
  const a = new RegExp(`<meta[^>]*(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, "i");
  const b = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, "i");
  const m = html.match(a) || html.match(b);
  return m ? decodificar(m[1]).trim() : null;
}

// Tiendanube deja saltos de línea crudos dentro de las descripciones (JSON inválido):
// si el parseo normal falla, se reemplazan los caracteres de control por espacios y se reintenta.
function parsearJsonTolerante(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    try {
      return JSON.parse(texto.replace(/[\u0000-\u001F]+/g, " "));
    } catch {
      return null;
    }
  }
}

function bloquesJsonLd(html) {
  const items = [];
  let fallidos = 0;
  for (const [, texto] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = parsearJsonTolerante(texto.trim());
    if (!data) { fallidos += 1; continue; }
    const lista = Array.isArray(data) ? data : data["@graph"] ?? [data];
    items.push(...lista);
  }
  return { items, fallidos };
}

const esTipo = (item, tipo) =>
  [].concat(item?.["@type"] ?? []).some((t) => String(t).toLowerCase() === tipo.toLowerCase());

const normTexto = (s = "") =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const slugDe = (url) => {
  try {
    return new URL(url, "https://x.invalid").pathname.replace(/\/+$/, "").split("/").pop()?.toLowerCase() ?? null;
  } catch {
    return null;
  }
};

function canonical(html) {
  const link = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return link ? decodificar(link[1]) : meta(html, "og:url");
}

// la página trae el JSON-LD del producto Y los de "productos similares":
// se elige el que coincide con la URL o el título de ESTA página, nunca "el primero"
function elegirProducto(items, slugPagina, tituloPagina) {
  const productos = items.filter((i) => esTipo(i, "Product") || esTipo(i, "ProductGroup"));
  const porUrl = productos.find((p) => slugPagina && slugDe(p.url ?? p["@id"] ?? "") === slugPagina);
  if (porUrl) return porUrl;
  const porNombre = productos.find((p) => tituloPagina && normTexto(textoValor(p.name)) === normTexto(tituloPagina));
  if (porNombre) return porNombre;
  return productos.length === 1 && !tituloPagina ? productos[0] : null;
}

// Contenido completo de un elemento, contando aperturas y cierres de su misma etiqueta
// (con un regex "hasta el primer </div>" se corta si adentro hay <div> anidados).
function contenidoDeElemento(html, regexApertura) {
  const apertura = html.match(regexApertura);
  if (!apertura) return null;
  const etiqueta = apertura[1].toLowerCase();
  const inicio = apertura.index + apertura[0].length;
  const marcas = new RegExp(`<(\\/?)${etiqueta}\\b[^>]*>`, "gi");
  marcas.lastIndex = inicio;
  let profundidad = 1;
  let marca;
  while ((marca = marcas.exec(html))) {
    profundidad += marca[1] ? -1 : 1;
    if (profundidad === 0) return html.slice(inicio, marca.index);
  }
  return html.slice(inicio, inicio + 20000);
}

function bloqueDescripcion(html) {
  return (
    contenidoDeElemento(html, /<([a-z0-9]+)[^>]*data-store=["']product-description[^"']*["'][^>]*>/i) ??
    contenidoDeElemento(html, /<([a-z0-9]+)[^>]*class=["'][^"']*product-description[^"']*["'][^>]*>/i)
  );
}

// Tiendanube autogenera "Comprá online X por $Y. Hacé tu pedido y pagalo online." cuando no hay descripción
const esDescripcionAutomatica = (texto) => /^compr[aá] online .+ por \$/i.test(String(texto ?? "").trim());

function numero(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // "14.990,00" o "14990.00"
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* ---------------- variantes (talles / colores / stock) ---------------- */

function leerVariantes(html) {
  const candidatos = [];
  const attr = html.match(/data-variants=(["'])([\s\S]*?)\1/i);
  if (attr) candidatos.push(decodificar(attr[2]));
  const ls = html.match(/LS\.variants\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (ls) candidatos.push(ls[1]);

  for (const texto of candidatos) {
    try {
      const data = JSON.parse(texto);
      if (Array.isArray(data) && data.length) return data;
    } catch {
      // probamos el siguiente candidato
    }
  }
  return [];
}

const textoValor = (x) => {
  if (x === null || x === undefined) return null;
  if (typeof x === "object") return String(Object.values(x)[0] ?? "").trim() || null;
  return String(x).trim() || null;
};

// columnas de opciones: [[valores opción 0], [valores opción 1], ...]
function opcionesDeVariantes(variantes) {
  const columnas = [[], [], []];
  for (const v of variantes) {
    const valores = Array.isArray(v.values) ? v.values : [v.option0, v.option1, v.option2];
    valores.slice(0, 3).forEach((x, i) => {
      const t = textoValor(x);
      if (t) columnas[i].push(t);
    });
  }
  return columnas.map((c) => [...new Set(c)]).filter((c) => c.length);
}

// respaldo: <select name="variation[0]"> con sus <option>
function opcionesDeSelects(html) {
  const columnas = [];
  for (const [, , cuerpo] of html.matchAll(/<select[^>]*name=["']variation\[(\d)\]["'][^>]*>([\s\S]*?)<\/select>/gi)) {
    const valores = [...cuerpo.matchAll(/<option[^>]*value=["']([^"']+)["']/gi)]
      .map((m) => decodificar(m[1]).trim())
      .filter(Boolean);
    if (valores.length) columnas.push([...new Set(valores)]);
  }
  return columnas;
}

/* ---------------- imágenes ---------------- */

function normalizarImagen(src) {
  if (!src || typeof src !== "string") return null;
  let url = decodificar(src.trim());
  if (url.startsWith("//")) url = `https:${url}`;
  url = url.replace(/^http:\/\//i, "https://"); // og:image a veces viene en http: evita duplicados
  if (!/^https:\/\//i.test(url) || !/\/products\//i.test(url)) return null;
  // pedimos siempre la versión grande: ...-480-0.webp -> ...-1024-1024.webp
  return url.replace(/-\d+-\d+\.(webp|jpe?g|png)(\?.*)?$/i, "-1024-1024.$1");
}

const REGEX_IMG_PRODUCTO = /(?:https?:)?\/\/[^"'\s,)]+\/products\/[^"'\s,)]+?\.(?:webp|jpe?g|png)/gi;

// Hasta dónde llega la galería del producto: corta en el primer link a OTRO producto
// (las tarjetas de "Productos similares") o en el título de esa sección, lo que aparezca antes.
function finDeGaleria(html, slugPagina) {
  const cuerpo = Math.max(html.search(/<body/i), 0);
  const primeraImagen = html.slice(cuerpo).search(REGEX_IMG_PRODUCTO);
  const desde = primeraImagen >= 0 ? cuerpo + primeraImagen : cuerpo;
  const cortes = [];

  const seccion = html.slice(desde).search(/productos similares|produtos similares|related-products|js-related|section-related/i);
  if (seccion >= 0) cortes.push(desde + seccion);

  const linkAOtro = /href=["'][^"']*\/(?:productos|produtos)\/([^"'/?#]+)\/?(?:[?#][^"']*)?["']/gi;
  linkAOtro.lastIndex = desde;
  let m;
  while ((m = linkAOtro.exec(html))) {
    if (m[1].toLowerCase() !== slugPagina) { cortes.push(m.index); break; }
  }
  return cortes.length ? Math.min(...cortes) : html.length;
}

function leerImagenes(html, producto, variantes, slugPagina) {
  const urls = [];
  const agregar = (src) => {
    const url = normalizarImagen(src);
    if (url && !urls.includes(url)) urls.push(url);
  };

  agregar(meta(html, "og:image:secure_url") ?? meta(html, "og:image"));
  for (const img of [].concat(producto?.image ?? [])) agregar(typeof img === "object" ? img?.url : img);
  for (const v of variantes) agregar(v.image_url);

  // galería: desde <body> hasta el primer producto ajeno, sin <script> (ahí están los JSON-LD de otros productos)
  const inicio = Math.max(html.search(/<body/i), 0);
  const zona = html
    .slice(inicio, finDeGaleria(html, slugPagina))
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  for (const [src] of zona.matchAll(REGEX_IMG_PRODUCTO)) agregar(src);
  return urls;
}

/* ---------------- breadcrumb (categoría en Tiendanube) ---------------- */

function textosDeLinks(fragmento) {
  return [...fragmento.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, attrs, inner]) => {
    const texto = sinTags(inner);
    if (texto) return texto;
    const titulo = attrs.match(/title=["']([^"']*)["']/i);
    return titulo ? decodificar(titulo[1]).trim() : null;
  });
}

function leerCategoriaTienda(html, items, producto, nombreProducto) {
  const ultimaValida = (nombres) =>
    nombres
      .filter(Boolean)
      .map((n) => n.trim())
      .filter((n) => !/^(inicio|home|productos|produtos|todos los productos)$/i.test(n))
      .filter((n) => normTexto(n) !== normTexto(nombreProducto))
      .at(-1) ?? null;

  // 1) BreadcrumbList en JSON-LD
  const migas = items.find((i) => esTipo(i, "BreadcrumbList"));
  if (migas?.itemListElement) {
    const desdeLd = ultimaValida(
      [].concat(migas.itemListElement)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((e) => textoValor(e.name ?? e.item?.name))
    );
    if (desdeLd) return desdeLd;
  }

  // 2) campo "category" del producto ("Accesorios > Pulseras")
  const categoriaLd = textoValor(producto?.category);
  if (categoriaLd) return categoriaLd.split(/\s*[>/|]\s*/).filter(Boolean).at(-1);

  // 3) contenedor del breadcrumb en el HTML (class="breadcrumbs", "breadcrumb-container", etc.)
  const contenedor = html.match(
    /<(div|nav|ol|ul|section|p)[^>]*class=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]{0,4000}?)<\/\1>/i
  );
  if (contenedor) {
    const desdeContenedor = ultimaValida(textosDeLinks(contenedor[2]));
    if (desdeContenedor) return desdeContenedor;
  }

  // 4) links sueltos con class "breadcrumb..."
  const sueltos = [...html.matchAll(/<a[^>]*class=["'][^"']*(?:breadcrumb|crumb)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)]
    .map((m) => m[0]);
  return ultimaValida(sueltos.flatMap(textosDeLinks));
}

/* ---------------- listados y categorías de la tienda ---------------- */

const MAX_CATEGORIAS = 25;
const MAX_PAGINAS_CATEGORIA = 20;
// primer tramo de URL que nunca es una categoría
const RUTAS_RESERVADAS = /^(productos|produtos|contacto|blog|account|comprar|comprar-express|checkout|search|buscar|envio|carrito|cart|discount|admin|page|ar|br|mx|co|cl)$/i;
// "categorías" que en realidad son promociones: no sirven para clasificar
const NOMBRES_PROMO = /^(ofertas?|sale|promo(ciones)?|novedades|nuevos?|lo nuevo|destacados?|liquidaci[oó]n|outlet|todos?|ver todo|ver todos los productos|inicio|home)$/i;

function productosEnListado(html, origen) {
  const urls = new Set();
  for (const [, href] of html.matchAll(/href=["']([^"']*\/(?:productos|produtos)\/[^"'/?#]+\/?)["']/gi)) {
    try {
      const url = new URL(decodificar(href), origen);
      if (RUTA_PRODUCTO.test(url.pathname)) urls.add(url.toString());
    } catch {
      // href roto: se ignora
    }
  }
  return urls;
}

// Recorre las páginas de categoría de la tienda (/aros/, /remeras/oversize/, ...) y devuelve
// { slugProducto: ["Categoría más específica", "otra categoría", ...] }.
async function mapearCategorias(origen) {
  const host = new URL(origen).hostname;
  const base =
    (await pedirTexto(`${origen}/productos/`).catch(() => null)) ??
    (await pedirTexto(`${origen}/`).catch(() => ""));

  // candidatas: links internos de 1 o 2 tramos (/aros/ o /remeras/oversize/) con texto corto
  const candidatas = new Map(); // ruta -> nombre
  for (const [, attrs, inner] of base.matchAll(/<a([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attrs.match(/href=["']([^"'#?]+)["']/i)?.[1];
    if (!href) continue;
    let url;
    try {
      url = new URL(decodificar(href), origen);
    } catch {
      continue;
    }
    if (url.hostname !== host) continue;
    const tramos = url.pathname.split("/").filter(Boolean);
    if (!tramos.length || tramos.length > 2 || RUTAS_RESERVADAS.test(tramos[0])) continue;
    const titulo = attrs.match(/title=["']([^"']*)["']/i)?.[1];
    const nombre = sinTags(inner) || (titulo ? decodificar(titulo).trim() : "");
    if (!nombre || nombre.length > 40 || NOMBRES_PROMO.test(nombre)) continue;
    const ruta = `/${tramos.join("/")}/`;
    if (!candidatas.has(ruta)) candidatas.set(ruta, nombre);
  }

  // una página es categoría si lista productos (las páginas institucionales no)
  const porProducto = {}; // slug -> [{ nombre, total }]
  for (const [ruta, nombre] of [...candidatas].slice(0, MAX_CATEGORIAS)) {
    const urls = new Set();
    for (let pagina = 1; pagina <= MAX_PAGINAS_CATEGORIA; pagina++) {
      const url = pagina === 1 ? `${origen}${ruta}` : `${origen}${ruta}page/${pagina}/`;
      let html;
      try {
        html = await pedirTexto(url);
      } catch {
        break;
      }
      const antes = urls.size;
      for (const u of productosEnListado(html, origen)) urls.add(u);
      if (urls.size === antes) break;
    }
    for (const u of urls) {
      const slug = slugDe(u);
      (porProducto[slug] ??= []).push({ nombre, total: urls.size });
    }
  }

  // la categoría con menos productos es la más específica ("Oversize" antes que "Remeras")
  return Object.fromEntries(
    Object.entries(porProducto).map(([slug, cats]) => [
      slug,
      [...new Map(cats.sort((a, b) => a.total - b.total).map((c) => [c.nombre, c])).keys()],
    ])
  );
}

/* ---------------- repositorio ---------------- */

export const tiendanubeRepository = {
  // devuelve las URLs de producto de la tienda
  async listarProductos(origen) {
    const robots = await pedirTexto(`${origen}/robots.txt`).catch(() => "");
    let esTiendanube = /tiendanube|nuvemshop/i.test(robots);
    if (!esTiendanube) {
      const home = await pedirTexto(`${origen}/`).catch(() => "");
      esTiendanube = /mitiendanube\.com|nuvemshop|tiendanube:/i.test(home);
    }
    if (!esTiendanube) return { esTiendanube: false, productos: [] };

    const urls = new Set();

    // 1) sitemap(s) declarados en robots.txt (Tiendanube los publica comprimidos en su CDN)
    const sitemaps = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)]
      .map((m) => m[1])
      .filter((u) => !/blog/i.test(u));
    if (!sitemaps.length) sitemaps.push(`${origen}/sitemap.xml`);

    for (const sitemap of sitemaps) {
      try {
        const { buffer } = await pedirBuffer(sitemap, MAX_HTML);
        const comprimido = buffer[0] === 0x1f && buffer[1] === 0x8b;
        const xml = (comprimido ? gunzipSync(buffer) : buffer).toString("utf8");
        for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
          const url = decodificar(loc);
          if (RUTA_PRODUCTO.test(new URL(url).pathname)) urls.add(url);
        }
      } catch {
        // si un sitemap falla seguimos con el resto o con el listado
      }
    }

    // 2) respaldo: recorrer /productos/page/N/
    if (!urls.size) {
      for (let pagina = 1; pagina <= MAX_PAGINAS_LISTADO; pagina++) {
        const ruta = pagina === 1 ? "/productos/" : `/productos/page/${pagina}/`;
        let html;
        try {
          html = await pedirTexto(`${origen}${ruta}`);
        } catch {
          break;
        }
        const antes = urls.size;
        for (const url of productosEnListado(html, origen)) urls.add(url);
        if (urls.size === antes) break; // no hubo productos nuevos: fin del listado
      }
    }

    // 3) categorías de la tienda: el breadcrumb no siempre las muestra
    const categorias = await mapearCategorias(origen).catch(() => ({}));

    return { esTiendanube: true, productos: [...urls], categorias };
  },

  obtenerPagina: (url) => pedirTexto(url),

  // extrae los datos del producto de su página (url = la de esta página, para no confundirlo con los similares)
  parsearProducto(html, url = null) {
    const { items } = bloquesJsonLd(html);
    const slugPagina = slugDe(url ?? canonical(html) ?? "");
    const titulo = meta(html, "og:title");
    const producto = elegirProducto(items, slugPagina, titulo);
    const variantes = leerVariantes(html);

    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
    const nombre = titulo || textoValor(producto?.name) || (h1 ? sinTags(h1) : null);

    // la más larga de las fuentes válidas: og:description viene recortada a ~160 caracteres
    const bloque = bloqueDescripcion(html);
    const descripcion =
      [
        producto?.description ? sinTags(producto.description) : null,
        bloque ? sinTags(bloque) : null,
        meta(html, "og:description") ? sinTags(meta(html, "og:description")) : null,
      ]
        .filter((d) => d && !esDescripcionAutomatica(d))
        .sort((a, b) => b.length - a.length)[0] ?? null;

    const ofertas = [].concat(producto?.offers ?? []);
    const preciosVariantes = variantes.map((v) => numero(v.price_number ?? v.price)).filter((n) => n !== null);
    const listaVariantes = variantes.map((v) => numero(v.compare_at_price_number ?? v.compare_at_price)).filter((n) => n);
    const precio =
      (preciosVariantes.length ? Math.min(...preciosVariantes) : null) ??
      numero(ofertas[0]?.price ?? ofertas[0]?.lowPrice) ??
      numero(meta(html, "tiendanube:price")) ??
      numero(meta(html, "product:price:amount"));
    const precioLista = listaVariantes.length ? Math.max(...listaVariantes) : null;

    // stock: null en una variante = ilimitado en Tiendanube
    let stock = null;
    let stockIlimitado = false;
    if (variantes.length) {
      if (variantes.some((v) => v.stock === null || v.stock === undefined)) stockIlimitado = true;
      else stock = variantes.reduce((acc, v) => acc + (numero(v.stock) ?? 0), 0);
    } else {
      stock = numero(meta(html, "tiendanube:stock"));
    }

    const opciones = variantes.length ? opcionesDeVariantes(variantes) : opcionesDeSelects(html);

    return {
      esTiendanube: /mitiendanube\.com|nuvemshop|tiendanube:|LS\.store/i.test(html),
      nombre,
      descripcion,
      precio,
      precioLista,
      stock,
      stockIlimitado,
      opciones,
      imagenes: leerImagenes(html, producto, variantes, slugPagina),
      categoriaTienda: leerCategoriaTienda(html, items, producto, nombre),
      cantidadVariantes: variantes.length,
    };
  },

  // para el script de prueba: qué encontró en la página y de dónde
  diagnosticar(html, url = null) {
    const { items, fallidos } = bloquesJsonLd(html);
    const slugPagina = slugDe(url ?? canonical(html) ?? "");
    const titulo = meta(html, "og:title");
    const elegido = elegirProducto(items, slugPagina, titulo);
    const iBread = html.search(/class=["'][^"']*breadcrumb/i);
    return {
      slugPagina,
      ogTitle: titulo,
      jsonLd: items.map((i) => `${[].concat(i["@type"]).join("/")}: ${textoValor(i.name) ?? "-"}`),
      jsonLdQueNoSePudieronLeer: fallidos,
      productoElegido: textoValor(elegido?.name) ?? "(ninguno: se usan meta tags)",
      tieneDataVariants: /data-variants=/i.test(html),
      tieneLSVariants: /LS\.variants\s*=/.test(html),
      htmlBreadcrumb: iBread >= 0 ? html.slice(iBread, iBread + 500).replace(/\s+/g, " ") : "(no encontrado)",
    };
  },

  async descargarImagen(url) {
    const host = new URL(url).hostname;
    if (!HOSTS_IMAGENES.some((re) => re.test(host))) throw new Error(`Imagen fuera del CDN de Tiendanube: ${host}`);
    const { buffer, tipo } = await pedirBuffer(url, MAX_IMAGEN);
    if (!tipo.startsWith("image/")) throw new Error("El archivo no es una imagen");
    const nombre = decodeURIComponent(new URL(url).pathname.split("/").pop() || "imagen.webp");
    return { buffer, tipo: tipo.split(";")[0], nombre };
  },
};
