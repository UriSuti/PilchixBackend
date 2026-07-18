import { lookService } from "../services/look.service.js";

// acepta [1, 2, 3] o [{ id_producto, pos_x?, pos_y? }, ...] (viene como string en multipart)
function parseProductos(raw) {
  if (!raw) return [];
  let arr;
  try {
    arr = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => (typeof p === "object" && p !== null ? p : { id_producto: p }))
    .filter((p) => p.id_producto != null);
}

export const lookController = {
  // público (landing)
  async getPublicos(req, res, next) {
    try {
      res.json(await lookService.getPublicos());
    } catch (err) { next(err); }
  },

  // back-office: looks de la marca logueada
  async getMisLooks(req, res, next) {
    try {
      res.json(await lookService.getDeMarca(req.auth.id));
    } catch (err) { next(err); }
  },

  async crear(req, res, next) {
    try {
      const productos = parseProductos(req.body.productos);
      const files = req.files || {};
      const look = await lookService.crear(
        req.auth.id,
        { titulo: req.body.titulo, productos },
        { imagen: files.imagen?.[0], imagenHover: files.imagen_hover?.[0] }
      );
      res.status(201).json(look);
    } catch (err) { next(err); }
  },

  async setProductos(req, res, next) {
    try {
      const productos = parseProductos(req.body.productos);
      await lookService.setProductos(req.params.idLook, req.auth.id, productos);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async borrar(req, res, next) {
    try {
      await lookService.borrar(req.params.idLook, req.auth.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },
};
