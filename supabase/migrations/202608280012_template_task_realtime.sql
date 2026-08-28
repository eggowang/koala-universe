do $$
begin
  alter publication supabase_realtime add table public.template_tasks;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.template_sections;
exception when duplicate_object then null;
end;
$$;
