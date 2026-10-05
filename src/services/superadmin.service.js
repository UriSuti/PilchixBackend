import { liquidacionRepository } from "../repositories/liquidacion.repository.js";

export const superadminService = {
  // ventas por cobrar agrupadas por local, con el total de cada uno
  async getPendientes() {
    const ventas = await liquidacionRepository.getVentasPendientes();
    const locales = new Map();
    for (const v of ventas) {
      const local = locales.get(v.id_marca) ?? {
        id_marca: v.id_marca,
        nombre: v.marca?.nombre ?? `Marca #${v.id_marca}`,
        logo: v.marca?.logo ?? null,
        email: v.marca?.email ?? null,
        total: 0,
        ventas: [],
      };
      local.total += v.monto;
      local.ventas.push({ id_venta: v.id_venta, id_compra: v.id_compra, monto: v.monto, fecha: v.fecha, comprador: v.comprador });
      locales.set(v.id_marca, local);
    }
    const lista = [...locales.values()].sort((a, b) => b.total - a.total);
    return {
      resumen: {
        total: ventas.reduce((acc, v) => acc + v.monto, 0),
        cantidadVentas: ventas.length,
        cantidadLocales: lista.length,
      },
      locales: lista,
    };
  },

  // sube el comprobante y liquida las ventas; si la liquidación falla, borra el archivo
  async liquidar({ ids, archivo, nota, idAdmin }) {
    const comprobante = await liquidacionRepository.subirComprobante(
      archivo.buffer, archivo.originalname, archivo.mimetype
    );
    try {
      const idLiquidacion = await liquidacionRepository.liquidar({ ids, comprobante, nota, idAdmin });
      return { id_liquidacion: idLiquidacion };
    } catch (err) {
      await liquidacionRepository.borrarComprobante(comprobante);
      throw err;
    }
  },

  getLiquidaciones: () => liquidacionRepository.getLiquidaciones(),

  async urlComprobante(idLiquidacion) {
    const path = await liquidacionRepository.getComprobanteDe(idLiquidacion);
    if (!path) {
      const err = new Error("Liquidación no encontrada");
      err.status = 404;
      throw err;
    }
    return { url: await liquidacionRepository.urlComprobante(path) };
  },
};
