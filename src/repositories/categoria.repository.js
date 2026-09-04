import { supabase } from "../config/supabase.js";

export const categoriaRepository = {
    // todas las categorías globales (fijas)
    async getGlobales() {
        const { data, error } = await supabase
            .from("Categoria")
            .select("id_categoria, nombre")
            .order("nombre");
        if (error) throw new Error(error.message);
        return data;
    },

    // las que usa la marca
    async getDeMarca(idMarca) {
        const { data, error } = await supabase
            .from("Marca_Categoria")
            .select("id_categoria")
            .eq("id_marca", idMarca);
        if (error) throw new Error(error.message);
        return (data ?? []).map((r) => r.id_categoria);
    },

    async activarCategoria(idMarca, idCategoria) {
        const { error } = await supabase
            .from("Marca_Categoria")
            .insert({ id_marca: idMarca, id_categoria: idCategoria });
        if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    },

    async desactivarCategoria(idMarca, idCategoria) {
        const { error } = await supabase
            .from("Marca_Categoria")
            .delete()
            .eq("id_marca", idMarca)
            .eq("id_categoria", idCategoria);
        if (error) throw new Error(error.message);
    },

    // ¿la marca tiene productos en esta categoría? (para no dejar desactivar)
    async contarProductosEnCategoria(idMarca, idCategoria) {
        const { count, error } = await supabase
            .from("Producto_Categoria")
            .select("id_producto, Producto!inner(id_marca)", { count: "exact", head: true })
            .eq("id_categoria", idCategoria)
            .eq("Producto.id_marca", idMarca);
        if (error) throw new Error(error.message);
        return count ?? 0;
    },

    /* ---------- SUBCATEGORÍAS ---------- */
    async getSubcategorias(idMarca) {
        const { data, error } = await supabase
            .from("Subcategoria")
            .select("id_subcategoria, nombre, id_categoria")
            .eq("id_marca", idMarca)
            .order("nombre");
        if (error) throw new Error(error.message);
        return data;
    },

    async crearSubcategoria({ idMarca, idCategoria, nombre }) {
        const { data, error } = await supabase
            .from("Subcategoria")
            .insert({ id_marca: idMarca, id_categoria: idCategoria, nombre })
            .select("id_subcategoria, nombre, id_categoria")
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async actualizarSubcategoria(idSubcategoria, idMarca, nombre) {
        const { data, error } = await supabase
            .from("Subcategoria")
            .update({ nombre })
            .eq("id_subcategoria", idSubcategoria)
            .eq("id_marca", idMarca)          // ← autorización
            .select("id_subcategoria");
        if (error) throw new Error(error.message);
        return (data?.length ?? 0) > 0;
    },

    async borrarSubcategoria(idSubcategoria, idMarca) {
        // desvincular productos primero
        await supabase.from("Producto").update({ id_subcategoria: null }).eq("id_subcategoria", idSubcategoria);
        const { data, error } = await supabase
            .from("Subcategoria")
            .delete()
            .eq("id_subcategoria", idSubcategoria)
            .eq("id_marca", idMarca)          // ← autorización
            .select("id_subcategoria");
        if (error) throw new Error(error.message);
        return (data?.length ?? 0) > 0;
    },
};