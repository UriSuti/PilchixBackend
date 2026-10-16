import { stylistRepository } from "../repositories/stylist.repository.js";
import { obtenerCatalogo, panorama, normalizar, nombrarColor } from "./stylist/catalogo.js";
import { correrAgente, HERRAMIENTA_ENTREGAR_OUTFITS, HERRAMIENTA_ENTREGAR_CAMBIO } from "./stylist/agente.js";
import {
  armarContexto, candidatoParaAgente, reglasParaAgente, validarOutfits, repararOutfit, ordenarPorPrecio, pideBarato,
  explicarOutfit,
} from "./stylist/reglas.js";

// límite simple en memoria por usuario: cada consulta al estilista gasta cuota de la IA
const LIMITE_POR_HORA = 30;
const usosPorUsuario = new Map(); // idUsuario → [timestamps]

const OCASIONES = ["Uso diario", "Trabajo", "Salida / Noche", "Evento especial"];
const ESTILOS = ["Urbano", "Minimalista", "Deportivo", "Formal", "Casual", "Vintage"];
const HEX = /^#[0-9a-f]{6}$/i;
const MAX_COLORES = 12;
const CALCES = ["Holgada", "Regular", "Ajustada"];

const TIPOS_OUTFIT = ["economico", "tu_estilo", "original"];

function error(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

function texto(valor, max = 500) {
  return typeof valor === "string" ? valor.trim().slice(0, max) : "";
}

const formato = (n) => `$${Number(n).toLocaleString("es-AR")}`;

// se queda solo con valores conocidos: esto se guarda en la base y va al prompt
function limpiarPreferencias(p = {}) {
  const estilos = Array.isArray(p.estilos) ? p.estilos.filter((e) => ESTILOS.includes(e)) : [];
  const presupuesto = Number(p.presupuesto);
  // colores: lista de hex elegidos en la paleta (o con el "+")
  const colores = Array.isArray(p.colores)
    ? [...new Set(p.colores.filter((c) => typeof c === "string" && HEX.test(c)).map((c) => c.toLowerCase()))].slice(0, MAX_COLORES)
    : [];
  return {
    ocasion: OCASIONES.includes(p.ocasion) ? p.ocasion : null,
    estilos,
    presupuesto: Number.isFinite(presupuesto) && presupuesto > 0 ? Math.round(presupuesto) : null,
    colores,
    calce: CALCES.includes(p.calce) ? p.calce : null,
  };
}

function controlarLimite(idUsuario) {
  const haceUnaHora = Date.now() - 60 * 60 * 1000;
  const usos = (usosPorUsuario.get(idUsuario) ?? []).filter((t) => t > haceUnaHora);
  if (usos.length >= LIMITE_POR_HORA) {
    throw error("Le hiciste muchas consultas al estilista en la última hora. Probá de nuevo en un rato.", 429);
  }
  usos.push(Date.now());
  usosPorUsuario.set(idUsuario, usos);
}

/* ---------- prompt ---------- */

const SYSTEM_BASE = `Sos el AI Stylist de Pilchix, una vidriera digital de moda argentina que reúne varias marcas. Armás outfits usando únicamente prendas reales del catálogo.

Cómo trabajás:
- En cada pedido te pasamos REGLAS y CANDIDATOS por rol, ya filtrados por presupuesto y ordenados con los colores preferidos primero. Elegí de ahí; usá buscar_productos solo si necesitás algo que no esté en los candidatos.
- Las REGLAS son obligatorias: el sistema revisa cada entrega y te devuelve los errores si no las cumplís (presupuesto, roles, colores). Antes de entregar, sumá los precios de cada outfit y verificá que no pase el máximo.
- Solo podés usar ids que aparecen en los candidatos o en tus búsquedas. Nunca inventes prendas ni ids.
- Tené en cuenta TODO lo que pide el usuario en su texto (ocasión, colores, si quiere algo más barato, prendas que pide o que ya tiene). Si algo no se puede (por ejemplo, no hay ese tipo de prenda o ese color), decilo en "mensaje" con naturalidad.
- Escribís en español rioplatense, con voseo, en tono cercano y concreto. Las explicaciones son breves (2 o 3 oraciones): por qué funciona el conjunto (colores, siluetas, ocasión), sin repetir la lista de prendas ni los precios.`;

const INSTRUCCIONES_TRES_OUTFITS = `Armá exactamente tres outfits distintos, uno de cada tipo, y entregalos con entregar_outfits:
- "economico": el de menor total que igual quede bien y respete el pedido.
- "tu_estilo": el que mejor refleje el estilo, los colores y las preferencias del usuario.
- "original": una propuesta más arriesgada o distinta, sin dejar de ser usable para la ocasión.
Variá al menos una o dos prendas entre los tres.`;

function system(catalogo) {
  return `${SYSTEM_BASE}\n\nPanorama del catálogo hoy:\n${panorama(catalogo)}`;
}

function nombresDeColores(hexes) {
  return [...new Set(hexes.map((hex) => nombrarColor(hex)?.nombre).filter(Boolean))];
}

function describirPreferencias(pref) {
  const lineas = [];
  if (pref.ocasion) lineas.push(`Ocasión: ${pref.ocasion}`);
  if (pref.estilos.length) lineas.push(`Estilo preferido: ${pref.estilos.join(", ")}`);
  if (pref.presupuesto) lineas.push(`Presupuesto máximo por outfit: ${formato(pref.presupuesto)}`);
  if (pref.colores.length) lineas.push(`Colores preferidos: ${nombresDeColores(pref.colores).join(", ")}`);
  if (pref.calce) lineas.push(`Calce preferido: ${pref.calce}`);
  return lineas.length ? lineas.join("\n") : "Sin preferencias cargadas.";
}

function candidatosParaPrompt(ctx) {
  const porRol = {};
  for (const [rol, productos] of Object.entries(ctx.candidatos)) {
    if (productos.length) porRol[rol] = productos.map((p) => candidatoParaAgente(p, ctx));
  }
  return JSON.stringify(porRol);
}

/* ---------- armado de la respuesta ---------- */

// forma que devuelve la API al front para cada prenda
function aPrenda(p) {
  return {
    id_producto: p.id_producto,
    nombre: p.nombre,
    marca: p.marca,
    precio: p.precio,
    precio_original: p.precio_original,
    imagen: p.imagen,
    colores: p.colores.map((c) => c.hex),
    categorias: p.categorias,
    rol: p.rol,
  };
}

export const stylistService = {
  async getPreferencias(idUsuario) {
    return stylistRepository.getPreferencias(idUsuario);
  },

  async guardarPreferencias(idUsuario, preferencias) {
    const limpias = limpiarPreferencias(preferencias);
    await stylistRepository.setPreferencias(idUsuario, limpias);
    return limpias;
  },

  // pedido + preferencias → tres outfits (económico, tu estilo, original)
  async generarOutfits(idUsuario, { preferencias, pedido, prendasPropias }) {
    const pref = limpiarPreferencias(preferencias);
    const textoPedido = texto(pedido, 600);
    const propias = texto(prendasPropias, 400);
    if (!textoPedido && !pref.ocasion) {
      throw error("Contale al estilista qué estás buscando o elegí una ocasión.", 400);
    }

    controlarLimite(idUsuario);

    const catalogo = await obtenerCatalogo();
    if (catalogo.length === 0) throw error("Todavía no hay prendas disponibles para armar outfits.", 404);
    const porId = new Map(catalogo.map((p) => [p.id_producto, p]));
    const ctx = armarContexto({ catalogo, pref, pedido: textoPedido, prendasPropias: propias });
    if (ctx.obligatorios.length === 0) {
      throw error("Con el catálogo actual no podemos armar un outfit para ese pedido.", 422);
    }

    const contenido = [
      `Preferencias del usuario:\n${describirPreferencias(pref)}`,
      propias ? `Prendas que el usuario ya tiene: ${propias}` : null,
      `Pedido del usuario: ${textoPedido || `Un outfit para: ${pref.ocasion}`}`,
      `REGLAS:\n${reglasParaAgente(ctx)}`,
      `CANDIDATOS por rol (JSON):\n${candidatosParaPrompt(ctx)}`,
      INSTRUCCIONES_TRES_OUTFITS,
    ].filter(Boolean).join("\n\n");

    const { resultado, errores } = await correrAgente({
      catalogo,
      system: system(catalogo),
      contenido,
      herramientaFinal: HERRAMIENTA_ENTREGAR_OUTFITS,
      validar: (r) => validarOutfits(r, ctx, porId),
      vistosIniciales: Object.values(ctx.candidatos).flat().map((p) => p.id_producto),
    });
    if (errores.length) console.log("[stylist] el modelo no corrigió todo, se repara en el servidor:", errores.join(" | "));

    // las reglas se garantizan acá aunque el modelo haya fallado
    const outfitsIA = Array.isArray(resultado.outfits) ? resultado.outfits : [];
    const anteriores = [];
    // "tu_estilo" primero: es el que tiene más reglas (color); los otros dos se
    // ajustan después para no repetirlo
    const outfits = ["tu_estilo", "economico", "original"].map((tipo) => {
      const o = outfitsIA.find((x) => x?.tipo === tipo) ?? {};
      const ids = (Array.isArray(o.prendas) ? o.prendas : []).map((p) => p?.id_producto);
      const { prendas, ajustado } = repararOutfit(tipo, ids, ctx, porId, anteriores);
      anteriores.push(prendas);
      const total = prendas.reduce((acc, p) => acc + p.precio, 0);
      return { tipo, o, prendas, ajustado, total };
    }).filter((x) => x.prendas.length > 0);

    if (outfits.length === 0) {
      throw error("El estilista no encontró prendas para ese pedido. Probá con algo un poco más amplio.", 422);
    }

    // el orden (y el tipo final) se decide antes de escribir las explicaciones
    const finales = ordenarPorPrecio(outfits).map(({ tipo, o, prendas, ajustado, total }) => ({
      tipo,
      titulo: texto(o.titulo, 80) || "Tu look",
      // si el servidor cambió prendas, el texto del modelo puede hablar de otras:
      // se reemplaza por uno armado con las prendas reales
      explicacion: ajustado || !o.explicacion ? explicarOutfit(tipo, prendas, ctx) : texto(o.explicacion, 600),
      prendas: prendas.map(aPrenda),
      total,
      supera_presupuesto: Boolean(pref.presupuesto && total > pref.presupuesto),
    }));

    return { mensaje: texto(resultado.mensaje, 400), outfits: finales, avisos: ctx.avisos };
  },

  // cambiar una sola prenda conservando el resto del outfit
  async cambiarPrenda(idUsuario, { preferencias, outfit, idProducto, pedido }) {
    const pref = limpiarPreferencias(preferencias);
    const idsOutfit = (outfit?.prendas ?? []).map((p) => Number(p.id_producto)).filter(Number.isInteger);
    const idACambiar = Number(idProducto);
    if (!idsOutfit.includes(idACambiar)) throw error("Esa prenda no es parte del outfit.", 400);

    const catalogo = await obtenerCatalogo();
    const porId = new Map(catalogo.map((p) => [p.id_producto, p]));
    const actual = porId.get(idACambiar);
    if (!actual) throw error("Esa prenda ya no está disponible.", 404);

    const pedidoCambio = texto(pedido, 300);
    const ctx = armarContexto({ catalogo, pref, pedido: pedidoCambio });
    const resto = idsOutfit.filter((id) => id !== idACambiar).map((id) => porId.get(id)).filter(Boolean);
    const totalResto = resto.reduce((acc, p) => acc + p.precio, 0);

    // tope de precio de la prenda nueva: lo que queda del presupuesto y, si pide
    // algo más barato, menos de lo que cuesta la actual
    const barato = pideBarato(pedidoCambio);
    let precioMax = pref.presupuesto ? pref.presupuesto - totalResto : Infinity;
    if (barato) precioMax = Math.min(precioMax, actual.precio - 1);

    let candidatos = (ctx.porRol[actual.rol] ?? []).filter((p) => !idsOutfit.includes(p.id_producto) && p.precio <= precioMax);
    // "otro color": que no comparta colores con la prenda actual (si queda alguna)
    if (/otro color|otro tono|distinto color|cambi\w* (el )?color/.test(normalizar(pedidoCambio))) {
      const familiasActual = new Set(actual.colores.map((c) => c.familia));
      const distintos = candidatos.filter((p) => !p.colores.some((c) => familiasActual.has(c.familia)));
      if (distintos.length) candidatos = distintos;
    }
    candidatos.sort((a, b) => ctx.coincideColor(b) - ctx.coincideColor(a) || a.precio - b.precio);
    candidatos = candidatos.slice(0, 10);

    if (candidatos.length === 0) {
      const motivo = barato
        ? `No hay en el catálogo otra prenda de ${actual.rol} más barata que ${actual.nombre} (${formato(actual.precio)}).`
        : pref.presupuesto
          ? `No hay otra prenda de ${actual.rol} que entre en tu presupuesto de ${formato(pref.presupuesto)} junto con el resto del look.`
          : `No hay otra prenda de ${actual.rol} disponible en el catálogo.`;
      return { reemplazo: null, motivo };
    }

    controlarLimite(idUsuario);

    const ids = new Set(candidatos.map((p) => p.id_producto));
    const contenido = [
      `Preferencias del usuario:\n${describirPreferencias(pref)}`,
      `Outfit actual "${texto(outfit.titulo, 120)}". Se conservan: ${resto.map((p) => `${p.nombre} (${p.rol}, ${p.colores.map((c) => c.nombre).join("/")})`).join("; ") || "nada más"}.`,
      `Se reemplaza: ${actual.nombre} (${actual.rol}, ${actual.colores.map((c) => c.nombre).join("/")}, ${formato(actual.precio)}).`,
      `Pedido del usuario para el cambio: ${pedidoCambio || "Mostrame otra alternativa para esta prenda."}`,
      `CANDIDATOS (ya cumplen rol${Number.isFinite(precioMax) ? ` y precio máximo ${formato(precioMax)}` : ""}): ${JSON.stringify(candidatos.map((p) => candidatoParaAgente(p, ctx)))}`,
      `Elegí UNO de los candidatos (el que mejor combine con lo que se conserva y respete el pedido) y entregalo con entregar_cambio.`,
    ].join("\n");

    const { resultado, errores } = await correrAgente({
      catalogo,
      system: system(catalogo),
      contenido,
      herramientaFinal: HERRAMIENTA_ENTREGAR_CAMBIO,
      validar: (r) => (ids.has(Number(r?.id_producto)) ? [] : ["Tenés que elegir el id de uno de los CANDIDATOS."]),
      vistosIniciales: [...ids],
    });

    // si el modelo no eligió un candidato válido, va el primero (mejor color y precio)
    const elegido = errores.length ? candidatos[0] : porId.get(Number(resultado.id_producto));
    return {
      reemplazo: aPrenda(elegido),
      motivo: errores.length ? `Elegimos ${elegido.nombre}: es la mejor opción que respeta tu pedido.` : texto(resultado.motivo, 300),
      explicacion: errores.length ? "" : texto(resultado.explicacion, 600),
    };
  },
};
