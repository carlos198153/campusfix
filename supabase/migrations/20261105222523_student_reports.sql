-- Simplified CampusFix: students report; administrators resolve.
-- Apply after 202610270001_campusfix.sql. Existing reports and history remain.
begin;

alter table public.profiles add column deleted_at timestamptz;
alter table public.profiles add constraint removed_profiles_inactive check (deleted_at is null or not active);
create index profiles_students_idx on public.profiles(created_at desc) where role='user' and deleted_at is null;

-- Preserve timestamps, resolution dates and historical event payloads during conversion.
alter table public.incidents disable trigger campusfix_prepare_incident;
alter table public.incidents disable trigger campusfix_audit_incident;
alter table public.incidents drop constraint incidents_status_check;
alter table public.incidents drop constraint resolution_matches_status;
update public.incidents set status=case status
  when 'En proceso' then 'Urgente' when 'Resuelta' then 'Solucionado'
  when 'Cancelada' then 'Pendiente' else status end;
alter table public.incidents add constraint incidents_status_check check(status in ('Pendiente','Urgente','Solucionado'));
alter table public.incidents add constraint resolution_matches_status check((status='Solucionado')=(resolved_at is not null));
alter table public.incidents alter column category set default 'Otros';
alter table public.incidents alter column building set default 'Campus UNACAR';
alter table public.incidents alter column location set default 'Ver descripción';
alter table public.incidents alter column reporter_id set default auth.uid();

create or replace function private.app_is_active() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active and deleted_at is null);
$$;
create or replace function private.app_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active and deleted_at is null and role='admin');
$$;

create or replace function private.guard_profile_update() returns trigger
language plpgsql set search_path='' as $$
begin
  if current_user not in ('postgres','supabase_admin','service_role') and coalesce(auth.role(),'') <> 'service_role' then
    if old.id <> auth.uid() or not private.app_is_active() then
      raise exception 'No puedes modificar este perfil.' using errcode='42501';
    end if;
    if new.id is distinct from old.id or new.role is distinct from old.role
      or new.active is distinct from old.active or new.email is distinct from old.email
      or new.created_at is distinct from old.created_at or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Los privilegios y datos de acceso se administran únicamente desde el backend.' using errcode='42501';
    end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

create or replace function private.prepare_incident() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=auth.uid();
  serial text;
  trusted boolean:=coalesce(auth.role(),'')='service_role'
    or (auth.uid() is null and session_user in ('postgres','supabase_admin'));
begin
  if not trusted and not private.app_is_active() then
    raise exception 'Tu cuenta no está activa.' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if not trusted then new.reporter_id:=actor; end if;
    if not trusted and not private.app_is_admin() then
      -- The student API accepts only title, description and an optional photograph.
      -- These values are forced even if a client attempts to forge metadata.
      new.status:='Pendiente'; new.category:='Otros'; new.priority:='Media';
      new.building:='Campus UNACAR'; new.location:='Ver descripción';
      new.location_id:=null; new.assignee_id:=null; new.observations:='';
    end if;
    if not exists(select 1 from public.profiles where id=new.reporter_id and active and deleted_at is null) then
      raise exception 'El reportante debe tener una cuenta activa.';
    end if;
    serial:=nextval('private.incident_folio_seq')::text;
    new.folio:='INC-'||lpad(serial,greatest(6,char_length(serial)),'0');
    new.created_at:=now(); new.deleted_at:=null;
    select full_name into new.reporter_name from public.profiles where id=new.reporter_id;
  else
    if not trusted and not private.app_is_admin() then
      raise exception 'Solo un administrador puede modificar reportes.' using errcode='42501';
    end if;
    if old.deleted_at is not null then raise exception 'El reporte está dado de baja.'; end if;
    if new.id is distinct from old.id or new.folio is distinct from old.folio
      or new.reporter_id is distinct from old.reporter_id or new.created_at is distinct from old.created_at then
      raise exception 'No se puede alterar la identidad ni el origen de un reporte.' using errcode='42501';
    end if;
    new.reporter_name:=old.reporter_name;
    if new.deleted_at is not null then new.deleted_at:=now(); end if;
  end if;
  if new.location_id is not null and (tg_op='INSERT' or new.location_id is distinct from old.location_id) then
    select building,name into new.building,new.location from public.locations where id=new.location_id and active;
    if new.building is null then raise exception 'La ubicación seleccionada debe estar activa.'; end if;
  end if;
  if new.assignee_id is not null then
    select full_name into new.assignee_name from public.profiles where id=new.assignee_id
      and ((active and deleted_at is null) or (tg_op='UPDATE' and new.assignee_id=old.assignee_id));
    if new.assignee_name is null then raise exception 'El responsable debe tener una cuenta activa.'; end if;
  else new.assignee_name:=null;
  end if;
  if new.photo_url is not null and new.photo_url <> '' then
    if new.photo_url !~ '^[0-9a-fA-F-]{36}/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'La fotografía debe ser una ruta del almacenamiento privado.';
    end if;
    if (tg_op='INSERT' or new.photo_url is distinct from old.photo_url) and not trusted
      and split_part(new.photo_url,'/',1) <> actor::text then
      raise exception 'Solo puedes adjuntar tus propias fotografías.' using errcode='42501';
    end if;
  else new.photo_url:=null;
  end if;
  new.updated_at:=now();
  if new.status='Solucionado' then
    if tg_op='UPDATE' and old.status='Solucionado' then new.resolved_at:=old.resolved_at;
    else new.resolved_at:=now(); end if;
  else new.resolved_at:=null;
  end if;
  return new;
end;
$$;
alter table public.incidents enable trigger campusfix_prepare_incident;
alter table public.incidents enable trigger campusfix_audit_incident;

drop policy incidents_read on public.incidents;
create policy incidents_read on public.incidents for select to authenticated
using(private.app_is_active() and deleted_at is null and (private.app_is_admin() or reporter_id=auth.uid()));
drop policy incidents_update on public.incidents;
create policy incidents_update on public.incidents for update to authenticated
using(private.app_is_admin() and deleted_at is null) with check(private.app_is_admin());
drop policy incident_history_read on public.incident_history;
create policy incident_history_read on public.incident_history for select to authenticated
using(private.app_is_active() and exists(select 1 from public.incidents i where i.id=incident_id and i.deleted_at is null));

-- Old photographs remain private. A student sees only their own uploads or a
-- photograph attached to their report; administrators can view all reports.
drop policy campusfix_photos_read on storage.objects;
create policy campusfix_photos_read on storage.objects for select to authenticated
using(bucket_id='incident-photos' and private.app_is_active() and (
  private.app_is_admin() or (storage.foldername(name))[1]=auth.uid()::text
  or exists(select 1 from public.incidents i where i.reporter_id=auth.uid() and i.photo_url=name and i.deleted_at is null)
));
drop policy campusfix_photos_update on storage.objects;
create policy campusfix_photos_update on storage.objects for update to authenticated
using(bucket_id='incident-photos' and private.app_is_admin())
with check(bucket_id='incident-photos' and private.app_is_admin());
drop policy campusfix_photos_delete on storage.objects;
create policy campusfix_photos_delete on storage.objects for delete to authenticated
using(bucket_id='incident-photos' and private.app_is_admin());

create or replace function public.soft_delete_incident(p_incident_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare affected uuid;
begin
  if auth.uid() is null or not private.app_is_admin() then
    raise exception 'Solo un administrador puede retirar reportes.' using errcode='42501';
  end if;
  update public.incidents set deleted_at=now() where id=p_incident_id and deleted_at is null returning id into affected;
  return affected is not null;
end;
$$;

create table private.account_events(
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  target_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('admin_registered','student_removed','profile_updated')),
  details jsonb not null default '{}', created_at timestamptz not null default now()
);
alter table private.account_events enable row level security;
revoke all on private.account_events from public,anon,authenticated;

create or replace function public.admin_update_profile(
  p_actor_id uuid,p_user_id uuid,p_full_name text default null,
  p_role text default null,p_active boolean default null,p_department text default null
) returns public.profiles language plpgsql security definer set search_path='' as $$
declare target public.profiles; before_value jsonb;
begin
  perform pg_advisory_xact_lock(2026102701);
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin' and active and deleted_at is null) then
    raise exception 'Se requiere una cuenta administradora activa.' using errcode='42501';
  end if;
  select * into target from public.profiles where id=p_user_id for update;
  if not found or target.deleted_at is not null then raise exception 'Cuenta no disponible.'; end if;
  if p_role is not null and p_role <> target.role then
    raise exception 'Las cuentas administradoras requieren el registro con NIP.' using errcode='42501';
  end if;
  if p_actor_id=p_user_id and p_active is not null and p_active<>target.active then
    raise exception 'No puedes desactivar tu propia cuenta.' using errcode='42501';
  end if;
  if target.role='admin' and target.active and not coalesce(p_active,target.active)
    and not exists(select 1 from public.profiles where id<>p_user_id and role='admin' and active and deleted_at is null) then
    raise exception 'Debe permanecer un administrador activo.';
  end if;
  before_value:=to_jsonb(target);
  update public.profiles set full_name=coalesce(p_full_name,full_name),active=coalesce(p_active,active),
    department=coalesce(p_department,department) where id=p_user_id returning * into target;
  insert into private.account_events(actor_id,target_id,action,details)
  values(p_actor_id,p_user_id,'profile_updated',jsonb_build_object('before',before_value,'after',to_jsonb(target)));
  return target;
end;
$$;

-- Idempotent soft removal retains every report, user FK and historical event.
-- Edge then applies Auth's ban API; if that API fails, RLS remains fail-closed
-- and a retry can finish the Auth ban without erasing any evidence.
create function public.admin_remove_student(p_actor_id uuid,p_user_id uuid) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
  perform pg_advisory_xact_lock(2026102701);
  if not exists(select 1 from public.profiles where id=p_actor_id and role='admin' and active and deleted_at is null) then
    raise exception 'Se requiere una cuenta administradora activa.' using errcode='42501';
  end if;
  select * into target from public.profiles where id=p_user_id for update;
  if not found then raise exception 'Estudiante no encontrado.'; end if;
  if target.role<>'user' or target.id=p_actor_id then
    raise exception 'Solo se pueden eliminar cuentas de estudiantes.' using errcode='42501';
  end if;
  if target.deleted_at is not null then return target; end if;
  update public.profiles set active=false,deleted_at=now() where id=p_user_id returning * into target;
  insert into private.account_events(actor_id,target_id,action)
  values(p_actor_id,p_user_id,'student_removed');
  return target;
end;
$$;
revoke all on function public.admin_remove_student(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_remove_student(uuid,uuid) to service_role;

create table private.admin_enrollment_requests(
  request_key text not null check(char_length(request_key)=64),
  requested_at timestamptz not null default now()
);
create index admin_enrollment_requests_time_idx on private.admin_enrollment_requests(requested_at);
create index admin_enrollment_requests_key_idx on private.admin_enrollment_requests(request_key,requested_at);
alter table private.admin_enrollment_requests enable row level security;
revoke all on private.admin_enrollment_requests from public,anon,authenticated;

-- The global quota also limits requests when a client header is absent/spoofed.
-- The public Edge Function calls this BEFORE parsing or validating credentials.
create function public.consume_admin_enrollment_quota(p_request_key text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_request_key is null or p_request_key !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(2026110401);
  delete from private.admin_enrollment_requests where requested_at<now()-interval '1 day';
  if (select count(*) from private.admin_enrollment_requests where requested_at>now()-interval '15 minutes')>=30
    or (select count(*) from private.admin_enrollment_requests where request_key=p_request_key and requested_at>now()-interval '15 minutes')>=5 then
    return false;
  end if;
  insert into private.admin_enrollment_requests(request_key) values(p_request_key);
  return true;
end;
$$;
revoke all on function public.consume_admin_enrollment_quota(text) from public,anon,authenticated;
grant execute on function public.consume_admin_enrollment_quota(text) to service_role;

-- Service role only; no student or anonymous RPC can bypass the Edge NIP gate.
create function public.complete_admin_enrollment(p_user_id uuid,p_full_name text) returns public.profiles
language plpgsql security definer set search_path='' as $$
declare target public.profiles;
begin
  perform pg_advisory_xact_lock(2026102701);
  select * into target from public.profiles where id=p_user_id for update;
  if not found or target.role<>'user' or target.active or target.deleted_at is not null
    or target.created_at<now()-interval '5 minutes' then
    raise exception 'La cuenta no corresponde a un registro nuevo pendiente.' using errcode='42501';
  end if;
  update public.profiles set role='admin',active=true,full_name=p_full_name where id=p_user_id returning * into target;
  insert into private.account_events(actor_id,target_id,action) values(null,p_user_id,'admin_registered');
  return target;
end;
$$;
revoke all on function public.complete_admin_enrollment(uuid,text) from public,anon,authenticated;
grant execute on function public.complete_admin_enrollment(uuid,text) to service_role;

create or replace function public.consume_classification_quota(p_user_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,21));
  if not exists(select 1 from public.profiles where id=p_user_id and active and deleted_at is null) then return false; end if;
  if (select count(*) from private.classification_requests where user_id=p_user_id and requested_at>now()-interval '1 minute')>=12 then return false; end if;
  delete from private.classification_requests where user_id=p_user_id and requested_at<now()-interval '1 day';
  insert into private.classification_requests(user_id) values(p_user_id);
  return true;
end;
$$;
commit;
