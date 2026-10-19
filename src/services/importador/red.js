import { lookup } from "node:dns/promises";
import net from "node:net";

// Pedidos HTTP a sitios que elige el local. Como la URL la escribe un usuario,
// solo se permite http(s) a IPs públicas: así nadie puede usar el importador para
// pegarle a la red interna del servidor (localhost, 10.x, metadata de la nube, etc.).

const USER_AGENT = "Mozilla/5.0 (compatible; PilchixImportador/1.0; +https://pilchix.com)";
const TIMEOUT_MS = 20_000;
const MAX_REDIRECCIONES = 5;

function error(mensaje, status = 400) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

function esIpPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
      (a === 169 && b === 254) ||              // link-local / metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                                 // multicast y reservadas
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return esIpPrivada(v6.slice(7));
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

async function validarDestino(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw error("El link tiene que empezar con http:// o https://");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ips = net.isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  if (!ips.length) throw error(`No se encontró el sitio ${url.hostname}`);
  if (ips.some(esIpPrivada)) throw error("Ese link no apunta a una página pública");
}

// lee el cuerpo cortando si supera el máximo (una página gigante no tumba el servidor)
async function leerConLimite(res, maxBytes) {
  const largo = Number(res.headers.get("content-length"));
  if (largo > maxBytes) throw error("La respuesta es demasiado grande", 502);
  const partes = [];
  let total = 0;
  for await (const parte of res.body) {
    total += parte.length;
    if (total > maxBytes) {
      await res.body.cancel?.().catch(() => {});
      throw error("La respuesta es demasiado grande", 502);
    }
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

/**
 * GET a una URL pública siguiendo redirecciones (cada salto se valida).
 * Devuelve { status, url, tipo, cuerpo: Buffer }. No tira error por status != 200.
 */
export async function pedir(urlTexto, { maxBytes = 8 * 1024 * 1024, accept = "*/*" } = {}) {
  let url = new URL(urlTexto);
  for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
    await validarDestino(url);
    let res;
    try {
      res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "es-AR,es;q=0.9" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const esTimeout = err.name === "TimeoutError";
      throw error(esTimeout ? `${url.hostname} no respondió a tiempo` : `No se pudo conectar con ${url.hostname}`, 502);
    }
    const destino = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && destino) {
      await res.body?.cancel().catch(() => {});
      url = new URL(destino, url);
      continue;
    }
    const cuerpo = res.body ? await leerConLimite(res, maxBytes) : Buffer.alloc(0);
    return { status: res.status, url: url.href, tipo: res.headers.get("content-type") ?? "", cuerpo };
  }
  throw error("El link redirige demasiadas veces", 502);
}

export async function pedirTexto(url, opciones) {
  const r = await pedir(url, opciones);
  return { ...r, texto: r.cuerpo.toString("utf8") };
}

// JSON o null si la respuesta no es un JSON válido con status 200
export async function pedirJson(url, opciones) {
  const r = await pedir(url, { accept: "application/json", ...opciones });
  if (r.status !== 200) return null;
  try {
    return JSON.parse(r.cuerpo.toString("utf8"));
  } catch {
    return null;
  }
}

// corre `fn` sobre cada item con a lo sumo `limite` en paralelo; conserva el orden
export async function enParalelo(items, limite, fn) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return resultados;
}
