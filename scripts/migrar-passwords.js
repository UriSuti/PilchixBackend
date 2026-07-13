import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";
import { supabase } from "../src/config/supabase.js";

const SALT_ROUNDS = 10;

// un hash bcrypt siempre empieza con $2a$, $2b$ o $2y$
const yaHasheada = (pass) => typeof pass === "string" && pass.startsWith("$2");

async function migrarTabla(tabla, idCol) {
  const { data, error } = await supabase.from(tabla).select(`${idCol}, contraseña`);
  if (error) throw new Error(error.message);

  for (const fila of data) {
    if (!fila.contraseña || yaHasheada(fila.contraseña)) {
      console.log(`- ${tabla} ${fila[idCol]}: ya hasheada o vacía, salteo`);
      continue;
    }
    const hash = await bcrypt.hash(fila.contraseña, SALT_ROUNDS);
    const { error: errUpd } = await supabase
      .from(tabla)
      .update({ contraseña: hash })
      .eq(idCol, fila[idCol]);

    if (errUpd) console.error(`✗ ${tabla} ${fila[idCol]}:`, errUpd.message);
    else console.log(`✓ ${tabla} ${fila[idCol]}: hasheada`);
  }
}

await migrarTabla("Usuario", "id_usuario");
await migrarTabla("Marca", "id_marca");
console.log("Migración terminada.");