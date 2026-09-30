-- Ventas por marca (cashflow): cada Compra confirmada genera una fila por cada
-- marca que tenga productos en ella, con el monto que le corresponde a esa marca.
-- Nace en 'por_cobrar'; pasa a 'cobrado' cuando Pilchix le liquida la plata a la marca.
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

create table if not exists "Venta_Marca" (
  id_venta serial primary key,
  id_compra integer not null references "Compra"(id_compra) on delete cascade,
  id_marca integer not null references "Marca"(id_marca) on delete cascade,
  monto numeric(12, 2) not null,
  estado text not null default 'por_cobrar' check (estado in ('por_cobrar', 'cobrado')),
  fecha timestamptz not null default now(),
  fecha_cobro timestamptz
);

-- una compra genera como mucho una venta por marca (evita duplicados si se reintenta)
create unique index if not exists venta_marca_compra_marca_unique
  on "Venta_Marca" (id_compra, id_marca);

create index if not exists venta_marca_marca_fecha_idx
  on "Venta_Marca" (id_marca, fecha desc);

-- Para marcar una venta como cobrada (por ahora a mano, no hay panel de Pilchix):
-- update "Venta_Marca" set estado = 'cobrado', fecha_cobro = now() where id_venta = <id>;
