import { carritoRepository } from "../repositories/carrito.repository.js";

export const carritoService = {
  listar: (idUsuario) => carritoRepository.obtenerItems(idUsuario),

  async contarPiezas(idUsuario) {
    const cantidad = await carritoRepository.contarPiezas(idUsuario);
    return { cantidad };
  },

  async agregar(idUsuario, { idProducto, cantidad, precioUnitario, talle, color }) {
    const idCarrito = await carritoRepository.obtenerOCrear(idUsuario);
    const existente = await carritoRepository.buscarDetalleExistente(idCarrito, idProducto, talle ?? null, color ?? null);

    if (existente) {
      await carritoRepository.actualizarCantidadDetalle(existente.id_detalle, existente.cantidad + cantidad);
    } else {
      await carritoRepository.insertarDetalle({
        idCarrito,
        idProducto,
        cantidad,
        precioUnitario,
        talle: talle ?? null,
        color: color ?? null,
      });
    }
  },

  async actualizarCantidad(idUsuario, idDetalle, cantidad) {
    const esDueño = await carritoRepository.esDueñoDelDetalle(idDetalle, idUsuario);
    if (!esDueño) {
      const err = new Error("No encontrado");
      err.status = 404;
      throw err;
    }
    await carritoRepository.actualizarCantidadDetalle(idDetalle, cantidad);
  },

  async eliminarItem(idUsuario, idDetalle) {
    const esDueño = await carritoRepository.esDueñoDelDetalle(idDetalle, idUsuario);
    if (!esDueño) {
      const err = new Error("No encontrado");
      err.status = 404;
      throw err;
    }
    await carritoRepository.eliminarDetalle(idDetalle);
  },
};
