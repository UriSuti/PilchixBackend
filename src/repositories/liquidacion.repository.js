import { supabase } from "../config/supabase.js";

const BUCKET = "comprobantes";
const URL_FIRMADA_SEG = 60 * 10;

export const liquidacionRepository = {
  async findAdminByEmail(email) {
    const { data, error } = await supabase
      .from("Admin")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  // todas las ventas por cobrar de todas las marcas, más viejas primero
  async getVentasPendientes() {
    const { data, error } = await supabase
      .from("Venta_Marca")
      .select(`
        id_venta, id_compra, id_marca, monto, fecha,
        Marca ( nombre, logo, email ),
        Compra ( Usuario ( nombre, email ) )
      `)
      .eq("estado", "por_cobrar")
      .order("fecha", { ascending: true });
    if (error) throw new Error(error.message);
    return data.map(({ Marca, Compra, ...v }) => ({
      ...v,
      monto: Number(v.monto),
      marca: Marca,
      comprador: Compra?.Usuario ?? null,
    }));
  },

  async subirComprobante(buffer, nombreOriginal, mimetype) {
    const ext = nombreOriginal.split(".").pop();
    const path = `liquidacion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimetype });
    if (error) throw new Error(error.message);
    return path;
  },

  async borrarComprobante(path) {
    await supabase.storage.from(BUCKET).remove([path]);
  },

  async urlComprobante(path) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, URL_FIRMADA_SEG);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },

  // crea la liquidación y marca las ventas como cobradas (atómico, ver liquidar_ventas en SQL)
  async liquidar({ ids, comprobante, nota, idAdmin }) {
    const { data, error } = await supabase.rpc("liquidar_ventas", {
      p_ids: ids,
      p_comprobante: comprobante,
      p_nota: nota,
      p_id_admin: idAdmin,
    });
    if (error) {
      const err = new Error(error.message);
      err.status = 409;
      throw err;
    }
    return data;
  },

  async getLiquidaciones() {
    const { data, error } = await supabase
      .from("Liquidacion")
      .select(`
        id_liquidacion, monto, nota, fecha,
        Admin ( nombre ),
        Venta_Marca ( id_venta, id_marca, monto, Marca ( nombre ) )
      `)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    return data.map(({ Admin, Venta_Marca, ...l }) => {
      const marcas = new Map();
      for (const v of Venta_Marca) {
        const m = marcas.get(v.id_marca) ?? { id_marca: v.id_marca, nombre: v.Marca?.nombre, monto: 0, ventas: 0 };
        m.monto += Number(v.monto);
        m.ventas += 1;
        marcas.set(v.id_marca, m);
      }
      return {
        ...l,
        monto: Number(l.monto),
        admin: Admin?.nombre ?? null,
        cantidadVentas: Venta_Marca.length,
        marcas: [...marcas.values()],
      };
    });
  },

  async getComprobanteDe(idLiquidacion) {
    const { data, error } = await supabase
      .from("Liquidacion")
      .select("comprobante")
      .eq("id_liquidacion", idLiquidacion)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.comprobante ?? null;
  },
};
