import { categoriaRepository } from "../repositories/categoria.repository.js";

function error(msg, status) {
    const err = new Error(msg);
    err.status = status;
    return err;
}

export const categoriaService = {
    // pantalla completa: globales + cuáles usa + subcategorías
    async getModulo(idMarca) {
        const [globales, activas, subcategorias] = await Promise.all([
            categoriaRepository.getGlobales(),
            categoriaRepository.getDeMarca(idMarca),
            categoriaRepository.getSubcategorias(idMarca),
        ]);
        return { globales, activas, subcategorias };
    },

    activar: (idMarca, idCategoria) =>
        categoriaRepository.activarCategoria(idMarca, idCategoria),

    async desactivar(idMarca, idCategoria) {
        const cantidad = await categoriaRepository.contarProductosEnCategoria(idMarca, idCategoria);
        if (cantidad > 0) {
            throw error(`No podés desactivarla: tenés ${cantidad} producto(s) en esta categoría`, 409);
        }
        await categoriaRepository.desactivarCategoria(idMarca, idCategoria);
    },

    async crearSubcategoria(idMarca, idCategoria, nombre) {
        const n = (nombre ?? "").trim();
        if (n.length < 2) throw error("El nombre es muy corto", 400);
            // solo puede crear subcategorías en categorías que usa
            const activas = await categoriaRepository.getDeMarca(idMarca);
            if (!activas.includes(Number(idCategoria))) {
            throw error("Primero activá esa categoría", 400);
        }
        return categoriaRepository.crearSubcategoria({ idMarca, idCategoria, nombre: n });
    },

    async actualizarSubcategoria(idSubcategoria, idMarca, nombre) {
        const n = (nombre ?? "").trim();
        if (n.length < 2) throw error("El nombre es muy corto", 400);
        const ok = await categoriaRepository.actualizarSubcategoria(idSubcategoria, idMarca, n);
        if (!ok) throw error("Subcategoría no encontrada", 404);
    },

    async borrarSubcategoria(idSubcategoria, idMarca) {
        const ok = await categoriaRepository.borrarSubcategoria(idSubcategoria, idMarca);
        if (!ok) throw error("Subcategoría no encontrada", 404);
    },
};