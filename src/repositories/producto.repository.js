import { supabase } from "../config/supabase.js";

const BUCKET = "productos";

export const productoRepository = {
  async getCategorias() {
    const { data, error } = await supabase
      .from("Categoria")
      .select("id_categoria, nombre")
      .order("nombre");
    if (error) throw new Error(error.message);
    return data;
  },

  async getProductosDeMarca(idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, descripcion, precio, stock, estado, fecha_alta,
        Imagen ( imagen, es_portada )
      `)
      .eq("id_marca", idMarca)
      .order("fecha_alta", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async getProductoPorId(idProducto, idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, id_marca, nombre, descripcion, precio, stock, estado,
        guia_talles, colores,
        Imagen ( id_imagen, imagen, color, es_portada ),
        Producto_Categoria ( id_categoria )
      `)
      .eq("id_producto", idProducto)
      .eq("id_marca", idMarca)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async esPropietario(idProducto, idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select("id_producto")
      .eq("id_producto", idProducto)
      .eq("id_marca", idMarca)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async crearProducto(datos) {
    const { data, error } = await supabase
      .from("Producto")
      .insert([datos])
      .select("id_producto")
      .single();
    if (error) throw new Error(error.message);
    return data.id_producto;
  },

  async actualizarProducto(idProducto, idMarca, datos) {
    const { data, error } = await supabase
      .from("Producto")
      .update(datos)
      .eq("id_producto", idProducto)
      .eq("id_marca", idMarca)
      .select("id_producto");
    if (error) throw new Error(error.message);
    return data.length > 0;
  },

  async borrarProducto(idProducto, idMarca) {
    const esPropietario = await this.esPropietario(idProducto, idMarca);
    if (!esPropietario) return false;

    await supabase.from("Imagen").delete().eq("id_producto", idProducto);
    await supabase.from("Producto_Categoria").delete().eq("id_producto", idProducto);
    const { error } = await supabase.from("Producto").delete().eq("id_producto", idProducto);
    if (error) throw new Error(error.message);
    return true;
  },

  async setCategoriasProducto(idProducto, idsCategorias) {
    if (!idsCategorias.length) return;
    const filas = idsCategorias.map((id_categoria) => ({ id_producto: idProducto, id_categoria }));
    const { error } = await supabase.from("Producto_Categoria").insert(filas);
    if (error) throw new Error(error.message);
  },

  async actualizarCategoriasProducto(idProducto, idsCategorias) {
    const { error: errorDelete } = await supabase
      .from("Producto_Categoria")
      .delete()
      .eq("id_producto", idProducto);
    if (errorDelete) throw new Error(errorDelete.message);
    await this.setCategoriasProducto(idProducto, idsCategorias);
  },

  async subirImagen(buffer, nombreOriginal, mimetype) {
    const ext = nombreOriginal.split(".").pop();
    const nombre = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, buffer, { contentType: mimetype });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
    return data.publicUrl;
  },

  async insertarImagenes(idProducto, filas) {
    const registros = filas.map(({ imagen, color, es_portada }) => ({
      id_producto: idProducto,
      imagen,
      color: color || null,
      es_portada: !!es_portada,
    }));
    const { data, error } = await supabase.from("Imagen").insert(registros).select();
    if (error) throw new Error(error.message);
    return data;
  },

  async getImagenConMarca(idImagen) {
    const { data, error } = await supabase
      .from("Imagen")
      .select("id_imagen, imagen, id_producto, Producto ( id_marca )")
      .eq("id_imagen", idImagen)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async marcarPortada(idProducto, idImagen) {
    await supabase.from("Imagen").update({ es_portada: false }).eq("id_producto", idProducto);
    const { error } = await supabase.from("Imagen").update({ es_portada: true }).eq("id_imagen", idImagen);
    if (error) throw new Error(error.message);
  },

  async actualizarColorImagen(idImagen, color) {
    const { error } = await supabase.from("Imagen").update({ color: color || null }).eq("id_imagen", idImagen);
    if (error) throw new Error(error.message);
  },

  async borrarImagen(idImagen, urlImagen) {
    const { error } = await supabase.from("Imagen").delete().eq("id_imagen", idImagen);
    if (error) throw new Error(error.message);
    if (urlImagen) {
      const nombre = urlImagen.split("/").pop();
      await supabase.storage.from(BUCKET).remove([nombre]);
    }
  },

  async getDashboardData(idMarca, desde) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto,
        nombre,
        precio,
        estado,
        Imagen ( imagen ),
        Metrica_Producto ( visualizaciones, clics, ventas, fecha )
      `)
      .eq("id_marca", idMarca)
      .gte("Metrica_Producto.fecha", desde);
    if (error) throw new Error(error.message);
    return data;
  },

  async getMetricasData(idMarca, desde) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, precio, stock, estado,
        Imagen ( imagen ),
        Producto_Categoria ( Categoria ( nombre ) ),
        Metrica_Producto ( visualizaciones, clics, ventas, fecha )
      `)
      .eq("id_marca", idMarca)
      .gte("Metrica_Producto.fecha", desde);
    if (error) throw new Error(error.message);
    return data;
  },
};
