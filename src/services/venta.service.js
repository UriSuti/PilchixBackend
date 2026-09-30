import { ventaRepository } from "../repositories/venta.repository.js";

export const ventaService = {
  // lista de ventas + resumen de cashflow (lo cobrado y lo que falta cobrar)
  async getVentas(idMarca) {
    const ventas = await ventaRepository.getVentasDeMarca(idMarca);
    const sumar = (estado) =>
      ventas.filter((v) => v.estado === estado).reduce((acc, v) => acc + v.monto, 0);
    return {
      resumen: {
        cobrado: sumar("cobrado"),
        porCobrar: sumar("por_cobrar"),
        cantidadVentas: ventas.length,
      },
      ventas,
    };
  },
};
