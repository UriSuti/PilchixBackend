import { supabase } from "../config/supabase.js";

const BUCKET_FOTOS = "fotos-perfil";

export const marcaRepository = {
  async subirImagen(idMarca, buffer, nombreOriginal, mimetype, prefijo) {
    const ext = nombreOriginal.split(".").pop();
    const nombre = `${prefijo}-${idMarca}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(nombre, buffer, { contentType: mimetype, upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(nombre);
    return data.publicUrl;
  },

  async findByEmail(email) {
    const { data, error } = await supabase
      .from("Marca")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // "sonido_ambiente" se agregó en scripts/sql/2026-08-31_sonido_ambiente.sql.
  // Hasta que esa migración corra en la base, la columna no existe todavía y
  // Supabase rechaza cualquier select/update que la mencione — en vez de que
  // eso rompa TODO el perfil (incluidos campos que nada tienen que ver), se
  // reintenta sin esa columna. Una vez corrida la migración, esto deja de
  // hacer falta solo (el primer intento, con la columna, pasa a funcionar).
  async getPerfil(idMarca) {
    const CAMPOS_BASE = "id_marca, nombre, email, logo, descripcion, ubicacion, sitio_web, instagram, tiktok";
    let { data, error } = await supabase
      .from("Marca")
      .select(`${CAMPOS_BASE}, sonido_ambiente`)
      .eq("id_marca", idMarca)
      .maybeSingle();

    if (error?.message?.includes("sonido_ambiente")) {
      ({ data, error } = await supabase
        .from("Marca")
        .select(CAMPOS_BASE)
        .eq("id_marca", idMarca)
        .maybeSingle());
    }
    if (error) throw new Error(error.message);
    return data;
  },

  async actualizarPerfil(idMarca, campos) {
    if (!campos || Object.keys(campos).length === 0) return;
    const { error } = await supabase.from("Marca").update(campos).eq("id_marca", idMarca);

    if (error?.message?.includes("sonido_ambiente") && "sonido_ambiente" in campos) {
      const { sonido_ambiente, ...resto } = campos;
      if (Object.keys(resto).length === 0) return; // no había nada más para guardar
      const { error: error2 } = await supabase.from("Marca").update(resto).eq("id_marca", idMarca);
      if (error2) throw new Error(error2.message);
      return;
    }
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