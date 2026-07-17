import { supabase } from "../config/supabase.js";

export const busquedaRepository = {
  async guardar(idUsuario, texto) {
    const { error } = await supabase.from("Busqueda").insert([
      { id_usuario: idUsuario, texto_busqueda: texto, fecha: new Date().toISOString() },
    ]);
    if (error) throw new Error(error.message);
  },
};
