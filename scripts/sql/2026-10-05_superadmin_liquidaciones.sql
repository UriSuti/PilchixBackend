-- Super admin de Pilchix + liquidaciones a las marcas.
--
-- "Admin": usuarios con acceso al panel de Pilchix (/superadmin). No hay
-- endpoint de registro: se crean a mano con `npm run crear-admin`.
--
-- "Liquidacion": cada pago que Pilchix le hace a las marcas. Guarda el
-- comprobante (bucket privado "comprobantes") y agrupa las Venta_Marca que
-- quedaron cobradas con ese pago (Venta_Marca.id_liquidacion).
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

create table if not exists "Admin" (
  id_admin serial primary key,
  nombre text not null,
  email text not null unique,
  contraseña text not null,
  creado timestamptz not null default now()
);

create table if not exists "Liquidacion" (
  id_liquidacion serial primary key,
  id_admin integer references "Admin"(id_admin) on delete set null,
  monto numeric(12, 2) not null,
  comprobante text not null,          -- path dentro del bucket "comprobantes"
  nota text,
  fecha timestamptz not null default now()
);

alter table "Venta_Marca"
  add column if not exists id_liquidacion integer references "Liquidacion"(id_liquidacion) on delete set null;

create index if not exists venta_marca_liquidacion_idx on "Venta_Marca" (id_liquidacion);
create index if not exists venta_marca_estado_idx on "Venta_Marca" (estado);

-- bucket privado: los comprobantes tienen datos bancarios, se leen con URL firmada
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

-- Crea la liquidación y marca las ventas como cobradas en una sola transacción.
-- Si alguna venta no existe o ya estaba cobrada, falla y no toca nada.
create or replace function liquidar_ventas(
  p_ids integer[],
  p_comprobante text,
  p_nota text,
  p_id_admin integer
) returns integer
language plpgsql
as $$
declare
  v_pendientes integer;
  v_monto numeric(12, 2);
  v_id integer;
begin
  -- bloquea las filas para que dos pagos simultáneos no liquiden la misma venta
  perform 1 from "Venta_Marca" where id_venta = any(p_ids) for update;

  select count(*), coalesce(sum(monto), 0)
    into v_pendientes, v_monto
    from "Venta_Marca"
   where id_venta = any(p_ids) and estado = 'por_cobrar';

  if v_pendientes = 0 or v_pendientes <> cardinality(p_ids) then
    raise exception 'Alguna de las ventas ya fue cobrada o no existe';
  end if;

  insert into "Liquidacion" (id_admin, monto, comprobante, nota)
  values (p_id_admin, v_monto, p_comprobante, p_nota)
  returning id_liquidacion into v_id;

  update "Venta_Marca"
     set estado = 'cobrado', fecha_cobro = now(), id_liquidacion = v_id
   where id_venta = any(p_ids);

  return v_id;
end;
$$;

-- admin inicial (la contraseña va hasheada con bcrypt)
insert into "Admin" (nombre, email, contraseña)
values ('mb fans', 'bandapilchera@gmail.com', '$2b$10$gMoPL0Xg/6bpLjfbAIjxdevPfVJWzhE.03pIPfEgrLpgNRPtmXq7y')
on conflict (email) do update set nombre = excluded.nombre, contraseña = excluded.contraseña;
