import { catalogoService } from "../services/catalogo.service.js";

export const catalogoController = {
  async getCategorias(req, res, next) {
    try {
      const data = await catalogoService.getCategorias();
      res.json(data);
    } catch (err) { next(err); }
  },

  async getEtiquetas(req, res, next) {
    try {
      const data = await catalogoService.getEtiquetas(req.auth.id);
      res.json(data);
    } catch (err) { next(err); }
  },

  async crearEtiqueta(req, res, next) {
    try {
      const { nombre } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: "Falta el nombre de la etiqueta" });

      const data = await catalogoService.crearEtiqueta(nombre.trim(), req.auth.id);
      res.status(201).json(data);
    } catch (err) { next(err); }
  },

  async getSubcategorias(req, res, next) {
    try {
      const data = await catalogoService.getSubcategorias(req.query.id_categoria || null, req.auth.id);
      res.json(data);
    } catch (err) { next(err); }
  },

  async crearSubcategoria(req, res, next) {
    try {
      const { nombre, id_categoria } = req.body;
      if (!nombre?.trim()) return res.status(400).json({ error: "Falta el nombre de la subcategoría" });
      if (!id_categoria) return res.status(400).json({ error: "Falta la categoría de la subcategoría" });

      const data = await catalogoService.crearSubcategoria(nombre.trim(), id_categoria, req.auth.id);
      res.status(201).json(data);
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
      if (!Array.isArray(colores) || colores.length === 0) {
        return res.status(400).json({ error: "Agregá al menos un color al producto" });
      }

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
      if (!Array.isArray(colores) || colores.length === 0) {
        return res.status(400).json({ error: "Agregá al menos un color al producto" });
      }

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

  async setSubcategoriasProducto(req, res, next) {
    try {
      await catalogoService.setSubcategoriasProducto(req.params.idProducto, req.auth.id, req.body.idsSubcategorias ?? []);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async actualizarSubcategoriasProducto(req, res, next) {
    try {
      await catalogoService.actualizarSubcategoriasProducto(req.params.idProducto, req.auth.id, req.body.idsSubcategorias ?? []);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async setEtiquetasProducto(req, res, next) {
    try {
      await catalogoService.setEtiquetasProducto(req.params.idProducto, req.auth.id, req.body.idsEtiquetas ?? []);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async actualizarEtiquetasProducto(req, res, next) {
    try {
      await catalogoService.actualizarEtiquetasProducto(req.params.idProducto, req.auth.id, req.body.idsEtiquetas ?? []);
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

  async getDashboard(req, res, next) {
    try {
      const dias = Number(req.query.dias) || 30;
      res.json(await catalogoService.getDashboardData(req.auth.id, dias));
    } catch (err) { next(err); }
  },

  async getMetricas(req, res, next) {
    try {
      const dias = Number(req.query.dias) || 30;
      res.json(await catalogoService.getMetricasData(req.auth.id, dias));
    } catch (err) { next(err); }
  },
};