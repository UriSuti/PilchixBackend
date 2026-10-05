import { ventaRepository } from "../repositories/venta.repository.js";
import { superadminService } from "./superadmin.service.js";

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

  // la marca solo puede ver comprobantes de pagos que incluyen ventas suyas
  async urlComprobante(idMarca, idLiquidacion) {
    if (!(await ventaRepository.marcaTieneLiquidacion(idMarca, idLiquidacion))) {
      const err = new Error("Comprobante no encontrado");
      err.status = 404;
      throw err;
    }
    return superadminService.urlComprobante(idLiquidacion);
  },
};
