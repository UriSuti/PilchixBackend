import { supabase } from "../config/supabase.js";

export const metricasRepository = {
  async getProductos(idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, precio, stock, estado,
        Imagen ( imagen, es_portada ),
        Producto_Categoria ( Categoria ( nombre ) ),
        Favorito ( id_favorito ),
        Opinion ( recomienda )
      `)
      .eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getMetricasDiarias(ids, desde) {
    const { data, error } = await supabase
      .from("Metrica_Producto")
      .select("id_producto, visualizaciones, clics, fecha")
      .in("id_producto", ids)
      .gte("fecha", desde);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getVentas(ids, desde) {
    const { data, error } = await supabase
      .from("Compra_Detalle")
      .select("id_producto, id_compra, cantidad, precio_unitario, talle, color, Compra!inner ( fecha )")
      .in("id_producto", ids)
      .gte("Compra.fecha", desde);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getSuscripciones(idMarca) {
    const { data, error } = await supabase
      .from("Suscripcion")
      .select("fecha_inicio")
      .eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};