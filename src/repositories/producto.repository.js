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

  // ocasión/estilo de la prenda (noche, boliche, elegante, etc.). id_marca null = etiqueta
  // general (visible para todas las marcas); seteado = privada de esa marca.
  async getEtiquetas(idMarca) {
    const { data, error } = await supabase
      .from("Etiqueta")
      .select("id_etiqueta, nombre, id_marca")
      .or(`id_marca.is.null,id_marca.eq.${idMarca}`)
      .order("nombre");
    if (error) throw new Error(error.message);
    return data;
  },

  async crearEtiqueta(nombre, idMarca) {
    const { data, error } = await supabase
      .from("Etiqueta")
      .insert([{ nombre, id_marca: idMarca }])
      .select("id_etiqueta, nombre, id_marca")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // subcategorias: siempre privadas de la marca que las creó, dentro de una categoria general
  async getSubcategorias(idCategoria, idMarca) {
    let query = supabase
      .from("Subcategoria")
      .select("id_subcategoria, nombre, id_categoria, id_marca")
      .eq("id_marca", idMarca)
      .order("nombre");
    if (idCategoria) query = query.eq("id_categoria", idCategoria);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  },

  async crearSubcategoria(nombre, idCategoria, idMarca) {
    const { data, error } = await supabase
      .from("Subcategoria")
      .insert([{ nombre, id_categoria: idCategoria, id_marca: idMarca }])
      .select("id_subcategoria, nombre, id_categoria, id_marca")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getProductosDeMarca(idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select(`
        id_producto, nombre, descripcion, precio, stock, estado, fecha_alta,
        Imagen ( imagen, es_portada ),
        Descuento ( porcentaje, precio_final, fecha_fin )
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
        Producto_Categoria ( id_categoria ),
        Producto_Subcategoria ( id_subcategoria ),
        Producto_Etiqueta ( id_etiqueta )
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

  // precio + confirmación de propiedad en una sola consulta, para armar el descuento
  async getProductoParaDescuento(idProducto, idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select("id_producto, precio")
      .eq("id_producto", idProducto)
      .eq("id_marca", idMarca)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async getDescuentoDeProducto(idProducto) {
    const { data, error } = await supabase
      .from("Descuento")
      .select("id_descuento, porcentaje, precio_anterior, precio_final, fecha_inicio, fecha_fin")
      .eq("id_producto", idProducto)
      .order("id_descuento", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // un solo descuento vigente por producto: el nuevo reemplaza cualquier otro existente
  async setDescuentoProducto(idProducto, datos) {
    const { error: errorDelete } = await supabase.from("Descuento").delete().eq("id_producto", idProducto);
    if (errorDelete) throw new Error(errorDelete.message);

    const { data, error } = await supabase
      .from("Descuento")
      .insert([{ id_producto: idProducto, ...datos }])
      .select("id_descuento, porcentaje, precio_anterior, precio_final, fecha_inicio, fecha_fin")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async quitarDescuentoProducto(idProducto) {
    const { error } = await supabase.from("Descuento").delete().eq("id_producto", idProducto);
    if (error) throw new Error(error.message);
  },

  async borrarProducto(idProducto, idMarca) {
    const esPropietario = await this.esPropietario(idProducto, idMarca);
    if (!esPropietario) return false;

    await supabase.from("Imagen").delete().eq("id_producto", idProducto);
    await supabase.from("Producto_Categoria").delete().eq("id_producto", idProducto);
    await supabase.from("Producto_Subcategoria").delete().eq("id_producto", idProducto);
    await supabase.from("Metrica_Producto").delete().eq("id_producto", idProducto);
    await supabase.from("Producto_Etiqueta").delete().eq("id_producto", idProducto);
    await supabase.from("Descuento").delete().eq("id_producto", idProducto);
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

  async setSubcategoriasProducto(idProducto, idsSubcategorias) {
    if (!idsSubcategorias.length) return;
    const filas = idsSubcategorias.map((id_subcategoria) => ({ id_producto: idProducto, id_subcategoria }));
    const { error } = await supabase.from("Producto_Subcategoria").insert(filas);
    if (error) throw new Error(error.message);
  },

  async actualizarSubcategoriasProducto(idProducto, idsSubcategorias) {
    const { error: errorDelete } = await supabase
      .from("Producto_Subcategoria")
      .delete()
      .eq("id_producto", idProducto);
    if (errorDelete) throw new Error(errorDelete.message);
    await this.setSubcategoriasProducto(idProducto, idsSubcategorias);
  },

  async setEtiquetasProducto(idProducto, idsEtiquetas) {
    if (!idsEtiquetas.length) return;
    const filas = idsEtiquetas.map((id_etiqueta) => ({ id_producto: idProducto, id_etiqueta }));
    const { error } = await supabase.from("Producto_Etiqueta").insert(filas);
    if (error) throw new Error(error.message);
  },

  async actualizarEtiquetasProducto(idProducto, idsEtiquetas) {
    const { error: errorDelete } = await supabase
      .from("Producto_Etiqueta")
      .delete()
      .eq("id_producto", idProducto);
    if (errorDelete) throw new Error(errorDelete.message);
    await this.setEtiquetasProducto(idProducto, idsEtiquetas);
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