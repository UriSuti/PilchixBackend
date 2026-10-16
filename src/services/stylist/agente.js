import { chatCompletion } from "../../config/ia.js";
import { ROLES, buscarProductos, resumenParaAgente } from "./catalogo.js";

// tope de idas y vueltas con el modelo por pedido (cada una puede tener varias
// búsquedas en paralelo); si se pasa, cortamos con error en vez de seguir gastando cuota
const MAX_TURNOS = 8;
// tope total por pedido, para que el usuario no quede esperando indefinidamente
const MAX_DURACION_MS = 120_000;
const MAX_IDS_VER = 4;
// veces que se le devuelve una entrega con errores para que la corrija; pasado
// TIEMPO_CORRECCION_MS ya no se pide corrección (el servicio repara la entrega)
const MAX_CORRECCIONES = 1;
const TIEMPO_CORRECCION_MS = 45_000;

function error(mensaje, status) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

// formato "function" de Chat Completions. Los schemas usan solo lo básico de JSON
// Schema (sin additionalProperties ni anyOf) porque no todos los proveedores lo aceptan.
function herramienta(name, description, parameters) {
  return { type: "function", function: { name, description, parameters } };
}

const HERRAMIENTA_BUSCAR = herramienta(
  "buscar_productos",
  "Busca prendas disponibles (activas y con stock) en el catálogo de Pilchix. Todos los filtros son opcionales y se combinan. " +
    "Devuelve hasta `limite` productos con id, nombre, marca, rol, colores, precio y talles. " +
    "Usala una vez por cada rol que necesites (parte de arriba, parte de abajo, calzado, etc.); podés pedir varias búsquedas a la vez.",
  {
    type: "object",
    properties: {
      texto: { type: "string", description: "Palabras libres que se buscan en nombre, descripción, marca y etiquetas. Ej.: 'baggy', 'oversize', 'frisa'." },
      roles: { type: "array", items: { type: "string", enum: ROLES }, description: "Rol de la prenda dentro de un outfit." },
      colores: { type: "array", items: { type: "string" }, description: "Nombres de color en español: negro, blanco, gris, beige, marrón, azul, celeste, verde, rojo, rosa, violeta, naranja, amarillo, etc." },
      precio_min: { type: "number" },
      precio_max: { type: "number" },
      talle: { type: "string", description: "Solo productos que tengan este talle (ej.: 'M', '40')." },
      excluir_ids: { type: "array", items: { type: "integer" }, description: "Ids que no tienen que aparecer." },
      limite: { type: "integer", description: "Cantidad máxima de resultados (por defecto 12, máximo 25)." },
    },
  }
);

const HERRAMIENTA_VER = herramienta(
  "ver_producto",
  `Devuelve el detalle completo de hasta ${MAX_IDS_VER} productos (descripción larga, colores, talles, etiquetas). Usala solo si la búsqueda no alcanza para decidir entre pocas opciones.`,
  {
    type: "object",
    properties: {
      ids: { type: "array", items: { type: "integer" }, description: `Ids de producto (máximo ${MAX_IDS_VER}).` },
    },
    required: ["ids"],
  }
);

const PRENDA_SCHEMA = {
  type: "object",
  properties: {
    id_producto: { type: "integer" },
    rol: { type: "string", description: "Ej.: parte de arriba, pantalón, calzado, abrigo, accesorio." },
  },
  required: ["id_producto", "rol"],
};

export const HERRAMIENTA_ENTREGAR_OUTFITS = herramienta(
  "entregar_outfits",
  "Entrega los tres outfits finales al usuario. Llamala una sola vez, al final, cuando ya hayas elegido las prendas.",
  {
    type: "object",
    properties: {
      mensaje: { type: "string", description: "Una o dos oraciones presentando las propuestas al usuario." },
      outfits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["economico", "tu_estilo", "original"] },
            titulo: { type: "string", description: "Nombre corto y con onda para el outfit." },
            explicacion: { type: "string" },
            prendas: { type: "array", items: PRENDA_SCHEMA },
          },
          required: ["tipo", "titulo", "explicacion", "prendas"],
        },
      },
    },
    required: ["mensaje", "outfits"],
  }
);

export const HERRAMIENTA_ENTREGAR_CAMBIO = herramienta(
  "entregar_cambio",
  "Entrega la prenda elegida para reemplazar a la anterior. Llamala una sola vez, al final.",
  {
    type: "object",
    properties: {
      id_producto: { type: "integer", description: "Id de la prenda nueva, o 0 si no hay ninguna alternativa razonable." },
      rol: { type: "string" },
      motivo: { type: "string", description: "Una oración: por qué elegiste esta prenda (o por qué no hay alternativa)." },
      explicacion: { type: "string", description: "Explicación actualizada del outfit completo con la prenda nueva." },
    },
    required: ["id_producto", "rol", "motivo", "explicacion"],
  }
);

function parsearArgumentos(llamada) {
  const crudo = llamada.function?.arguments;
  if (crudo && typeof crudo === "object") return crudo;
  try {
    return JSON.parse(crudo || "{}");
  } catch {
    return null;
  }
}

function ejecutarHerramienta(nombre, input, catalogo, vistos) {
  if (nombre === "buscar_productos") {
    const res = buscarProductos(catalogo, input);
    res.productos.forEach((p) => vistos.add(p.id));
    return res;
  }
  if (nombre === "ver_producto") {
    const ids = Array.isArray(input.ids) ? input.ids.map(Number).slice(0, MAX_IDS_VER) : [];
    const productos = ids
      .map((id) => catalogo.find((p) => p.id_producto === id))
      .filter(Boolean)
      .map((p) => resumenParaAgente(p, { conDescripcion: true }));
    productos.forEach((p) => vistos.add(p.id));
    const faltantes = ids.filter((id) => !productos.some((p) => p.id === id));
    return { productos, ...(faltantes.length ? { no_encontrados: faltantes } : {}) };
  }
  throw new Error(`Herramienta desconocida: ${nombre}`);
}

/**
 * Corre el agente: el modelo busca en el catálogo con las herramientas y termina
 * llamando a `herramientaFinal`. Devuelve { resultado, vistos, errores }:
 * - vistos: ids que el agente vio (en búsquedas o en los candidatos iniciales).
 * - errores: lo que `validar` todavía marca mal después de las correcciones
 *   (vacío si la entrega cumple las reglas).
 * `validar(resultado)` devuelve una lista de errores; si hay, se le devuelven al
 * modelo para que corrija (hasta MAX_CORRECCIONES veces).
 */
export async function correrAgente({ catalogo, system, contenido, herramientaFinal, validar, vistosIniciales = [] }) {
  const nombreFinal = herramientaFinal.function.name;
  const tools = [HERRAMIENTA_BUSCAR, HERRAMIENTA_VER, herramientaFinal];
  const messages = [
    { role: "system", content: system },
    { role: "user", content: contenido },
  ];
  const vistos = new Set(vistosIniciales);
  let recordatorioEnviado = false;
  let correcciones = 0;
  let ultimaEntrega = null; // por si se termina el tiempo después de una entrega con errores
  let modelo; // el primero que responde queda fijo para el resto de la conversación
  const inicio = Date.now();
  const vence = inicio + MAX_DURACION_MS;

  for (let turno = 0; turno < MAX_TURNOS; turno++) {
    if (Date.now() > vence) break;
    const respuesta = await chatCompletion({ messages, tools, preferido: modelo });
    modelo = respuesta.modelo;
    const { message, finish_reason } = respuesta.choice;

    if (finish_reason === "content_filter") {
      throw error("El estilista no pudo responder a ese pedido. Probá contándolo de otra forma.", 422);
    }
    if (finish_reason === "length") {
      throw error("La respuesta del estilista quedó incompleta. Probá de nuevo.", 502);
    }

    // el mensaje del asistente vuelve tal cual: Gemini 3 guarda adentro de las
    // tool_calls una "thought signature" que tiene que recibir de nuevo
    messages.push(message);

    const llamadas = message.tool_calls ?? [];
    const final = llamadas.find((l) => l.function?.name === nombreFinal);
    let erroresEntrega = null;
    if (final) {
      const resultado = parsearArgumentos(final);
      if (resultado) {
        const errores = validar ? validar(resultado) : [];
        ultimaEntrega = { resultado, vistos, errores };
        const sinTiempo = Date.now() - inicio > TIEMPO_CORRECCION_MS;
        if (errores.length === 0 || correcciones >= MAX_CORRECCIONES || sinTiempo) return ultimaEntrega;
        correcciones++;
        erroresEntrega = errores;
        console.log(`[stylist] corrección ${correcciones} (${modelo}) →`, errores.join(" | "));
      }
      // argumentos rotos o con errores: se le responde a la herramienta y sigue el loop
    }

    if (llamadas.length === 0) {
      // terminó sin entregar: un solo recordatorio y, si insiste, error
      if (recordatorioEnviado) throw error("El estilista no pudo terminar la propuesta. Probá de nuevo.", 502);
      recordatorioEnviado = true;
      messages.push({
        role: "user",
        content: `Para terminar, entregá tu propuesta llamando a la herramienta ${nombreFinal}.`,
      });
      continue;
    }

    // una respuesta "tool" por cada llamada, en el mismo orden
    for (const llamada of llamadas) {
      const nombre = llamada.function?.name;
      const input = parsearArgumentos(llamada);
      let contenidoRespuesta;
      if (!input) {
        contenidoRespuesta = JSON.stringify({ error: "Los argumentos no son un JSON válido. Volvé a intentarlo." });
      } else if (nombre === nombreFinal) {
        contenidoRespuesta = JSON.stringify({
          aceptado: false,
          errores: erroresEntrega ?? [],
          instruccion: `Corregí estos puntos y volvé a llamar a ${nombreFinal} con la propuesta completa.`,
        });
      } else {
        try {
          contenidoRespuesta = JSON.stringify(ejecutarHerramienta(nombre, input, catalogo, vistos));
        } catch (err) {
          contenidoRespuesta = JSON.stringify({ error: err.message });
        }
      }
      messages.push({ role: "tool", tool_call_id: llamada.id, name: nombre, content: contenidoRespuesta });
    }
    console.log(
      `[stylist] turno ${turno + 1} (${modelo}) →`,
      llamadas.map((l) => `${l.function?.name}(${l.function?.arguments})`).join(" | ")
    );
  }

  // se terminó el tiempo o los turnos: si hubo una entrega, se usa (el servicio la repara)
  if (ultimaEntrega) return ultimaEntrega;
  throw error("El estilista tardó demasiado en armar la propuesta. Probá con un pedido más concreto.", 504);
}
