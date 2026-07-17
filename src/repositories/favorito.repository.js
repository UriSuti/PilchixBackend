import { supabase } from "../config/supabase.js";

export const favoritoRepository = {
  async getDeUsuario(idUsuario) {
    const { data, error } = await supabase
      .from("Favorito")
      .select(`
        id_favorito,
        id_producto,
        Producto (
          nombre,
          precio,
          id_marca,
          Marca ( nombre ),
          Imagen ( imagen, es_portada )
        )
      `)
      .eq("id_usuario", idUsuario);
    if (error) throw new Error(error.message);
    return data;
  },

  async get(idUsuario, idProducto) {
    const { data, error } = await supabase
      .from("Favorito")
      .select("id_favorito")
      .eq("id_usuario", idUsuario)
      .eq("id_producto", idProducto)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async agregar(idUsuario, idProducto) {
    const { error } = await supabase
      .from("Favorito")
      .insert([{ id_usuario: idUsuario, id_producto: idProducto }]);
    if (error) throw error;
  },

  async quitar(idUsuario, idProducto) {
    const { error } = await supabase
      .from("Favorito")
      .delete()
      .eq("id_usuario", idUsuario)
      .eq("id_producto", idProducto);
    if (error) throw new Error(error.message);
  },
};
