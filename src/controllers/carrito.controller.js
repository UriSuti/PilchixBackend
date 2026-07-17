import { carritoService } from "../services/carrito.service.js";

export const carritoController = {
  async listar(req, res, next) {
    try {
      res.json(await carritoService.listar(req.auth.id));
    } catch (err) { next(err); }
  },

  async resumen(req, res, next) {
    try {
      res.json(await carritoService.contarPiezas(req.auth.id));
    } catch (err) { next(err); }
  },

  async agregar(req, res, next) {
    try {
      const { idProducto, cantidad, precioUnitario, talle, color } = req.body;
      if (!idProducto || !cantidad) return res.status(400).json({ error: "Faltan datos del producto" });
      await carritoService.agregar(req.auth.id, { idProducto, cantidad, precioUnitario, talle, color });
      res.status(201).json({ ok: true });
    } catch (err) { next(err); }
  },

  async actualizarCantidad(req, res, next) {
    try {
      const { cantidad } = req.body;
      if (!cantidad || cantidad < 1) return res.status(400).json({ error: "Cantidad inválida" });
      await carritoService.actualizarCantidad(req.auth.id, req.params.idDetalle, cantidad);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async eliminar(req, res, next) {
    try {
      await carritoService.eliminarItem(req.auth.id, req.params.idDetalle);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
