-- El probador virtual ahora guarda el resultado (antes no persistía nada) para
-- que el usuario pueda ver su historial en el perfil ("Probador").
-- Solo se guarda la imagen generada (persona + prenda), no la foto original
-- que subió el usuario.
--
-- Ya aplicado en el proyecto (vía MCP de Supabase). Este archivo queda como
-- registro, igual que el resto de scripts/sql/.

alter table "Prueba_Virtual" add column if not exists imagen text;
