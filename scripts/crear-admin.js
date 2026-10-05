// Crea (o actualiza la contraseña de) un admin de Pilchix.
// Uso: npm run crear-admin -- <email> <contraseña> [nombre]
import dotenv from "dotenv";
dotenv.config();
import bcrypt from "bcrypt";
import { supabase } from "../src/config/supabase.js";

const [email, password, nombre = "Admin"] = process.argv.slice(2);
if (!email || !password) {
  console.error("Uso: npm run crear-admin -- <email> <contraseña> [nombre]");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const { error } = await supabase
  .from("Admin")
  .upsert({ email, nombre, contraseña: hash }, { onConflict: "email" });

if (error) {
  console.error("✗ No se pudo crear el admin:", error.message);
  process.exit(1);
}
console.log(`✓ Admin ${email} listo.`);
