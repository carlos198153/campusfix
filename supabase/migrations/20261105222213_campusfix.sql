-- CampusFix: execute once with the Supabase migration owner.
begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  role text not null default 'user' check (role in ('admin', 'user')),
  active boolean not null default false,
  department text not null default '' check (char_length(department) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_email_lower_idx on public.profiles(lower(email));
create index profiles_role_active_idx on public.profiles(role, active);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 2 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.categories(name) values
  ('Electricidad'), ('Plomería'), ('Equipos de cómputo'), ('Internet y redes'),
  ('Mobiliario'), ('Limpieza'), ('Climatización'), ('Infraestructura'), ('Otros');

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  building text not null check (char_length(trim(building)) between 1 and 120),
  name text not null check (char_length(trim(name)) between 1 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(building, name)
);
insert into public.locations(building, name) values
  ('Edificio A', 'Aulas'), ('Edificio B', 'Laboratorios'),
  ('Biblioteca', 'Sala de consulta'), ('Rectoría', 'Oficinas'),
  ('Áreas comunes', 'Exteriores'), ('Centro de cómputo', 'Laboratorio');

create sequence private.incident_folio_seq start 1;
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  title text not null check (char_length(trim(title)) between 5 and 160),
  description text not null check (char_length(trim(description)) between 10 and 5000),
  category text not null references public.categories(name) on update cascade,
  location_id uuid references public.locations(id) on delete restrict,
  building text not null check (char_length(trim(building)) between 1 and 120),
  location text not null check (char_length(trim(location)) between 1 and 180),
  priority text not null default 'Media' check (priority in ('Baja','Media','Alta','Crítica')),
  status text not null default 'Pendiente' check (status in ('Pendiente','En proceso','Resuelta','Cancelada')),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reporter_name text not null default '',
  assignee_id uuid references public.profiles(id) on delete restrict,
  assignee_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Private Storage object path, not an expiring signed URL.
  photo_url text check (char_length(photo_url) <= 500),
  observations text not null default '' check (char_length(observations) <= 5000),
  deleted_at timestamptz,
  constraint resolution_matches_status check ((status = 'Resuelta') = (resolved_at is not null))
);
create index incidents_created_idx on public.incidents(created_at desc) where deleted_at is null;
create index incidents_status_priority_idx on public.incidents(status, priority) where deleted_at is null;
create index incidents_category_idx on public.incidents(category) where deleted_at is null;
create index incidents_reporter_idx on public.incidents(reporter_id);
create index incidents_assignee_idx on public.incidents(assignee_id);
create index incidents_location_idx on public.incidents(location_id);
create index incidents_search_idx on public.incidents using gin (
  to_tsvector('spanish', coalesce(folio,'') || ' ' || coalesce(title,'') || ' ' || coalesce(description,''))
) where deleted_at is null;

create table public.incident_history (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null,
  action text not null check (action in ('created','updated','status_changed','deleted')),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index incident_history_incident_idx on public.incident_history(incident_id, created_at desc);

create function private.app_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active);
$$;
create function private.app_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;
revoke all on function private.app_is_active() from public;
revoke all on function private.app_is_admin() from public;
grant execute on function private.app_is_active(), private.app_is_admin() to authenticated, service_role;

-- Metadata from a public signup can never grant a role or activate a profile.
create function private.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, email, role, active)
  values(new.id, left(case when char_length(trim(coalesce(new.raw_user_meta_data->>'full_name',''))) >= 2 then trim(new.raw_user_meta_data->>'full_name')
    when char_length(split_part(new.email, '@', 1)) >= 2 then split_part(new.email, '@', 1) else 'Usuario' end,120),
    new.email, 'user', false);
  return new;
end;
$$;
create trigger campusfix_auth_user_created after insert on auth.users
for each row execute function private.handle_new_auth_user();

create function private.sync_auth_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
create trigger campusfix_auth_email_updated after update of email on auth.users
for each row when (new.email is distinct from old.email) execute function private.sync_auth_email();

create function private.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') and coalesce(auth.role(), '') <> 'service_role' then
    if old.id <> auth.uid() or not private.app_is_active() then
      raise exception 'No puedes modificar este perfil.' using errcode = '42501';
    end if;
    if new.id is distinct from old.id or new.role is distinct from old.role
      or new.active is distinct from old.active or new.email is distinct from old.email
      or new.created_at is distinct from old.created_at then
      raise exception 'Los privilegios y datos de acceso se administran únicamente desde el backend.' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger campusfix_guard_profile before update on public.profiles
for each row execute function private.guard_profile_update();

create function private.prepare_incident() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  serial text;
  trusted boolean := coalesce(auth.role(), '') = 'service_role'
    or (auth.uid() is null and session_user in ('postgres','supabase_admin'));
begin
  if not trusted and not private.app_is_active() then
    raise exception 'Tu cuenta no está activa.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if not trusted then new.reporter_id := actor; end if;
    if not exists(select 1 from public.profiles where id = new.reporter_id and active) then
      raise exception 'El reportante debe tener una cuenta activa.';
    end if;
    serial := nextval('private.incident_folio_seq')::text;
    new.folio := 'INC-' || lpad(serial, greatest(6, char_length(serial)), '0');
    new.created_at := now();
    new.deleted_at := null;
    select full_name into new.reporter_name from public.profiles where id = new.reporter_id;
  else
    if old.deleted_at is not null then raise exception 'La incidencia está dada de baja.'; end if;
    if new.id is distinct from old.id or new.folio is distinct from old.folio
      or new.reporter_id is distinct from old.reporter_id or new.created_at is distinct from old.created_at then
      raise exception 'No se pueden alterar la identidad ni el origen de una incidencia.' using errcode = '42501';
    end if;
    new.reporter_name := old.reporter_name;
    if new.deleted_at is not null then new.deleted_at := now(); end if;
  end if;
  if new.location_id is not null and (tg_op = 'INSERT' or new.location_id is distinct from old.location_id) then
    select building,name into new.building,new.location from public.locations where id=new.location_id and active;
    if new.building is null then raise exception 'La ubicación seleccionada debe estar activa.'; end if;
  end if;
  if new.assignee_id is not null then
    select full_name into new.assignee_name from public.profiles where id = new.assignee_id
      and (active or (tg_op = 'UPDATE' and new.assignee_id = old.assignee_id));
    if new.assignee_name is null then raise exception 'El responsable debe tener una cuenta activa.'; end if;
  else new.assignee_name := null;
  end if;
  if new.photo_url is not null and new.photo_url <> '' then
    if new.photo_url !~ '^[0-9a-fA-F-]{36}/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'La fotografía debe ser una ruta del almacenamiento privado.';
    end if;
    if (tg_op = 'INSERT' or new.photo_url is distinct from old.photo_url) and not trusted
      and split_part(new.photo_url,'/',1) <> actor::text then
      raise exception 'Solo puedes adjuntar tus propias fotografías.' using errcode = '42501';
    end if;
  else new.photo_url := null;
  end if;
  new.updated_at := now();
  if new.status = 'Resuelta' then
    if tg_op = 'UPDATE' and old.status = 'Resuelta' then new.resolved_at := old.resolved_at;
    else new.resolved_at := now(); end if;
  else new.resolved_at := null;
  end if;
  return new;
end;
$$;
create trigger campusfix_prepare_incident before insert or update on public.incidents
for each row execute function private.prepare_incident();

-- The client cannot insert, update or delete audit events.
create function private.audit_incident() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  delta jsonb := '{}'::jsonb;
  field text;
  actor_name_value text;
  event text := 'created';
begin
  if tg_op = 'UPDATE' then
    foreach field in array array['title','description','category','location_id','building','location','priority','status','assignee_id','photo_url','observations','deleted_at'] loop
      if to_jsonb(old)->field is distinct from to_jsonb(new)->field then
        delta := delta || jsonb_build_object(field, jsonb_build_object('from',to_jsonb(old)->field,'to',to_jsonb(new)->field));
      end if;
    end loop;
    if delta = '{}'::jsonb then return new; end if;
    event := case when new.deleted_at is not null then 'deleted'
      when new.status is distinct from old.status then 'status_changed' else 'updated' end;
  else
    delta := jsonb_build_object('status',jsonb_build_object('from',null,'to',new.status));
  end if;
  select full_name into actor_name_value from public.profiles where id = auth.uid();
  insert into public.incident_history(incident_id, actor_id, actor_name, action, changes)
  values(new.id, auth.uid(), coalesce(actor_name_value,'Sistema'), event, delta);
  return new;
end;
$$;
create trigger campusfix_audit_incident after insert or update on public.incidents
for each row execute function private.audit_incident();

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_history enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or private.app_is_admin());
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() and private.app_is_active())
with check (id = auth.uid() and private.app_is_active());
create policy categories_read on public.categories for select to authenticated using(private.app_is_active());
create policy locations_read on public.locations for select to authenticated using(private.app_is_active());
create policy incidents_read on public.incidents for select to authenticated
using (private.app_is_active() and deleted_at is null);
create policy incidents_create on public.incidents for insert to authenticated
with check (private.app_is_active() and reporter_id = auth.uid() and deleted_at is null);
create policy incidents_update on public.incidents for update to authenticated
using (private.app_is_active() and deleted_at is null)
with check (private.app_is_active());
create policy incident_history_read on public.incident_history for select to authenticated
using (private.app_is_active() and exists(select 1 from public.incidents i where i.id = incident_id and i.deleted_at is null));

revoke all on public.profiles, public.categories, public.locations, public.incidents, public.incident_history from public, anon, authenticated;
grant select on public.profiles, public.categories, public.locations, public.incidents, public.incident_history to authenticated;
grant update(full_name, department) on public.profiles to authenticated;
grant insert(title,description,category,location_id,building,location,priority,status,reporter_id,assignee_id,photo_url,observations)
  on public.incidents to authenticated;
grant update(title,description,category,location_id,building,location,priority,status,assignee_id,photo_url,observations,deleted_at)
  on public.incidents to authenticated;
grant all on public.profiles, public.categories, public.locations, public.incidents, public.incident_history to service_role;

-- A boolean result confirms deletion atomically without RETURNING a row hidden
-- by the SELECT policy. All active campus users share operational access.
create function public.soft_delete_incident(p_incident_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  affected uuid;
begin
  if auth.uid() is null or not private.app_is_active() then
    raise exception 'Se requiere una cuenta activa.' using errcode = '42501';
  end if;
  update public.incidents set deleted_at=now()
  where id=p_incident_id and deleted_at is null returning id into affected;
  return affected is not null;
end;
$$;
revoke all on function public.soft_delete_incident(uuid) from public, anon;
grant execute on function public.soft_delete_incident(uuid) to authenticated;

-- This RPC is callable only by the Edge Function's service role. It serializes
-- administrator mutations and keeps at least one active administrator.
create function public.admin_update_profile(
  p_actor_id uuid, p_user_id uuid, p_full_name text default null,
  p_role text default null, p_active boolean default null, p_department text default null
) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  perform pg_advisory_xact_lock(2026102701);
  if not exists(select 1 from public.profiles where id = p_actor_id and role = 'admin' and active) then
    raise exception 'Se requiere una cuenta administradora activa.' using errcode = '42501';
  end if;
  select * into target from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Usuario no encontrado.'; end if;
  if p_actor_id = p_user_id and ((p_role is not null and p_role <> target.role)
    or (p_active is not null and p_active <> target.active)) then
    raise exception 'No puedes cambiar tu propio rol ni desactivar tu cuenta.' using errcode = '42501';
  end if;
  if target.role = 'admin' and target.active and (coalesce(p_role,target.role) <> 'admin' or not coalesce(p_active,target.active))
    and not exists(select 1 from public.profiles where id <> p_user_id and role = 'admin' and active) then
    raise exception 'Debe permanecer al menos un administrador activo.';
  end if;
  update public.profiles set full_name=coalesce(p_full_name,full_name),role=coalesce(p_role,role),
    active=coalesce(p_active,active),department=coalesce(p_department,department)
  where id=p_user_id returning * into target;
  return target;
end;
$$;
revoke all on function public.admin_update_profile(uuid,uuid,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.admin_update_profile(uuid,uuid,text,text,boolean,text) to service_role;

create table private.classification_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now()
);
create index classification_requests_user_time_idx on private.classification_requests(user_id, requested_at);
alter table private.classification_requests enable row level security;
revoke all on private.classification_requests from public, anon, authenticated;
create function public.consume_classification_quota(p_user_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 21));
  if not exists(select 1 from public.profiles where id=p_user_id and active) then return false; end if;
  if (select count(*) from private.classification_requests where user_id=p_user_id and requested_at > now()-interval '1 minute') >= 12 then
    return false;
  end if;
  delete from private.classification_requests where user_id=p_user_id and requested_at < now()-interval '1 day';
  insert into private.classification_requests(user_id) values(p_user_id);
  return true;
end;
$$;
revoke all on function public.consume_classification_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_classification_quota(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('incident-photos','incident-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
create policy campusfix_photos_read on storage.objects for select to authenticated
using(bucket_id='incident-photos' and private.app_is_active());
create policy campusfix_photos_insert on storage.objects for insert to authenticated
with check(bucket_id='incident-photos' and private.app_is_active() and (storage.foldername(name))[1]=auth.uid()::text);
create policy campusfix_photos_update on storage.objects for update to authenticated
using(bucket_id='incident-photos' and private.app_is_active() and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='incident-photos' and private.app_is_active() and (storage.foldername(name))[1]=auth.uid()::text);
create policy campusfix_photos_delete on storage.objects for delete to authenticated
using(bucket_id='incident-photos' and private.app_is_active() and ((storage.foldername(name))[1]=auth.uid()::text or private.app_is_admin()));

-- Trigger functions cannot be invoked through the Data API.
revoke all on function private.handle_new_auth_user(), private.sync_auth_email(), private.guard_profile_update(), private.prepare_incident(), private.audit_incident() from public, anon, authenticated;

commit;
