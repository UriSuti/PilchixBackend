import dotenv from "dotenv";
dotenv.config();

const FASHN_API_URL = "https://api.fashn.ai/v1";
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

function headers() {
  if (!process.env.FASHN_API_KEY) {
    const err = new Error("Falta configurar FASHN_API_KEY en el servidor");
    err.status = 500;
    throw err;
  }
  return {
    Authorization: `Bearer ${process.env.FASHN_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export const fashnClient = {
  // dispara la generación y devuelve el id del job (todavía no está lista)
  async run({ productImage, modelImage }) {
    const res = await fetch(`${FASHN_API_URL}/run`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        model_name: "tryon-max",
        inputs: {
          product_image: productImage,
          model_image: modelImage,
          resolution: "1k",
          generation_mode: "fast",
          return_base64: true,
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const err = new Error(data.error || "FASHN no pudo iniciar la generación");
      err.status = 502;
      throw err;
    }
    return data.id;
  },

  // hace polling a /status/:id hasta "completed" (o error/timeout)
  async esperarResultado(id) {
    const inicio = Date.now();
    while (Date.now() - inicio < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const res = await fetch(`${FASHN_API_URL}/status/${id}`, { headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || "Error consultando el estado de la generación");
        err.status = 502;
        throw err;
      }

      if (data.status === "completed") {
        return data.output?.[0] ?? null;
      }
      if (data.status === "failed" || data.error) {
        const err = new Error(
          typeof data.error === "string" ? data.error : "La generación falló en FASHN"
        );
        err.status = 502;
        throw err;
      }
      // starting | in_queue | processing → seguimos esperando
    }
    const err = new Error("La generación tardó demasiado, probá de nuevo");
    err.status = 504;
    throw err;
  },
};
