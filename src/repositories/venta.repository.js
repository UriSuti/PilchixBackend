import { supabase } from "../config/supabase.js";

export const ventaRepository = {
  // Agrupa las líneas de una compra por marca y crea una Venta_Marca por cada
  // una, en estado 'por_cobrar'. Es idempotente por (id_compra, id_marca).
  async registrarVentasDeCompra(idCompra, detalles) {
    const idsProducto = [...new Set(detalles.map((d) => d.id_producto))];
    const { data: productos, error: eProd } = await supabase
      .from("Producto")
      .select("id_producto, id_marca")
      .in("id_producto", idsProducto);
    if (eProd) throw new Error(eProd.message);

    const marcaDe = new Map(productos.map((p) => [p.id_producto, p.id_marca]));
    const montoPorMarca = new Map();
    for (const d of detalles) {
      const idMarca = marcaDe.get(d.id_producto);
      if (!idMarca) continue;
      montoPorMarca.set(idMarca, (montoPorMarca.get(idMarca) ?? 0) + d.precio_unitario * d.cantidad);
    }
    if (montoPorMarca.size === 0) return;

    const filas = [...montoPorMarca].map(([idMarca, monto]) => ({
      id_compra: idCompra,
      id_marca: idMarca,
      monto,
    }));
    const { error } = await supabase
      .from("Venta_Marca")
      .upsert(filas, { onConflict: "id_compra,id_marca", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  },

  // true si la liquidación incluye al menos una venta de la marca
  async marcaTieneLiquidacion(idMarca, idLiquidacion) {
    const { count, error } = await supabase
      .from("Venta_Marca")
      .select("id_venta", { count: "exact", head: true })
      .eq("id_marca", idMarca)
      .eq("id_liquidacion", idLiquidacion);
    if (error) throw new Error(error.message);
    return count > 0;
  },

  // ventas de la marca, más nuevas primero, con el comprador y solo las líneas de sus productos
  async getVentasDeMarca(idMarca) {
    const { data: ventas, error } = await supabase
      .from("Venta_Marca")
      .select(`
        id_venta, id_compra, monto, estado, fecha, fecha_cobro, id_liquidacion,
        Compra ( id_usuario, Usuario ( nombre, email ) )
      `)
      .eq("id_marca", idMarca)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);
    if (!ventas.length) return [];

    const { data: lineas, error: eLineas } = await supabase
      .from("Compra_Detalle")
      .select("id_compra, cantidad, precio_unitario, talle, color, Producto!inner ( id_producto, nombre, id_marca )")
      .in("id_compra", ventas.map((v) => v.id_compra))
      .eq("Producto.id_marca", idMarca);
    if (eLineas) throw new Error(eLineas.message);

    return ventas.map(({ Compra, ...v }) => ({
      ...v,
      monto: Number(v.monto),
      comprador: Compra?.Usuario ?? null,
      items: lineas
        .filter((l) => l.id_compra === v.id_compra)
        .map((l) => ({
          id_producto: l.Producto.id_producto,
          nombre: l.Producto.nombre,
          cantidad: l.cantidad,
          precio_unitario: l.precio_unitario,
          talle: l.talle,
          color: l.color,
        })),
    }));
  },
};
