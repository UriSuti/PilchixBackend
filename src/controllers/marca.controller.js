import { marcaRepository } from "../repositories/marca.repository.js";

// { "0".."6": { abre: "HH:MM", cierra: "HH:MM" } | null } (0 = domingo); descarta todo lo demás
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
function normalizarHorarios(horarios) {
  if (!horarios || typeof horarios !== "object") return null;
  const limpio = {};
  for (let dia = 0; dia <= 6; dia++) {
    const h = horarios[dia];
    limpio[dia] = h && HORA.test(h.abre) && HORA.test(h.cierra) ? { abre: h.abre, cierra: h.cierra } : null;
  }
  return Object.values(limpio).some(Boolean) ? limpio : null;
}

export const marcaController = {
  async getPerfil(req, res, next) {
    try {
      res.json(await marcaRepository.getPerfil(req.auth.id));
    } catch (err) { next(err); }
  },

  async actualizarPerfil(req, res, next) {
    try {
      const { descripcion, ubicacion, sitio_web, instagram, tiktok, sonido_ambiente } = req.body;
      const campos = {};
      // solo tocamos lo que venga en el body
      if (descripcion !== undefined) campos.descripcion = descripcion?.trim() || null;
      if (ubicacion !== undefined) campos.ubicacion = ubicacion?.trim() || null;
      if (sitio_web !== undefined) campos.sitio_web = sitio_web?.trim() || null;
      if (instagram !== undefined) campos.instagram = instagram?.trim() || null;
      if (tiktok !== undefined) campos.tiktok = tiktok?.trim() || null;
      if (sonido_ambiente !== undefined) {
        // solo un id conocido del catálogo (o null/"ninguno"): nunca texto libre
        const PRESETS_VALIDOS = ["boutique", "urbano", "acustico", "energico", "minimal", "nocturno", "ninguno"];
        campos.sonido_ambiente = PRESETS_VALIDOS.includes(sonido_ambiente) ? sonido_ambiente : null;
      }

      // presentación del local (scripts/sql/2026-10-19_presentacion_local.sql)
      const { frase, anio_fundacion, horarios, envio, solo_online, estilos } = req.body;
      if (frase !== undefined) campos.frase = frase?.trim().slice(0, 120) || null;
      if (envio !== undefined) campos.envio = envio?.trim().slice(0, 60) || null;
      if (solo_online !== undefined) campos.solo_online = solo_online === true;
      if (anio_fundacion !== undefined) {
        const anio = Number(anio_fundacion);
        campos.anio_fundacion =
          anio_fundacion !== null && anio_fundacion !== "" && Number.isInteger(anio) &&
          anio >= 1900 && anio <= new Date().getFullYear() ? anio : null;
      }
      if (estilos !== undefined) {
        const lista = Array.isArray(estilos) ? estilos : [];
        const limpios = [...new Set(lista.map((e) => String(e).trim().slice(0, 24)).filter(Boolean))].slice(0, 4);
        campos.estilos = limpios.length ? limpios : null;
      }
      if (horarios !== undefined) campos.horarios = normalizarHorarios(horarios);

      await marcaRepository.actualizarPerfil(req.auth.id, campos);
      res.json({ ok: true });
    } catch (err) { next(err); }
  },

  async subirLogo(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "No se envió ninguna imagen" });
      const url = await marcaRepository.subirImagen(
        req.auth.id, req.file.buffer, req.file.originalname, req.file.mimetype, "logo"
      );
      await marcaRepository.actualizarPerfil(req.auth.id, { logo: url });
      res.json({ logo: url });
    } catch (err) { next(err); }
  },

  async subirFachada(req, res, next) {
    try {
      if (!req.file) return res.status(400).json({ error: "No se envió ninguna imagen" });
      const url = await marcaRepository.subirImagen(
        req.auth.id, req.file.buffer, req.file.originalname, req.file.mimetype, "fachada"
      );
      await marcaRepository.actualizarPerfil(req.auth.id, { imagen_fachada: url });
      res.json({ imagen_fachada: url });
    } catch (err) { next(err); }
  },
};
