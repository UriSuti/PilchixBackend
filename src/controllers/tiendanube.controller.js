import { tiendanubeService } from "../services/tiendanube.service.js";

export const tiendanubeController = {
  async listarTiendanube(req, res, next) {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "Falta el link de la tienda" });
      res.json(await tiendanubeService.listar(req.auth.id, url));
    } catch (err) { next(err); }
  },

  async importarProductoTiendanube(req, res, next) {
    try {
      const { url, idCategoria, categorias } = req.body;
      if (!url) return res.status(400).json({ error: "Falta el link del producto" });
      res.json(await tiendanubeService.importarProducto(req.auth.id, url, idCategoria, categorias));
    } catch (err) { next(err); }
  },
};
