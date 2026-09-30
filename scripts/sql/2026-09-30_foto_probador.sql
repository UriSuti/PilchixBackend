-- Probador virtual: el usuario puede guardar una foto suya en el perfil para no
-- tener que subirla cada vez que usa el probador. Se guarda la URL pública del
-- archivo (bucket "pruebas-virtuales", carpeta modelos/).
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

alter table "Usuario" add column if not exists foto_probador text;
