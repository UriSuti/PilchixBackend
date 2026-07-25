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

  async getPerfil(idMarca) {
    const { data, error } = await supabase
      .from("Marca")
      .select("id_marca, nombre, email, logo, descripcion, ubicacion, sitio_web, instagram, tiktok")
      .eq("id_marca", idMarca)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async actualizarPerfil(idMarca, campos) {
    if (!campos || Object.keys(campos).length === 0) return;
    const { error } = await supabase.from("Marca").update(campos).eq("id_marca", idMarca);
    if (error) throw new Error(error.message);
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