import { supabase } from "../config/supabase.js";

export const localesRepository = {
  // ver la nota sobre "sonido_ambiente" en marca.repository.js: mientras no
  // corra scripts/sql/2026-08-31_sonido_ambiente.sql, se reintenta sin esa
  // columna para no romper la home ni las páginas de local.
  async getMarcasActivas() {
    const CAMPOS_BASE = "id_marca, nombre, descripcion, logo, sitio_web, ubicacion, instagram, tiktok";
    let { data, error } = await supabase
      .from("Marca")
      .select(`${CAMPOS_BASE}, sonido_ambiente`)
      .eq("estado", 1);

    if (error?.message?.includes("sonido_ambiente")) {
      ({ data, error } = await supabase.from("Marca").select(CAMPOS_BASE).eq("estado", 1));
    }
    if (error) throw new Error(error.message);
    return data;
  },

  async getMarcasPopulares() {
    const { data, error } = await supabase
      .from("Marca")
      .select(`
        id_marca, nombre, descripcion, logo, sitio_web, ubicacion, instagram, tiktok,
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
