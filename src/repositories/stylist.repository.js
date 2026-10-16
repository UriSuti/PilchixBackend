import { supabase } from "../config/supabase.js";

export const stylistRepository = {
  // productos que el estilista puede recomendar: activos, con stock y de marcas activas
  async getCatalogo() {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, descripcion, precio, stock, colores, guia_talles,
        Marca!inner ( nombre, estado ),
        Imagen ( imagen, es_portada ),
        Producto_Categoria ( Categoria ( nombre ) ),
        Producto_Etiqueta ( Etiqueta ( nombre ) ),
        Descuento ( precio_final, fecha_inicio, fecha_fin )
      `)
      .eq("estado", 1)
      .eq("Marca.estado", 1)
      .gt("stock", 0)
      .order("id_producto");
    if (error) throw new Error(error.message);
    return data;
  },

  async getPreferencias(idUsuario) {
    const { data, error } = await supabase
      .from("Usuario")
      .select("preferencias_stylist")
      .eq("id_usuario", idUsuario)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.preferencias_stylist ?? null;
  },

  async setPreferencias(idUsuario, preferencias) {
    const { error } = await supabase
      .from("Usuario")
      .update({ preferencias_stylist: preferencias })
      .eq("id_usuario", idUsuario);
    if (error) throw new Error(error.message);
  },
};
