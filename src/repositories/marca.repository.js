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

  async create({ nombre, email, passwordHash }) {
    const { data, error } = await supabase
      .from("Marca")
      .insert([{
        nombre,
        email,
        contraseña: passwordHash,
        estado: false,              // pendiente de aprobación
        ubicacion: "Sin especificar",
      }])
      .select("id_marca, nombre, email")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};