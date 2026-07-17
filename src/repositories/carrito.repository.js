import { supabase } from "../config/supabase.js";

export const carritoRepository = {
  async obtenerOCrear(idUsuario) {
    const { data: existente, error: eBuscar } = await supabase
      .from("Carrito")
      .select("id_carrito")
      .eq("id_usuario", idUsuario)
      .order("id_carrito", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eBuscar) throw new Error(eBuscar.message);
    if (existente) return existente.id_carrito;

    const { data: creado, error: eCrear } = await supabase
      .from("Carrito")
      .insert({ id_usuario: idUsuario })
      .select("id_carrito")
      .single();
    if (eCrear) throw new Error(eCrear.message);
    return creado.id_carrito;
  },

  async buscarDetalleExistente(idCarrito, idProducto, talle, color) {
    const { data, error } = await supabase
      .from("Carrito_Detalle")
      .select("id_detalle, cantidad")
      .eq("id_carrito", idCarrito)
      .eq("id_producto", idProducto)
      .eq("talle", talle)
      .eq("color", color)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async actualizarCantidadDetalle(idDetalle, cantidad) {
    const { error } = await supabase
      .from("Carrito_Detalle")
      .update({ cantidad })
      .eq("id_detalle", idDetalle);
    if (error) throw new Error(error.message);
  },

  async insertarDetalle({ idCarrito, idProducto, cantidad, precioUnitario, talle, color }) {
    const { error } = await supabase.from("Carrito_Detalle").insert({
      id_carrito: idCarrito,
      id_producto: idProducto,
      cantidad,
      precio_unitario: precioUnitario,
      talle,
      color,
    });
    if (error) throw new Error(error.message);
  },

  async obtenerItems(idUsuario) {
    const { data: carrito, error: eCarrito } = await supabase
      .from("Carrito")
      .select("id_carrito")
      .eq("id_usuario", idUsuario)
      .order("id_carrito", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eCarrito) throw new Error(eCarrito.message);
    if (!carrito) return [];

    const { data: detalles, error: eDetalles } = await supabase
      .from("Carrito_Detalle")
      .select("*")
      .eq("id_carrito", carrito.id_carrito);
    if (eDetalles) throw new Error(eDetalles.message);
    if (!detalles.length) return [];

    const idsProducto = detalles.map((d) => d.id_producto);
    const { data: productos, error: eProductos } = await supabase
      .from("Producto")
      .select("id_producto, nombre, Imagen(imagen, es_portada)")
      .in("id_producto", idsProducto);
    if (eProductos) throw new Error(eProductos.message);

    const productoPorId = Object.fromEntries(productos.map((p) => [p.id_producto, p]));

    // portada: la marcada como es_portada, o si no hay ninguna, la primera del array
    const portadaDe = (imagenes) => {
      if (!imagenes || imagenes.length === 0) return null;
      return (imagenes.find((img) => img.es_portada) ?? imagenes[0]).imagen;
    };

    return detalles.map((d) => ({
      id_detalle: d.id_detalle,
      id: d.id_producto,
      nombre: productoPorId[d.id_producto]?.nombre ?? "",
      precio: d.precio_unitario,
      color: d.color,
      talle: d.talle,
      cantidad: d.cantidad,
      imagen: portadaDe(productoPorId[d.id_producto]?.Imagen),
    }));
  },

  async contarPiezas(idUsuario) {
    const { data: carrito, error: eCarrito } = await supabase
      .from("Carrito")
      .select("id_carrito")
      .eq("id_usuario", idUsuario)
      .order("id_carrito", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eCarrito) throw new Error(eCarrito.message);
    if (!carrito) return 0;

    const { data, error } = await supabase
      .from("Carrito_Detalle")
      .select("cantidad")
      .eq("id_carrito", carrito.id_carrito);
    if (error) throw new Error(error.message);
    return data.reduce((acc, d) => acc + (d.cantidad || 0), 0);
  },

  // dueño real del detalle (para no permitir tocar el carrito de otro usuario)
  async esDueñoDelDetalle(idDetalle, idUsuario) {
    const { data, error } = await supabase
      .from("Carrito_Detalle")
      .select("id_detalle, Carrito!inner(id_usuario)")
      .eq("id_detalle", idDetalle)
      .eq("Carrito.id_usuario", idUsuario)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  },

  async eliminarDetalle(idDetalle) {
    const { error } = await supabase.from("Carrito_Detalle").delete().eq("id_detalle", idDetalle);
    if (error) throw new Error(error.message);
  },
};
