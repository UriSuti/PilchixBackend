import { supabase } from "../config/supabase.js";

export const localesRepository = {
  async getMarcasActivas() {
    const { data, error } = await supabase
      .from("Marca")
      .select("id_marca, nombre, descripcion, logo, sitio_web, ubicacion")
      .eq("estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  async getMarcasPopulares() {
    const { data, error } = await supabase
      .from("Marca")
      .select(`
        id_marca, nombre, descripcion, logo, sitio_web, ubicacion,
        Producto ( id_producto, Metrica_Producto ( visualizaciones ) )
      `)
      .eq("estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  // para la página /locales: fachada + productos (contar) + métricas (ordenar)
  async getLocalesConProductos() {
    const { data, error } = await supabase
      .from("Marca")
      .select(`
        id_marca, nombre, descripcion, logo, ubicacion, imagen_fachada,
        Producto ( id_producto, estado, Metrica_Producto ( visualizaciones ) )
      `)
      .eq("estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  async buscarMarcas(texto) {
    const { data, error } = await supabase
      .from("Marca")
      .select("id_marca, nombre, descripcion, logo")
      .eq("estado", 1)
      .ilike("nombre", `%${texto}%`);
    if (error) throw new Error(error.message);
    return data;
  },

  async getFachada(idMarca) {
    const { data, error } = await supabase
      .from("Marca")
      .select("imagen_fachada")
      .eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
    return data;
  },

  async getProductosDeLocal(idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select("*, Imagen(*)")
      .eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
    return data;
  },
};
