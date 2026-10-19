import { supabase } from "../config/supabase.js";
import { CAMPOS_PRESENTACION, selectConFallback } from "./columnas-opcionales.js";

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

  // para la página /locales (directorio): datos de presentación de la marca,
  // sus categorías y, por producto, lo necesario para miniaturas con precio,
  // "lo más vendido", puntuación (Opinion.recomienda) y orden por novedad.
  async getLocalesConProductos() {
    const RELACIONES = `
      Marca_Categoria ( Categoria ( nombre ) ),
      Producto (
        id_producto, nombre, precio, estado, fecha_alta,
        Imagen ( imagen, es_portada ),
        Descuento ( precio_final, fecha_inicio, fecha_fin ),
        Metrica_Producto ( visualizaciones, ventas ),
        Opinion ( recomienda ),
        Producto_Categoria ( Categoria ( nombre ) )
      )`;
    const BASE = "id_marca, nombre, descripcion, logo, ubicacion, imagen_fachada, sitio_web, instagram, tiktok";
    return selectConFallback(
      [`${BASE}, ${CAMPOS_PRESENTACION}, ${RELACIONES}`, `${BASE}, ${RELACIONES}`],
      (campos) => supabase.from("Marca").select(campos).eq("estado", 1)
    );
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
