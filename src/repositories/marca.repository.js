import { supabase } from "../config/supabase.js";
import {
  CAMPOS_PRESENTACION, faltaColumnaOpcional, quitarColumnasOpcionales, selectConFallback,
} from "./columnas-opcionales.js";

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

  // "sonido_ambiente" y los campos de presentación (frase, horarios, etc.)
  // vienen de migraciones que quizá no corrieron todavía: en vez de que eso
  // rompa TODO el perfil, se reintenta sin esas columnas
  // (ver columnas-opcionales.js).
  async getPerfil(idMarca) {
    const CAMPOS_BASE = "id_marca, nombre, email, logo, descripcion, ubicacion, sitio_web, instagram, tiktok";
    return selectConFallback(
      [
        `${CAMPOS_BASE}, sonido_ambiente, ${CAMPOS_PRESENTACION}`,
        `${CAMPOS_BASE}, sonido_ambiente`,
        CAMPOS_BASE,
      ],
      (campos) => supabase.from("Marca").select(campos).eq("id_marca", idMarca).maybeSingle()
    );
  },

  async actualizarPerfil(idMarca, campos) {
    if (!campos || Object.keys(campos).length === 0) return;
    const { error } = await supabase.from("Marca").update(campos).eq("id_marca", idMarca);

    if (faltaColumnaOpcional(error)) {
      const resto = quitarColumnasOpcionales(campos);
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