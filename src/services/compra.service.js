import { compraRepository } from "../repositories/compra.repository.js";

export const compraService = {
  // Confía en que el frontend llama a esto tras volver de Mercado Pago con pago=aprobado.
  // No verifica el pago contra la API de MP todavía (pendiente: hacerlo cuando haya
  // credenciales de test/producción configuradas). Es idempotente: si el carrito ya
  // está vacío (por ejemplo, el usuario recarga la página de éxito) no hace nada.
  async confirmarCompra(idUsuario, idPagoMp) {
    const carrito = await compraRepository.getCarritoConDetalle(idUsuario);
    if (!carrito || carrito.detalles.length === 0) {
      return { ok: true, compra: null };
    }

    const idCompra = await compraRepository.registrarCompra({
      idUsuario,
      idPagoMp,
      detalles: carrito.detalles,
    });
    await compraRepository.vaciarCarrito(carrito.idCarrito);

    return { ok: true, compra: idCompra };
  },
};
