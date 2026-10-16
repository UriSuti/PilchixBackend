-- AI Stylist: preferencias de estilo del usuario (ocasión, estilos, presupuesto,
-- colores y calce). Se guardan como jsonb para poder sumar campos sin migrar.
--
-- Correr esto una vez en el SQL Editor de Supabase (Project > SQL Editor > New query).

alter table "Usuario"
  add column if not exists preferencias_stylist jsonb;
