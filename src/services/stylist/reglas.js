import { nombrarColor, rolesEnTexto, familiasEnTexto, normalizar } from "./catalogo.js";

// Reglas duras del estilista. El modelo de IA elige y explica, pero lo que tiene
// que cumplirse (presupuesto, roles, colores) se calcula y se valida acá.

export const ROLES_BASE = ["parte de arriba", "parte de abajo"];
const ROLES_UNICOS = new Set(["parte de arriba", "parte de abajo", "calzado", "abrigo"]);
const MAX_CANDIDATOS_POR_ROL = 10;

const NOMBRE_FAMILIA = {
  negro: "negro", blanco: "blanco", gris: "gris", beige: "beige", marron: "marrón", azul: "azul",
  verde: "verde", rojo: "rojo", rosa: "rosa", violeta: "violeta", naranja: "naranja", amarillo: "amarillo",
};

const formato = (n) => `$${Number(n).toLocaleString("es-AR")}`;

const total = (prendas) => prendas.reduce((acc, p) => acc + p.precio, 0);

export function pideBarato(texto) {
  return /barat|economic|menos plata|accesible|ahorr/.test(normalizar(texto));
}

/**
 * Todo lo que se puede deducir del pedido sin IA.
 * pref: preferencias limpias (colores en hex). pedido / prendasPropias: texto libre.
 */
export function armarContexto({ catalogo, pref, pedido = "", prendasPropias = "" }) {
  const avisos = [];
  const porRol = {};
  for (const p of catalogo) (porRol[p.rol] ??= []).push(p);

  // colores: los de la paleta (hex → familia) + los que aparezcan escritos en el pedido
  const familias = new Set([
    ...pref.colores.map((hex) => nombrarColor(hex)?.familia).filter(Boolean),
    ...familiasEnTexto(pedido),
  ]);
  const coincideColor = (p) => familias.size > 0 && p.colores.some((c) => familias.has(c.familia));

  for (const f of familias) {
    if (!catalogo.some((p) => ROLES_UNICOS.has(p.rol) && p.colores.some((c) => c.familia === f))) {
      avisos.push(`Por ahora no hay prendas en ${NOMBRE_FAMILIA[f] ?? f} en el catálogo.`);
    }
  }

  // roles: base (arriba + abajo), más los que pida, menos los que ya tiene
  const propios = new Set(rolesEnTexto(prendasPropias));
  const pedidos = rolesEnTexto(pedido).filter((r) => !propios.has(r));
  const deseados = [...new Set([...ROLES_BASE, ...pedidos])].filter((r) => !propios.has(r));
  const obligatorios = [];
  for (const rol of deseados) {
    if (porRol[rol]?.length) obligatorios.push(rol);
    else avisos.push(`Por ahora no hay ${rol === "calzado" ? "calzado" : `prendas de ${rol}`} en el catálogo, así que no lo pudimos sumar.`);
  }

  // presupuesto: el máximo por outfit, salvo que ni la combinación más barata entre
  let limite = pref.presupuesto ?? null;
  const minimo = obligatorios.reduce((acc, rol) => acc + Math.min(...porRol[rol].map((p) => p.precio)), 0);
  if (limite && minimo > limite) {
    avisos.push(`Con el catálogo actual, el outfit más barato posible cuesta ${formato(minimo)}, un poco más que tu presupuesto de ${formato(limite)}.`);
    limite = minimo;
  }

  // ¿se puede cumplir el color dentro del presupuesto? (para exigirlo en "tu_estilo")
  const colorAlcanzable =
    familias.size > 0 &&
    obligatorios.some((rol) => {
      const resto = minimo - Math.min(...porRol[rol].map((p) => p.precio));
      return porRol[rol].some((p) => coincideColor(p) && (!limite || resto + p.precio <= limite));
    });

  // candidatos por rol: primero los del color preferido, después por precio
  const candidatos = {};
  for (const [rol, productos] of Object.entries(porRol)) {
    if (rol === "otro" || (propios.has(rol) && ROLES_UNICOS.has(rol))) continue;
    candidatos[rol] = [...productos]
      .filter((p) => !limite || p.precio <= limite)
      .sort((a, b) => coincideColor(b) - coincideColor(a) || a.precio - b.precio)
      .slice(0, MAX_CANDIDATOS_POR_ROL);
  }

  return {
    familias, coincideColor, obligatorios, propios, limite, minimo, colorAlcanzable,
    candidatos, avisos, barato: pideBarato(pedido), porRol,
  };
}

export function candidatoParaAgente(p, ctx) {
  return {
    id: p.id_producto,
    nombre: p.nombre,
    marca: p.marca,
    precio: p.precio,
    colores: p.colores.map((c) => c.nombre),
    ...(ctx.familias.size ? { color_preferido: ctx.coincideColor(p) } : {}),
    descripcion: p.descripcion.slice(0, 90),
  };
}

// reglas en texto, para el prompt
export function reglasParaAgente(ctx) {
  const lineas = [
    `- Cada outfit tiene que incluir: ${ctx.obligatorios.join(" + ")}. Accesorios y abrigo son opcionales. Nunca dos prendas del mismo rol (salvo accesorios).`,
  ];
  if (ctx.limite) {
    lineas.push(`- PRESUPUESTO OBLIGATORIO: cada outfit completo tiene que sumar como máximo ${formato(ctx.limite)}. Sumá los precios antes de entregar. El más barato posible suma ${formato(ctx.minimo)}.`);
  }
  lineas.push(`- "economico" tiene que ser el de menor total de los tres${ctx.barato ? "; además el usuario pidió algo más barato, así que priorizá precios bajos en los tres" : ""}.`);
  if (ctx.familias.size) {
    const nombres = [...ctx.familias].map((f) => NOMBRE_FAMILIA[f] ?? f).join(", ");
    lineas.push(`- COLORES PREFERIDOS: ${nombres}. Priorizá prendas con "color_preferido": true en los tres outfits${ctx.colorAlcanzable ? '; "tu_estilo" tiene que tener al menos una' : ""}.`);
  }
  if (ctx.propios.size) {
    lineas.push(`- El usuario ya tiene prendas de: ${[...ctx.propios].join(", ")}. No le vendas otra del mismo rol y mencioná cómo combina con lo suyo.`);
  }
  if (ctx.avisos.length) {
    lineas.push(`- Avisos que tenés que mencionar con naturalidad en "mensaje": ${ctx.avisos.join(" ")}`);
  }
  return lineas.join("\n");
}

function prendasDe(ids, porId) {
  const usados = new Set();
  const prendas = [];
  for (const id of ids) {
    const p = porId.get(Number(id));
    if (!p || usados.has(p.id_producto)) continue;
    usados.add(p.id_producto);
    prendas.push(p);
  }
  return prendas;
}

// errores de un outfit (en texto, para devolvérselos al modelo)
function erroresDeOutfit(tipo, prendas, ctx) {
  const errores = [];
  const roles = prendas.map((p) => p.rol);
  for (const rol of ctx.obligatorios) {
    if (!roles.includes(rol)) errores.push(`El outfit "${tipo}" no tiene ${rol}.`);
  }
  for (const rol of ROLES_UNICOS) {
    if (roles.filter((r) => r === rol).length > 1) errores.push(`El outfit "${tipo}" tiene dos prendas de ${rol}; dejá una sola.`);
  }
  for (const p of prendas) {
    if (ctx.propios.has(p.rol) && ROLES_UNICOS.has(p.rol)) errores.push(`El outfit "${tipo}" incluye ${p.nombre}, pero el usuario ya tiene ${p.rol}.`);
  }
  if (ctx.limite && total(prendas) > ctx.limite) {
    const cara = [...prendas].sort((a, b) => b.precio - a.precio)[0];
    errores.push(`El outfit "${tipo}" suma ${formato(total(prendas))} y supera el máximo de ${formato(ctx.limite)}. Cambiá ${cara.nombre} (${formato(cara.precio)}) por algo más barato del mismo rol.`);
  }
  if (tipo === "tu_estilo" && ctx.colorAlcanzable && !prendas.some(ctx.coincideColor)) {
    errores.push(`El outfit "tu_estilo" no tiene ninguna prenda en los colores preferidos; incluí al menos una con color_preferido: true.`);
  }
  return errores;
}

const TIPOS = ["economico", "tu_estilo", "original"];

/** Valida lo que entregó el modelo. Devuelve la lista de errores (vacía = OK). */
export function validarOutfits(resultado, ctx, porId) {
  const outfits = Array.isArray(resultado?.outfits) ? resultado.outfits : [];
  const errores = [];
  const totales = {};
  for (const tipo of TIPOS) {
    const o = outfits.find((x) => x?.tipo === tipo);
    if (!o) { errores.push(`Falta el outfit "${tipo}".`); continue; }
    const ids = (Array.isArray(o.prendas) ? o.prendas : []).map((p) => p?.id_producto);
    const inexistentes = ids.filter((id) => !porId.has(Number(id)));
    if (inexistentes.length) errores.push(`El outfit "${tipo}" usa ids que no existen: ${inexistentes.join(", ")}.`);
    const prendas = prendasDe(ids, porId);
    errores.push(...erroresDeOutfit(tipo, prendas, ctx));
    totales[tipo] = total(prendas);
  }
  if (totales.economico != null && Math.min(...Object.values(totales)) < totales.economico) {
    errores.push(`"economico" (${formato(totales.economico)}) tiene que ser el más barato de los tres.`);
  }
  // variedad: dos outfits con exactamente las mismas prendas no sirven
  const firmas = {};
  for (const tipo of TIPOS) {
    const o = outfits.find((x) => x?.tipo === tipo);
    if (!o) continue;
    const firma = firmaDe(prendasDe((o.prendas ?? []).map((p) => p?.id_producto), porId));
    if (firmas[firma]) errores.push(`Los outfits "${firmas[firma]}" y "${tipo}" tienen las mismas prendas; cambiá al menos una.`);
    else firmas[firma] = tipo;
  }
  return errores;
}

const firmaDe = (prendas) => prendas.map((p) => p.id_producto).sort((a, b) => a - b).join(",");

// mejor alternativa para un rol: color preferido primero, después la más barata
function mejorCandidato(rol, ctx, excluir, precioMax = Infinity) {
  return (ctx.porRol[rol] ?? [])
    .filter((p) => !excluir.has(p.id_producto) && p.precio <= precioMax)
    .sort((a, b) => ctx.coincideColor(b) - ctx.coincideColor(a) || a.precio - b.precio)[0];
}

/**
 * Arregla un outfit para que cumpla las reglas cambiando la menor cantidad de prendas.
 * `anteriores`: outfits ya armados (listas de prendas), para no repetir uno igual.
 * Devuelve { prendas, ajustado }.
 */
export function repararOutfit(tipo, ids, ctx, porId, anteriores = []) {
  let prendas = prendasDe(ids, porId);
  const antes = prendas.map((p) => p.id_producto).join(",");

  // 1) roles repetidos o que el usuario ya tiene
  const vistos = new Set();
  prendas = prendas.filter((p) => {
    if (ROLES_UNICOS.has(p.rol) && (vistos.has(p.rol) || ctx.propios.has(p.rol))) return false;
    vistos.add(p.rol);
    return true;
  });

  // 2) roles obligatorios que faltan
  for (const rol of ctx.obligatorios) {
    if (prendas.some((p) => p.rol === rol)) continue;
    const usados = new Set(prendas.map((p) => p.id_producto));
    const nuevo = mejorCandidato(rol, ctx, usados);
    if (nuevo) prendas.push(nuevo);
  }

  // 3) presupuesto: primero se sacan los opcionales más caros, después se abaratan los obligatorios
  while (ctx.limite && total(prendas) > ctx.limite) {
    const opcionales = prendas.filter((p) => !ctx.obligatorios.includes(p.rol)).sort((a, b) => b.precio - a.precio);
    if (opcionales.length) {
      prendas = prendas.filter((p) => p !== opcionales[0]);
      continue;
    }
    let mejorCambio = null;
    for (const p of prendas) {
      const usados = new Set(prendas.map((x) => x.id_producto));
      const margen = ctx.limite - (total(prendas) - p.precio);
      // alternativa que entre en el presupuesto; si no hay, la más barata del rol
      const alt =
        mejorCandidato(p.rol, ctx, usados, Math.min(margen, p.precio - 1)) ??
        (ctx.porRol[p.rol] ?? []).filter((x) => !usados.has(x.id_producto) && x.precio < p.precio).sort((a, b) => a.precio - b.precio)[0];
      if (alt && (!mejorCambio || p.precio - alt.precio > mejorCambio.ahorro)) {
        mejorCambio = { sale: p, entra: alt, ahorro: p.precio - alt.precio };
      }
    }
    if (!mejorCambio) break;
    prendas = prendas.map((p) => (p === mejorCambio.sale ? mejorCambio.entra : p));
  }

  // 4) color en "tu_estilo": cambiar una prenda por otra del mismo rol con el color preferido
  if (tipo === "tu_estilo" && ctx.colorAlcanzable && !prendas.some(ctx.coincideColor)) {
    for (const p of prendas) {
      const usados = new Set(prendas.map((x) => x.id_producto));
      const margen = ctx.limite ? ctx.limite - (total(prendas) - p.precio) : Infinity;
      const alt = (ctx.porRol[p.rol] ?? [])
        .filter((x) => !usados.has(x.id_producto) && ctx.coincideColor(x) && x.precio <= margen)
        .sort((a, b) => a.precio - b.precio)[0];
      if (alt) {
        prendas = prendas.map((x) => (x === p ? alt : x));
        break;
      }
    }
  }

  // 5) variedad: si quedó igual a otro outfit, se cambia una prenda por otra del
  // mismo rol que todavía no se haya usado y que mantenga las reglas
  const firmasPrevias = new Set(anteriores.map(firmaDe));
  if (firmasPrevias.has(firmaDe(prendas))) {
    const usadasAntes = new Set(anteriores.flat().map((p) => p.id_producto));
    let mejor = null;
    for (const p of prendas) {
      const usados = new Set(prendas.map((x) => x.id_producto));
      const margen = ctx.limite ? ctx.limite - (total(prendas) - p.precio) : Infinity;
      const alts = (ctx.porRol[p.rol] ?? []).filter((x) => !usados.has(x.id_producto) && x.precio <= margen);
      for (const alt of alts) {
        const nuevas = prendas.map((x) => (x === p ? alt : x));
        if (firmasPrevias.has(firmaDe(nuevas))) continue;
        // no romper el color en "tu_estilo"
        if (tipo === "tu_estilo" && ctx.colorAlcanzable && !nuevas.some(ctx.coincideColor)) continue;
        // preferir prendas no usadas en otros outfits, con color preferido y más baratas
        const puntaje = (usadasAntes.has(alt.id_producto) ? 0 : 4) + (ctx.coincideColor(alt) ? 2 : 0) - alt.precio / 1e9;
        if (!mejor || puntaje > mejor.puntaje) mejor = { puntaje, nuevas };
      }
    }
    if (mejor) prendas = mejor.nuevas;
  }

  return { prendas, ajustado: prendas.map((p) => p.id_producto).join(",") !== antes };
}

// "economico" tiene que ser más barato que "original": si no, se intercambian las
// etiquetas. "tu_estilo" no se toca porque es el que garantiza los colores.
export function ordenarPorPrecio(outfits) {
  const eco = outfits.find((o) => o.tipo === "economico");
  const ori = outfits.find((o) => o.tipo === "original");
  if (eco && ori && ori.total < eco.total) {
    [eco.tipo, ori.tipo] = [ori.tipo, eco.tipo];
  }
  const orden = { economico: 0, tu_estilo: 1, original: 2 };
  return outfits.sort((a, b) => orden[a.tipo] - orden[b.tipo]);
}

const INTRO_TIPO = {
  economico: "La opción más accesible",
  tu_estilo: "Pensado para tu estilo",
  original: "Una vuelta distinta",
};

const lista = (items) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items.at(-1)}`);

/**
 * Explicación armada con los datos reales del outfit. Se usa cuando el servidor
 * tuvo que cambiar prendas, para que el texto nunca hable de otra prenda.
 */
export function explicarOutfit(tipo, prendas, ctx) {
  const piezas = prendas.map((p) => {
    const color = p.colores[0]?.nombre;
    return color ? `${p.nombre} en ${color}` : p.nombre;
  });
  const frases = [`${INTRO_TIPO[tipo] ?? "Un look"}: combina ${lista(piezas)}.`];
  const conColor = prendas.filter(ctx.coincideColor);
  if (conColor.length) {
    frases.push(`${lista(conColor.map((p) => p.nombre))} ${conColor.length > 1 ? "suman" : "suma"} tus colores preferidos.`);
  }
  if (ctx.limite) frases.push(`Todo junto suma ${formato(total(prendas))}, dentro de tu presupuesto.`);
  if (ctx.propios.size) frases.push("Completalo con lo que ya tenés.");
  return frases.join(" ");
}
