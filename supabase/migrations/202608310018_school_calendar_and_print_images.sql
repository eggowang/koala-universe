alter table public.families
  add column if not exists school_calendar jsonb not null default '{"holidays": [], "makeupDays": []}'::jsonb;

alter table public.learning_materials
  add column if not exists image_url text;
