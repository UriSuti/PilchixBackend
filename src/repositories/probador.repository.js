import { supabase } from "../config/supabase.js";

const BUCKET = "pruebas-virtuales";

export const probadorRepository = {
  async contarUsosUltimas24hs(idUsuario) {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // ojo: sin head:true a propósito. Con head:true, si la tabla no existe
    // (ej. falta correr la migración) supabase-js devuelve 204/count:null sin
    // error, y esto quedaría leyéndose como "0 usos" en vez de fallar fuerte.
    const { count, error } = await supabase
      .from("Prueba_Virtual")
      .select("id_prueba", { count: "exact" })
      .eq("id_usuario", idUsuario)
      .gte("fecha", desde);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  // guarda el resultado en storage (no la foto original del usuario, solo la
  // imagen ya generada) para poder mostrar el historial en el perfil
  async subirResultado(buffer, mimetype, idUsuario) {
    const ext = mimetype.split("/").pop() || "png";
    const nombre = `${idUsuario}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, buffer, { contentType: mimetype });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
    return data.publicUrl;
  },

  async registrarUso(idUsuario, idProducto, imagenUrl) {
    const { error } = await supabase
      .from("Prueba_Virtual")
      .insert([{ id_usuario: idUsuario, id_producto: idProducto, imagen: imagenUrl }]);
    if (error) throw new Error(error.message);
  },

  async getHistorial(idUsuario) {
    const { data, error } = await supabase
      .from("Prueba_Virtual")
      .select(`
        id_prueba, imagen, fecha,
        Producto ( id_producto, nombre )
      `)
      .eq("id_usuario", idUsuario)
      .not("imagen", "is", null)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },
};
