import bcrypt from "bcrypt";

const nueva = "holahola";   // ← la contraseña nueva que vas a usar
const hash = await bcrypt.hash(nueva, 10);
console.log(hash);