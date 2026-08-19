-- Subcategorias: cada una pertenece a una Categoria general Y a la Marca que la creó
-- (son privadas de esa marca, otras marcas no las ven).
-- Etiquetas: las que ya existen son generales (visibles para todas las marcas);
-- una marca puede crear las suyas propias, que quedan privadas (id_marca seteado).
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

create table if not exists "Subcategoria" (
  id_subcategoria serial primary key,
  nombre text not null,
  id_categoria integer not null references "Categoria"(id_categoria) on delete cascade
);

alter table "Subcategoria"
  add column if not exists id_marca integer references "Marca"(id_marca) on delete cascade;

-- si esto falla es porque ya hay filas sin id_marca cargadas (no debería, es una tabla nueva)
alter table "Subcategoria" alter column id_marca set not null;

drop index if exists subcategoria_nombre_categoria_unique;
create unique index if not exists subcategoria_nombre_categoria_marca_unique
  on "Subcategoria" (id_marca, id_categoria, lower(nombre));

create table if not exists "Producto_Subcategoria" (
  id_producto integer not null references "Producto"(id_producto) on delete cascade,
  id_subcategoria integer not null references "Subcategoria"(id_subcategoria) on delete cascade,
  primary key (id_producto, id_subcategoria)
);

create index if not exists producto_subcategoria_id_producto_idx
  on "Producto_Subcategoria" (id_producto);

create index if not exists producto_subcategoria_id_subcategoria_idx
  on "Producto_Subcategoria" (id_subcategoria);

-- Etiqueta ya existe con datos generales: la columna queda NULL en esas filas
-- (= general, visible para todas) y seteada solo en las que crea cada marca (= privada).
alter table "Etiqueta"
  add column if not exists id_marca integer references "Marca"(id_marca) on delete cascade;

create unique index if not exists etiqueta_nombre_marca_unique
  on "Etiqueta" (id_marca, lower(nombre)) where id_marca is not null;
