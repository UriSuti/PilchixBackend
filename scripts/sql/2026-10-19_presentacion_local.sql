-- Datos de presentación del local para el directorio /locales (portada,
-- tarjetas y panel "Presentación del local"). Todos son opcionales: el
-- frontend muestra cada dato solo cuando está cargado.
--
--   frase           frase corta de la marca (máx. ~120 caracteres)
--   anio_fundacion  año en que arrancó la marca ("desde 2019")
--   horarios        horario semanal en JSON, una clave por día (0 = domingo
--                   ... 6 = sábado) con { "abre": "HH:MM", "cierra": "HH:MM" }
--                   o null si ese día está cerrado. Ej:
--                   {"1": {"abre": "10:00", "cierra": "20:00"}, "0": null}
--   envio           texto corto del tipo de envío ("Envío gratis en CABA")
--   solo_online     true si la marca no tiene local a la calle
--   estilos         hasta 4 etiquetas de estilo ("Streetwear", "Urbano", "Mujer")
--
-- Mientras esta migración no corra, el backend reintenta sin estas columnas
-- (ver src/repositories/columnas-opcionales.js), así que nada se rompe.
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

alter table "Marca"
  add column if not exists frase text,
  add column if not exists anio_fundacion smallint,
  add column if not exists horarios jsonb,
  add column if not exists envio text,
  add column if not exists solo_online boolean not null default false,
  add column if not exists estilos text[];

alter table "Marca"
  drop constraint if exists marca_anio_fundacion_valido;
alter table "Marca"
  add constraint marca_anio_fundacion_valido
  check (anio_fundacion is null or anio_fundacion between 1900 and 2100);
