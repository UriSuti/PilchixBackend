import { supabase } from "../config/supabase.js";

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
};