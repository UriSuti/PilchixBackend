import { compraRepository } from "../repositories/compra.repository.js";
import { mpPayment } from "../config/mercadopago.js";

const TOLERANCIA_MONTO = 1; // margen en pesos por redondeos de MP

export const compraService = {
  // Se llama cuando el frontend vuelve de Mercado Pago con pago=aprobado.
  // Verifica el pago contra la API de MP (no confía en el query param): el pago
  // tiene que existir, estar aprobado y coincidir en monto con el carrito actual.
  // Es idempotente: si ese id_pago_mp ya generó una Compra, devuelve esa misma
  // en vez de duplicarla (evita reusar el mismo pago dos veces o por un refresh).
  async confirmarCompra(idUsuario, idPagoMp) {
    if (!idPagoMp) {
      const err = new Error("Falta el id del pago");
      err.status = 400;
      throw err;
    }

    const idCompraExistente = await compraRepository.buscarPorIdPagoMp(idPagoMp);
    if (idCompraExistente) {
      return { ok: true, compra: idCompraExistente };
    }

    const carrito = await compraRepository.getCarritoConDetalle(idUsuario);
    if (!carrito || carrito.detalles.length === 0) {
      return { ok: true, compra: null };
    }

    const pago = await mpPayment.get({ id: idPagoMp });
    if (pago.status !== "approved") {
      const err = new Error("El pago no está aprobado");
      err.status = 400;
      throw err;
    }

    const montoCarrito = carrito.detalles.reduce(
      (acc, d) => acc + d.precio_unitario * d.cantidad,
      0
    );
    if (Math.abs(pago.transaction_amount - montoCarrito) > TOLERANCIA_MONTO) {
      const err = new Error("El monto pagado no coincide con el carrito");
      err.status = 400;
      throw err;
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
