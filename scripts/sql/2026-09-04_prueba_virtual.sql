-- Probador virtual (FASHN tryon-max): log de usos por usuario, solo para
-- contar el límite de 5 generaciones por día. No se guarda ninguna imagen acá
-- (ni la foto del usuario ni el resultado) porque el feature no persiste nada.
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

create table if not exists "Prueba_Virtual" (
  id_prueba serial primary key,
  id_usuario integer not null references "Usuario"(id_usuario) on delete cascade,
  id_producto integer not null references "Producto"(id_producto) on delete cascade,
  fecha timestamptz not null default now()
);

-- para contar rápido "usos de este usuario en las últimas 24hs"
create index if not exists prueba_virtual_usuario_fecha_idx
  on "Prueba_Virtual" (id_usuario, fecha);
