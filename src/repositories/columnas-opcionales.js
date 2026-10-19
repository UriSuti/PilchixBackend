// Columnas de "Marca" que agregan migraciones de scripts/sql/ y que quizá
// todavía no corrieron en la base. Supabase rechaza cualquier select/update
// que nombre una columna inexistente, así que en vez de romper la consulta
// entera se reintenta sin ellas.
//   sonido_ambiente → 2026-08-31_sonido_ambiente.sql
//   el resto        → 2026-10-19_presentacion_local.sql
export const CAMPOS_PRESENTACION = "frase, anio_fundacion, horarios, envio, solo_online, estilos";

const COLUMNAS_OPCIONALES = [
  "sonido_ambiente", "frase", "anio_fundacion", "horarios", "envio", "solo_online", "estilos",
];

export function faltaColumnaOpcional(error) {
  const msg = error?.message;
  return !!msg && COLUMNAS_OPCIONALES.some((c) => msg.includes(c));
}

export function quitarColumnasOpcionales(campos) {
  return Object.fromEntries(
    Object.entries(campos).filter(([k]) => !COLUMNAS_OPCIONALES.includes(k))
  );
}

// prueba cada lista de campos en orden y devuelve la primera que la base acepte
export async function selectConFallback(variantes, consulta) {
  let res;
  for (const campos of variantes) {
    res = await consulta(campos);
    if (!faltaColumnaOpcional(res.error)) break;
  }
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
