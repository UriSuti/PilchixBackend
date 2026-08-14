import { supabase } from "../config/supabase.js";

export const compraRepository = {
  async buscarPorIdPagoMp(idPagoMp) {
    const { data, error } = await supabase
      .from("Compra")
      .select("id_compra")
      .eq("id_pago_mp", idPagoMp)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id_compra ?? null;
  },

  async getCarritoConDetalle(idUsuario) {
    const { data: carrito, error: eCarrito } = await supabase
      .from("Carrito")
      .select("id_carrito")
      .eq("id_usuario", idUsuario)
      .order("id_carrito", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eCarrito) throw new Error(eCarrito.message);
    if (!carrito) return null;

    const { data: detalles, error: eDetalle } = await supabase
      .from("Carrito_Detalle")
      .select("*")
      .eq("id_carrito", carrito.id_carrito);
    if (eDetalle) throw new Error(eDetalle.message);

    return { idCarrito: carrito.id_carrito, detalles: detalles ?? [] };
  },

  async registrarCompra({ idUsuario, idPagoMp, detalles }) {
    const montoTotal = detalles.reduce(
      (acc, d) => acc + d.precio_unitario * d.cantidad,
      0
    );

    const { data: compra, error: eCompra } = await supabase
      .from("Compra")
      .insert({ id_usuario: idUsuario, id_pago_mp: idPagoMp ?? null, monto_total: montoTotal })
      .select("id_compra")
      .single();
    if (eCompra) throw new Error(eCompra.message);

    const filas = detalles.map((d) => ({
      id_compra: compra.id_compra,
      id_producto: d.id_producto,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      talle: d.talle,
      color: d.color,
    }));
    const { error: eDetalle } = await supabase.from("Compra_Detalle").insert(filas);
    if (eDetalle) throw new Error(eDetalle.message);

    await this.registrarVentas(detalles);

    return compra.id_compra;
  },

  // Suma la cantidad vendida de cada línea a Metrica_Producto del día de hoy
  // (misma tabla que lee el dashboard de métricas de la marca). Si todavía no
  // hay fila para ese producto hoy, la crea.
  async registrarVentas(detalles) {
    const hoy = new Date().toISOString().slice(0, 10);

    for (const d of detalles) {
      const { data: fila, error: eSelect } = await supabase
        .from("Metrica_Producto")
        .select("id_producto, ventas")
        .eq("id_producto", d.id_producto)
        .eq("fecha", hoy)
        .maybeSingle();
      if (eSelect) throw new Error(eSelect.message);

      if (fila) {
        const { error: eUpdate } = await supabase
          .from("Metrica_Producto")
          .update({ ventas: (fila.ventas ?? 0) + d.cantidad })
          .eq("id_producto", d.id_producto)
          .eq("fecha", hoy);
        if (eUpdate) throw new Error(eUpdate.message);
      } else {
        const { error: eInsert } = await supabase
          .from("Metrica_Producto")
          .insert({ id_producto: d.id_producto, fecha: hoy, ventas: d.cantidad, visualizaciones: 0, clics: 0 });
        if (eInsert) throw new Error(eInsert.message);
      }
    }
  },

  async vaciarCarrito(idCarrito) {
    const { error } = await supabase
      .from("Carrito_Detalle")
      .delete()
      .eq("id_carrito", idCarrito);
    if (error) throw new Error(error.message);
  },
};
