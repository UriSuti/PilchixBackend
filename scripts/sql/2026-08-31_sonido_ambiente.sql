-- Sonido ambiente del local: cada marca elige uno de un catálogo fijo de
-- presets sintetizados en el cliente (no es un archivo de audio subido,
-- así que esta columna guarda solo el id del preset, ej: "boutique", "urbano").
-- Valores válidos (ver PRESETS_VALIDOS en marca.controller.js):
--   boutique | urbano | acustico | energico | minimal | nocturno | ninguno | null
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

alter table "Marca"
  add column if not exists sonido_ambiente text;
