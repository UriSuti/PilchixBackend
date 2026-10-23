import { supabase } from "../config/supabase.js";

// productos que la marca ya importó (por su URL de origen), para no duplicarlos
export const importacionRepository = {
  async origenesImportados(idMarca) {
    const { data, error } = await supabase
      .from("Producto")
      .select("origen_url")
      .eq("id_marca", idMarca)
      .not("origen_url", "is", null);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => r.origen_url));
  },

  async buscarPorOrigen(idMarca, url) {
    const { data, error } = await supabase
      .from("Producto")
      .select("id_producto")
      .eq("id_marca", idMarca)
      .eq("origen_url", url)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id_producto ?? null;
  },
};
