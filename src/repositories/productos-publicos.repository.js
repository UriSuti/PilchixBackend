import { supabase } from "../config/supabase.js";

export const productosPublicosRepository = {
  async getProductos() {
    const { data, error } = await supabase
      .from("Producto")
      .select("*, Imagen(*), Marca(nombre, logo)");
    if (error) throw new Error(error.message);
    return data;
  },

  async getProductosPopulares() {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, descripcion, precio, estado,
        Marca ( nombre ),
        Imagen ( imagen, es_portada ),
        Metrica_Producto ( visualizaciones )
      `)
      .eq("estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  async getDescuentos(fechaActual) {
    const { data, error } = await supabase
      .from("Descuento")
      .select(`
        id_descuento, porcentaje, precio_anterior, precio_final, fecha_inicio, fecha_fin,
        Producto (
          id_producto, nombre, descripcion, precio, estado,
          Marca ( nombre ),
          Imagen ( imagen, es_portada )
        )
      `)
      .lte("fecha_inicio", fechaActual)
      .gte("fecha_fin", fechaActual)
      .eq("Producto.estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  async buscarProductos(texto) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, descripcion, precio, stock, estado,
        Imagen ( imagen, es_portada ),
        Marca ( nombre )
      `)
      .eq("estado", 1)
      .or(`nombre.ilike.%${texto}%,descripcion.ilike.%${texto}%`);
    if (error) throw new Error(error.message);
    return data;
  },

  async buscarProductosPorCategoria(texto) {
    const { data, error } = await supabase
      .from("Producto_Categoria")
      .select(`
        Producto (
          id_producto, nombre, descripcion, precio, stock, estado,
          Imagen ( imagen, es_portada ),
          Marca ( nombre )
        ),
        Categoria ( nombre )
      `)
      .eq("Producto.estado", 1)
      .ilike("Categoria.nombre", `%${texto}%`);
    if (error) throw new Error(error.message);
    return data;
  },

  async getCategorias() {
    const { data, error } = await supabase
      .from("Categoria")
      .select("id_categoria, nombre")
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return data;
  },

  // versión liviana: solo para contar productos activos por categoría (landing)
  async getCategoriasConProductosResumen() {
    const { data, error } = await supabase
      .from("Producto_Categoria")
      .select(`
        id_categoria,
        Producto ( id_producto, estado, Imagen ( imagen, es_portada ) )
      `)
      .eq("Producto.estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  // versión completa: para la página /categoria/:slug (filtros por marca/talle)
  async getCategoriasConProductosCompleto() {
    const { data, error } = await supabase
      .from("Producto_Categoria")
      .select(`
        id_categoria,
        Producto (
          id_producto, nombre, descripcion, precio, estado, guia_talles,
          Imagen ( imagen, es_portada ),
          Marca ( id_marca, nombre, logo )
        )
      `)
      .eq("Producto.estado", 1);
    if (error) throw new Error(error.message);
    return data;
  },

  async buscarCategoriasPorNombre(texto) {
    const { data, error } = await supabase
      .from("Categoria")
      .select(`
        id_categoria, nombre,
        Producto_Categoria ( Producto ( Imagen ( imagen ) ) )
      `)
      .ilike("nombre", `%${texto}%`);
    if (error) throw new Error(error.message);
    return data;
  },

  async incrementarVisualizacion(idProducto) {
    const { error } = await supabase.rpc("incrementar_visualizacion", { p_id_producto: idProducto });
    if (error) throw new Error(error.message);
  },

  async incrementarClic(idProducto) {
    const { error } = await supabase.rpc("incrementar_clic", { p_id_producto: idProducto });
    if (error) throw new Error(error.message);
  },
};
