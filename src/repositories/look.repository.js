import { supabase } from "../config/supabase.js";

const BUCKET = "productos";

export const lookRepository = {
  // looks activos para la landing: marca + productos etiquetados (con portada)
  async getPublicos() {
    const { data, error } = await supabase
      .from("Look")
      .select(`
        id_look, titulo, imagen, imagen_hover, fecha,
        Marca ( id_marca, nombre, logo ),
        Look_Producto (
          pos_x, pos_y,
          Producto (
            id_producto, nombre, precio, estado,
            Imagen ( imagen, es_portada ),
            Marca ( nombre )
          )
        )
      `)
      .eq("estado", true)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  // looks de una marca (para el back-office)
  async getDeMarca(idMarca) {
    const { data, error } = await supabase
      .from("Look")
      .select(`
        id_look, titulo, imagen, imagen_hover, estado, fecha,
        Look_Producto (
          pos_x, pos_y,
          Producto ( id_producto, nombre, precio, Imagen ( imagen, es_portada ) )
        )
      `)
      .eq("id_marca", idMarca)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  async esPropietario(idLook, idMarca) {
    const { data, error } = await supabase
      .from("Look")
      .select("id_look")
      .eq("id_look", idLook)
      .eq("id_marca", idMarca)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async subirImagen(buffer, nombreOriginal, mimetype) {
    const ext = nombreOriginal.split(".").pop();
    const nombre = `look-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, buffer, { contentType: mimetype });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
    return data.publicUrl;
  },

  async crear({ id_marca, titulo, imagen, imagen_hover }) {
    const { data, error } = await supabase
      .from("Look")
      .insert({ id_marca, titulo: titulo || null, imagen, imagen_hover: imagen_hover || null })
      .select("id_look, titulo, imagen, imagen_hover, estado, fecha")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  // reemplaza los productos etiquetados del look
  async setProductos(idLook, productos) {
    const { error: errDel } = await supabase.from("Look_Producto").delete().eq("id_look", idLook);
    if (errDel) throw new Error(errDel.message);
    if (!productos.length) return;
    const filas = productos.map((p) => ({
      id_look: idLook,
      id_producto: p.id_producto,
      pos_x: p.pos_x ?? null,
      pos_y: p.pos_y ?? null,
    }));
    const { error } = await supabase.from("Look_Producto").insert(filas);
    if (error) throw new Error(error.message);
  },

  async getImagenes(idLook) {
    const { data } = await supabase
      .from("Look").select("imagen, imagen_hover").eq("id_look", idLook).maybeSingle();
    return [data?.imagen, data?.imagen_hover].filter(Boolean);
  },

  async borrar(idLook) {
    const urls = await this.getImagenes(idLook);
    const { error } = await supabase.from("Look").delete().eq("id_look", idLook); // Look_Producto cae por cascade
    if (error) throw new Error(error.message);
    const nombres = urls.map((u) => u.split("/").pop());
    if (nombres.length) await supabase.storage.from(BUCKET).remove(nombres);
  },
};
