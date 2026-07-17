import { supabase } from "../config/supabase.js";

export const opinionRepository = {
  async getPorProducto(idProducto) {
    const { data, error } = await supabase
      .from("Opinion")
      .select(
        "id_opinion, texto, recomienda, fecha, id_usuario, Usuario(nombre, foto_perfil)"
      )
      .eq("id_producto", idProducto)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async yaOpino(idProducto, idUsuario) {
    const { data, error } = await supabase
      .from("Opinion")
      .select("id_opinion")
      .eq("id_producto", idProducto)
      .eq("id_usuario", idUsuario)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async comprado(idProducto, idUsuario) {
    const { data, error } = await supabase
      .from("Compra")
      .select("id_compra, Compra_Detalle!inner(id_producto)")
      .eq("id_usuario", idUsuario)
      .eq("Compra_Detalle.id_producto", idProducto)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  },

  async crear({ id_producto, id_usuario, texto, recomienda }) {
    const { data, error } = await supabase
      .from("Opinion")
      .insert({ id_producto, id_usuario, texto, recomienda })
      .select(
        "id_opinion, texto, recomienda, fecha, id_usuario, Usuario(nombre, foto_perfil)"
      )
      .single();
    if (error) throw error;
    return data;
  },

  async eliminar(idOpinion, idUsuario) {
    const { data, error } = await supabase
      .from("Opinion")
      .delete()
      .eq("id_opinion", idOpinion)
      .eq("id_usuario", idUsuario)
      .select("id_opinion");
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  },
};
