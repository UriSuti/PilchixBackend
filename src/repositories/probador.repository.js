import { supabase } from "../config/supabase.js";

const BUCKET = "pruebas-virtuales";

// de la URL pública de supabase saca el path dentro del bucket
function pathDesdeUrl(url) {
  const marca = `/object/public/${BUCKET}/`;
  const i = url?.indexOf(marca) ?? -1;
  return i === -1 ? null : decodeURIComponent(url.slice(i + marca.length));
}

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
        Producto ( id_producto, nombre, precio, Imagen ( imagen, es_portada ) )
      `)
      .eq("id_usuario", idUsuario)
      .not("imagen", "is", null)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  },

  // "borra" una prueba del historial: se va el archivo y se limpia la imagen,
  // pero la fila queda para que siga contando en el límite diario
  async borrarPrueba(idUsuario, idPrueba) {
    const { data: prueba, error } = await supabase
      .from("Prueba_Virtual")
      .select("id_prueba, imagen")
      .eq("id_prueba", idPrueba)
      .eq("id_usuario", idUsuario)          // ← autorización
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!prueba) return false;

    await this.borrarArchivo(prueba.imagen);
    const { error: eUpdate } = await supabase
      .from("Prueba_Virtual")
      .update({ imagen: null })
      .eq("id_prueba", idPrueba);
    if (eUpdate) throw new Error(eUpdate.message);
    return true;
  },

  /* ---------- foto guardada del usuario (para no subirla cada vez) ---------- */
  async getFotoProbador(idUsuario) {
    const { data, error } = await supabase
      .from("Usuario")
      .select("foto_probador")
      .eq("id_usuario", idUsuario)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.foto_probador ?? null;
  },

  async setFotoProbador(idUsuario, url) {
    const { error } = await supabase
      .from("Usuario")
      .update({ foto_probador: url })
      .eq("id_usuario", idUsuario);
    if (error) throw new Error(error.message);
  },

  async subirFotoModelo(buffer, mimetype, idUsuario) {
    const ext = mimetype.split("/").pop() || "jpg";
    const nombre = `modelos/${idUsuario}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(nombre, buffer, { contentType: mimetype });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
    return data.publicUrl;
  },

  // si falla el borrado del archivo no cortamos: lo importante es la base
  async borrarArchivo(url) {
    const path = pathDesdeUrl(url);
    if (!path) return;
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) console.error("No se pudo borrar el archivo del probador:", error.message);
  },
};
