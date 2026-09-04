// Prueba manual y aislada del cliente FASHN, sin pasar por Express.
// Uso: npm run test:fashn -- <url_prenda> <url_foto_persona>
// (si no se pasan argumentos, usa dos fotos de stock solo para chequear que
//  el flujo run → polling → resultado funciona de punta a punta)
import dotenv from "dotenv";
dotenv.config();
import { fashnClient } from "../src/config/fashn.js";

const productImage =
  process.argv[2] || "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800";
const modelImage =
  process.argv[3] || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800";

console.log("product_image:", productImage);
console.log("model_image:", modelImage);

const id = await fashnClient.run({ productImage, modelImage });
console.log("job id:", id);

const inicio = Date.now();
const output = await fashnClient.esperarResultado(id);
const segundos = ((Date.now() - inicio) / 1000).toFixed(1);

console.log(`Listo en ${segundos}s`);
console.log(
  "output:",
  typeof output === "string" ? `${output.slice(0, 100)}... (${output.length} chars)` : output
);
