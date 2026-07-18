import { supabase } from "../config/supabase.js";

export const marcaRepository = {
  async findByEmail(email) {
    const { data, error } = await supabase
      .from("Marca")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async create({ nombre, email, passwordHash, descripcion, ubicacion }) {
    const { data, error } = await supabase
      .from("Marca")
      .insert([{
        nombre,
        email,
        contraseña: passwordHash,
        estado: true,                              // el local queda activo al registrarse
        descripcion: descripcion?.trim() || null,
        ubicacion: ubicacion?.trim() || "Sin especificar",
      }])
      .select("id_marca, nombre, email, logo, descripcion, ubicacion, estado")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};