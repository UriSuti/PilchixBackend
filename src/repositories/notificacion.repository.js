import { supabase } from "../config/supabase.js";

export const notificacionRepository = {
  // usuarios suscritos a una marca (para saber a quién notificar)
  async getSuscriptores(idMarca) {
    const { data, error } = await supabase
      .from("Suscripcion")
      .select("id_usuario")
      .eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
    return (data ?? []).map((s) => s.id_usuario);
  },

  // inserción EN LOTE: un solo insert con muchas filas
  async crearEnLote(filas) {
    if (!filas.length) return;
    const { error } = await supabase.from("Notificacion").insert(filas);
    if (error) throw new Error(error.message);
  },

  async getPorUsuario(idUsuario) {
    const { data, error } = await supabase
      .from("Notificacion")
      .select(`
        id_notificacion, tipo, leida, fecha, id_marca, id_producto,
        Marca ( nombre, logo ),
        Producto ( nombre )
      `)
      .eq("id_usuario", idUsuario)
      .order("fecha", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data;
  },

  async contarNoLeidas(idUsuario) {
    const { count, error } = await supabase
      .from("Notificacion")
      .select("id_notificacion", { count: "exact", head: true })
      .eq("id_usuario", idUsuario)
      .eq("leida", false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async marcarTodasLeidas(idUsuario) {
    const { error } = await supabase
      .from("Notificacion")
      .update({ leida: true })
      .eq("id_usuario", idUsuario)
      .eq("leida", false);
    if (error) throw new Error(error.message);
  },
};