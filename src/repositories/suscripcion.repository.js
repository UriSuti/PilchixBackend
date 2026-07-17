import { supabase } from "../config/supabase.js";

export const suscripcionRepository = {
  async getDeUsuario(idUsuario) {
    const { data, error } = await supabase
      .from("Suscripcion")
      .select(`id_suscripcion, id_marca, fecha_inicio, Marca ( nombre, logo )`)
      .eq("id_usuario", idUsuario);
    if (error) throw new Error(error.message);
    return data;
  },

  async get(idUsuario, idMarca) {
    const { data, error } = await supabase
      .from("Suscripcion")
      .select("id_suscripcion")
      .eq("id_usuario", idUsuario)
      .eq("id_marca", idMarca)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async agregar(idUsuario, idMarca) {
    const { error } = await supabase
      .from("Suscripcion")
      .insert([{ id_usuario: idUsuario, id_marca: idMarca, fecha_inicio: new Date().toISOString().split("T")[0] }]);
    if (error) throw error;
  },

  async quitar(idUsuario, idMarca) {
    const { error } = await supabase
      .from("Suscripcion")
      .delete()
      .eq("id_usuario", idUsuario)
      .eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
  },
};
