import { catalogoService } from "../services/catalogo.service.js";

export const catalogoController = {
  async getCategorias(req, res, next) {
    try {
      const data = await catalogoService.getCategorias();
      res.json(data);
    } catch (err) { next(err); }
  },

  async getProductosDeMarca(req, res, next) {
    try {
      const data = await catalogoService.getProductosDeMarca(req.auth.id);
      res.json(data);
    } catch (err) { next(err); }
  },

  async getProductoPorId(req, res, next) {
    try {
      const data = await catalogoService.getProductoPorId(req.params.idProducto, req.auth.id);
      res.json(data);
    } catch (err) { next(err); }
  },

  async crearProducto(req, res, next) {
    try {
      const { nombre, descripcion, precio, stock, estado, guia_talles, colores } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: "Falta el nombre del producto" });

      const idProducto = await catalogoService.crearProducto(req.auth.id, {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        precio: Number(precio) || 0,
        stock: Number(stock) || 0,
        estado: estado ?? true,
        guia_talles: guia_talles ?? [],
        colores: colores ?? [],
      });
      res.status(201).json({ idProducto });
    } catch (err) { next(err); }
  },

  async actualizarProducto(req, res, next) {
    try {
      const { nombre, descripcion, precio, stock, estado, guia_talles, colores } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: "Falta el nombre del producto" });

      await catalogoService.actualizarProducto(req.params.idProducto, req.auth.id, {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        precio: Number(precio) || 0,
        stock: Number(stock) || 0,
        estado: estado ?? true,
        guia_talles: guia_talles ?? [],
        colores: colores ?? [],
      });
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async borrarProducto(req, res, next) {
    try {
      await catalogoService.borrarProducto(req.params.idProducto, req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async setCategoriasProducto(req, res, next) {
    try {
      await catalogoService.setCategoriasProducto(req.params.idProducto, req.auth.id, req.body.idsCategorias ?? []);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async actualizarCategoriasProducto(req, res, next) {
    try {
      await catalogoService.actualizarCategoriasProducto(req.params.idProducto, req.auth.id, req.body.idsCategorias ?? []);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async subirImagenesProducto(req, res, next) {
    try {
      const files = req.files ?? [];
      if (!files.length) return res.status(400).json({ error: "No se enviaron imágenes" });

      let metaPorArchivo = [];
      try { metaPorArchivo = JSON.parse(req.body.meta ?? "[]"); } catch { /* queda [] */ }

      const data = await catalogoService.subirImagenesProducto(req.params.idProducto, req.auth.id, files, metaPorArchivo);
      res.status(201).json(data);
    } catch (err) { next(err); }
  },

  async marcarPortada(req, res, next) {
    try {
      await catalogoService.marcarPortada(req.params.idProducto, req.params.idImagen, req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async actualizarColorImagen(req, res, next) {
    try {
      await catalogoService.actualizarColorImagen(req.params.idImagen, req.auth.id, req.body.color ?? "");
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async borrarImagen(req, res, next) {
    try {
      await catalogoService.borrarImagen(req.params.idImagen, req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
