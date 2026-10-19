import dotenv from "dotenv";
dotenv.config();

// Cliente mínimo para cualquier API compatible con OpenAI Chat Completions.
// Por defecto usa Google Gemini (tiene plan gratis), pero se puede cambiar a
// Groq, OpenRouter u Ollama local solo con las variables de entorno:
//   AI_BASE_URL, AI_API_KEY, AI_MODEL, AI_REASONING_EFFORT
// AI_MODEL acepta una lista separada por comas: si un modelo está saturado (503),
// sin cuota (429) o no existe (404), se prueba el siguiente.
const DEFAULTS = {
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  models: "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-latest",
  reasoningEffort: "low",
};

// errores por los que conviene pasar al modelo siguiente de la lista
// (504 = no respondió a tiempo o falló la conexión)
const PASAR_AL_SIGUIENTE = new Set([404, 429, 500, 503, 504]);

// por llamada: si un modelo saturado no contesta en este tiempo, se pasa al siguiente
const TIMEOUT_MS = 40_000;
const MAX_REINTENTOS_429 = 2;

// status: el que ve el cliente. httpStatus: el que devolvió el proveedor de IA.
function error(mensaje, status, httpStatus) {
  const err = new Error(mensaje);
  err.status = status;
  if (httpStatus) err.httpStatus = httpStatus;
  return err;
}

export function configIA() {
  return {
    baseUrl: (process.env.AI_BASE_URL || DEFAULTS.baseUrl).replace(/\/+$/, ""),
    // GEMINI_* se acepta como alias de AI_*
    apiKey: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || "",
    models: (process.env.AI_MODEL || process.env.GEMINI_MODEL || DEFAULTS.models).split(",").map((m) => m.trim()).filter(Boolean),
    // vacío = no se manda (algunos modelos no aceptan el parámetro)
    reasoningEffort: process.env.AI_REASONING_EFFORT ?? DEFAULTS.reasoningEffort,
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// un 429 que pide esperar más que esto es un límite diario: no se reintenta
const MAX_ESPERA_REINTENTO_MS = 60_000;

// modelos que agotaron su cuota diaria → hasta cuándo saltearlos (en memoria)
const agotadosHasta = new Map();

// cuánto pide esperar un 429: header retry-after o el "Please retry in 10h49m14s" de Gemini
function esperaPedida(res, mensaje) {
  const retryAfter = Number(res.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  const m = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(mensaje ?? "");
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000;
}

function cuandoVuelve(ms) {
  const min = Math.ceil(ms / 60_000);
  return min >= 60 ? `en unas ${Math.ceil(min / 60)} horas` : `en ${min} minutos`;
}

// POST /chat/completions a un modelo. Reintenta los 429 por minuto (los planes
// gratis los tiran seguido). Devuelve choices[0] o tira un error con .status.
async function pedirAModelo(modelo, { messages, tools, toolChoice }) {
  const { baseUrl, apiKey, reasoningEffort } = configIA();
  const body = {
    model: modelo,
    messages,
    ...(tools?.length ? { tools, tool_choice: toolChoice } : {}),
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
  };

  for (let intento = 0; ; intento++) {
    let res;
    try {
      res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const esTimeout = err.name === "TimeoutError";
      console.error(`IA (${modelo}): ${esTimeout ? `sin respuesta en ${TIMEOUT_MS / 1000}s` : `error de red: ${err.message}`}`);
      throw error("El estilista no está disponible en este momento.", 503, 504);
    }

    const data = await res.json().catch(() => ({}));
    // algunos proveedores devuelven un array con el error adentro
    const detalle = (Array.isArray(data) ? data[0] : data)?.error;

    if (res.status === 429) {
      const espera = esperaPedida(res, detalle?.message);
      if (espera !== null && espera > MAX_ESPERA_REINTENTO_MS) {
        // cuota diaria agotada: se saltea este modelo hasta que se renueve
        agotadosHasta.set(modelo, Date.now() + espera);
        console.warn(`IA: ${modelo} agotó su cuota gratis; vuelve ${cuandoVuelve(espera)}`);
        throw error("El estilista gratuito llegó a su límite de uso. Probá de nuevo en un rato.", 429);
      }
      if (intento < MAX_REINTENTOS_429) {
        await esperar(espera ?? 6000 * (intento + 1));
        continue;
      }
    }
    if (!res.ok) {
      console.error(`IA ${res.status} (${modelo}):`, detalle?.message ?? JSON.stringify(data).slice(0, 500));
      // Gemini responde 400 (no 401) cuando la clave es inválida
      if (res.status === 401 || res.status === 403 || /api.?key/i.test(detalle?.message ?? "")) {
        throw error("La clave de la IA (AI_API_KEY) no es válida o no tiene permisos.", 500);
      }
      if (res.status === 429) {
        throw error("El estilista gratuito llegó a su límite de uso. Probá de nuevo en un rato.", 429);
      }
      throw error("El estilista no está disponible en este momento.", res.status >= 500 ? 503 : 502, res.status);
    }

    const choice = data.choices?.[0];
    if (!choice?.message) {
      console.error(`IA (${modelo}): respuesta sin choices:`, JSON.stringify(data).slice(0, 500));
      throw error("El estilista devolvió una respuesta inesperada. Probá de nuevo.", 502);
    }
    return choice;
  }
}

/**
 * Chat Completions con respaldo entre modelos. `preferido` (el modelo que ya
 * respondió antes en la misma conversación) se prueba primero, así un agente no
 * cambia de modelo a mitad de camino salvo que sea necesario.
 * Devuelve { choice, modelo }.
 */
export async function chatCompletion({ messages, tools, toolChoice = "auto", preferido }) {
  const { baseUrl, apiKey, models } = configIA();
  const esLocal = /localhost|127\.0\.0\.1/.test(baseUrl);
  if (!apiKey && !esLocal) {
    throw error("Falta configurar AI_API_KEY en el servidor", 500);
  }

  const todos = preferido ? [preferido, ...models.filter((m) => m !== preferido)] : models;
  const ahora = Date.now();
  const orden = todos.filter((m) => !(agotadosHasta.get(m) > ahora));
  if (orden.length === 0) {
    const vuelve = Math.min(...todos.map((m) => agotadosHasta.get(m))) - ahora;
    throw error(`El estilista gratuito llegó a su límite de uso de hoy. Vuelve a estar disponible ${cuandoVuelve(vuelve)}.`, 429);
  }
  let ultimoError;
  for (const modelo of orden) {
    try {
      const choice = await pedirAModelo(modelo, { messages, tools, toolChoice });
      return { choice, modelo };
    } catch (err) {
      ultimoError = err;
      const status = err.httpStatus ?? err.status;
      if (!PASAR_AL_SIGUIENTE.has(status) || err.status === 500) throw err; // ej.: clave inválida
      console.warn(`IA: ${modelo} no disponible (${status}), probando el siguiente…`);
    }
  }
  throw ultimoError;
}
