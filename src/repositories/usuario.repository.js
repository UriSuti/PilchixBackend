import { supabase } from "../config/supabase.js";

const BUCKET_FOTOS = "fotos-perfil";

export const usuarioRepository = {
  async findByEmail(email) {
    const { data, error } = await supabase
        .from("Usuario")
        .select("*")
        .eq("email", email)
        .maybeSingle();

    if (error) {
        console.error("ERROR SUPABASE COMPLETO:", JSON.stringify(error, null, 2));
        console.error("CAUSE:", error.cause);
        throw new Error(error.message);
    }
    return data;
    },

  async create({ nombre, email, passwordHash }) {
    const { data, error } = await supabase
      .from("Usuario")
      .insert([{ nombre, email, contraseña: passwordHash }])
      .select("id_usuario, nombre, email, foto_perfil")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async findById(id) {
    const { data, error } = await supabase
      .from("Usuario")
      .select("id_usuario, nombre, email, foto_perfil")
      .eq("id_usuario", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async actualizar(id, datos) {
    const { data, error } = await supabase
      .from("Usuario")
      .update(datos)
      .eq("id_usuario", id)
      .select("id_usuario, nombre, email, foto_perfil")
      .single();
    if (error) throw error;
    return data;
  },

  async subirFoto(idUsuario, buffer, nombreOriginal, mimetype) {
    const ext = nombreOriginal.split(".").pop();
    const nombre = `${idUsuario}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(nombre, buffer, { contentType: mimetype, upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(nombre);
    return data.publicUrl;
  },
};