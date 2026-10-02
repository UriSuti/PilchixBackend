import { metricasRepository } from "../repositories/metricas.repository.js";

const DIA = 86400000;
const iso = (d) => d.toISOString().split("T")[0];
const soloFecha = (f) => String(f ?? "").slice(0, 10);

function kpi(actual, anterior) {
  const variacion = anterior ? ((actual - anterior) / anterior) * 100 : null; // null = sin base
  return { actual, anterior, variacion };
}

const acumulador = () => ({ vistas: 0, clics: 0, unidades: 0, ingresos: 0, pedidos: new Set() });

export const metricasService = {
  async getMetricas(idMarca, diasParam) {
    const dias = Math.min(Math.max(Number(diasParam) || 30, 1), 3650);
    const hoy = new Date();
    const desde = iso(new Date(hoy - dias * DIA));
    const desdePrev = iso(new Date(hoy - 2 * dias * DIA));

    const productos = await metricasRepository.getProductos(idMarca);
    const ids = productos.map((p) => p.id_producto);

    const [metricas, ventas, suscripciones] = await Promise.all([
      ids.length ? metricasRepository.getMetricasDiarias(ids, desdePrev) : [],
      ids.length ? metricasRepository.getVentas(ids, desdePrev) : [],
      metricasRepository.getSuscripciones(idMarca),
    ]);

    const act = acumulador();
    const prev = acumulador();
    const porProducto = new Map(ids.map((id) => [id, { vistas: 0, clics: 0, unidades: 0, ingresos: 0 }]));
    const porFecha = {};
    const talles = {};
    const colores = {};
    const dia = (f) =>
      (porFecha[f] ??= { fecha: f, visualizaciones: 0, clics: 0, ventas: 0, ingresos: 0 });

    // vistas y clics
    for (const m of metricas) {
      const f = soloFecha(m.fecha);
      const vistas = m.visualizaciones || 0;
      const clics = m.clics || 0;
      const b = f >= desde ? act : prev;
      b.vistas += vistas;
      b.clics += clics;
      if (f >= desde) {
        const p = porProducto.get(m.id_producto);
        p.vistas += vistas;
        p.clics += clics;
        dia(f).visualizaciones += vistas;
        dia(f).clics += clics;
      }
    }

    // ventas reales
    for (const v of ventas) {
      const f = soloFecha(v.Compra?.fecha);
      const unidades = v.cantidad || 0;
      const monto = unidades * (Number(v.precio_unitario) || 0);
      const b = f >= desde ? act : prev;
      b.unidades += unidades;
      b.ingresos += monto;
      b.pedidos.add(v.id_compra);
      if (f >= desde) {
        const p = porProducto.get(v.id_producto);
        p.unidades += unidades;
        p.ingresos += monto;
        dia(f).ventas += unidades;
        dia(f).ingresos += monto;
        const t = v.talle || "Sin talle";
        const c = v.color || "Sin color";
        talles[t] = (talles[t] || 0) + unidades;
        colores[c] = (colores[c] || 0) + unidades;
      }
    }

    // serie con días vacíos rellenos en 0 (así el gráfico no salta días)
    let serie;
    if (dias <= 90) {
      serie = [];
      for (let i = dias - 1; i >= 0; i--) {
        const f = iso(new Date(hoy - i * DIA));
        serie.push(porFecha[f] ?? { fecha: f, visualizaciones: 0, clics: 0, ventas: 0, ingresos: 0 });
      }
    } else {
      serie = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
    }

    // tabla por producto
    const tabla = productos
      .map((p) => {
        const d = porProducto.get(p.id_producto);
        const ritmo = d.unidades / dias; // unidades por día
        const ops = p.Opinion ?? [];
        const portada = (p.Imagen ?? []).find((i) => i.es_portada) ?? p.Imagen?.[0];
        return {
          id: p.id_producto,
          nombre: p.nombre,
          imagen: portada?.imagen ?? null,
          estado: p.estado,
          stock: p.stock ?? 0,
          vistas: d.vistas,
          clics: d.clics,
          ventas: d.unidades,
          ingresos: d.ingresos,
          conversion: d.vistas ? (d.unidades / d.vistas) * 100 : 0,
          favoritos: (p.Favorito ?? []).length,
          recomendacion: ops.length ? (ops.filter((o) => o.recomienda).length / ops.length) * 100 : null,
          diasStock: ritmo > 0 ? Math.round((p.stock ?? 0) / ritmo) : null,
        };
      })
      .sort((a, b) => b.ingresos - a.ingresos);

    // categorías
    const cats = {};
    for (const p of productos) {
      const d = porProducto.get(p.id_producto);
      for (const pc of p.Producto_Categoria ?? []) {
        const n = pc.Categoria?.nombre;
        if (!n) continue;
        cats[n] ??= { categoria: n, ventas: 0, ingresos: 0 };
        cats[n].ventas += d.unidades;
        cats[n].ingresos += d.ingresos;
      }
    }

    // recomendación global (histórica)
    const todasOps = productos.flatMap((p) => p.Opinion ?? []);
    const recomendacion = todasOps.length
      ? (todasOps.filter((o) => o.recomienda).length / todasOps.length) * 100
      : null;

    const nuevosAct = suscripciones.filter((s) => soloFecha(s.fecha_inicio) >= desde).length;
    const nuevosPrev = suscripciones.filter((s) => {
      const f = soloFecha(s.fecha_inicio);
      return f >= desdePrev && f < desde;
    }).length;

    const ticketAct = act.pedidos.size ? act.ingresos / act.pedidos.size : 0;
    const ticketPrev = prev.pedidos.size ? prev.ingresos / prev.pedidos.size : 0;
    const convAct = act.vistas ? (act.unidades / act.vistas) * 100 : 0;
    const convPrev = prev.vistas ? (prev.unidades / prev.vistas) * 100 : 0;

    const ordenar = (obj, clave) =>
      Object.entries(obj)
        .map(([k, unidades]) => ({ [clave]: k, unidades }))
        .sort((a, b) => b.unidades - a.unidades);

    return {
      dias,
      kpis: {
        ingresos: kpi(act.ingresos, prev.ingresos),
        ventas: kpi(act.unidades, prev.unidades),
        pedidos: kpi(act.pedidos.size, prev.pedidos.size),
        ticketPromedio: kpi(ticketAct, ticketPrev),
        visualizaciones: kpi(act.vistas, prev.vistas),
        conversion: kpi(convAct, convPrev),
        nuevosSeguidores: kpi(nuevosAct, nuevosPrev),
        seguidores: suscripciones.length,
        recomendacion,
      },
      embudo: [
        { etapa: "Vistas", valor: act.vistas },
        { etapa: "Clics", valor: act.clics },
        { etapa: "Ventas", valor: act.unidades },
      ],
      serie,
      categorias: Object.values(cats).sort((a, b) => b.ingresos - a.ingresos),
      talles: ordenar(talles, "talle"),
      colores: ordenar(colores, "color"),
      tabla,
      alertas: {
        stockEnRiesgo: tabla.filter((p) => p.estado && p.diasStock !== null && p.diasStock < 14),
        sinStock: tabla.filter((p) => p.estado && p.stock === 0),
        sinVentas: tabla.filter((p) => p.vistas >= 20 && p.ventas === 0),
      },
    };
  },
};