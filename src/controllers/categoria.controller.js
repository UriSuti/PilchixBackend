import { categoriaService } from "../services/categoria.service.js";

export const categoriaController = {
    async getModulo(req, res, next) {
        try { res.json(await categoriaService.getModulo(req.auth.id)); }
        catch (err) { next(err); }
    },
    async activar(req, res, next) {
        try {
            await categoriaService.activar(req.auth.id, req.params.idCategoria);
            res.json({ ok: true });
        } catch (err) { next(err); }
    },
    async desactivar(req, res, next) {
        try {
            await categoriaService.desactivar(req.auth.id, req.params.idCategoria);
            res.json({ ok: true });
        } catch (err) { next(err); }
    },
    async crearSub(req, res, next) {
        try {
            const { idCategoria, nombre } = req.body;
            res.status(201).json(await categoriaService.crearSubcategoria(req.auth.id, idCategoria, nombre));
        } catch (err) { next(err); }
    },
    async actualizarSub(req, res, next) {
        try {
            await categoriaService.actualizarSubcategoria(req.params.id, req.auth.id, req.body.nombre);
            res.json({ ok: true });
        } catch (err) { next(err); }
    },
    async borrarSub(req, res, next) {
        try {
            await categoriaService.borrarSubcategoria(req.params.id, req.auth.id);
            res.json({ ok: true });
        } catch (err) { next(err); }
    },
};