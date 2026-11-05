-- Run with the migration owner in an isolated Supabase test project.
-- Every fixture is rolled back. A failed assertion aborts the transaction.
begin;

insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','campusfix-test-admin@example.invalid','{"full_name":"Admin Prueba","role":"admin","active":true}'),
 ('10000000-0000-4000-8000-000000000002','campusfix-test-user@example.invalid','{"full_name":"Usuario Prueba"}'),
 ('10000000-0000-4000-8000-000000000003','campusfix-test-disabled@example.invalid','{"full_name":"Desactivado Prueba"}');

do $$ begin
  if exists(select 1 from public.profiles where id='10000000-0000-4000-8000-000000000001' and (role <> 'user' or active)) then
    raise exception 'FAIL: Auth metadata granted privileges';
  end if;
end $$;
update public.profiles set role='admin',active=true where id='10000000-0000-4000-8000-000000000001';
update public.profiles set active=true where id='10000000-0000-4000-8000-000000000002';
update auth.users set email='campusfix-test-renamed@example.invalid' where id='10000000-0000-4000-8000-000000000002';
do $$ begin
  if not exists(select 1 from public.profiles where id='10000000-0000-4000-8000-000000000002' and email='campusfix-test-renamed@example.invalid') then
    raise exception 'FAIL: Auth email and profile diverged';
  end if;
end $$;

set local role anon;
do $$ begin
  begin
    perform count(*) from public.incidents;
    raise exception 'FAIL: anonymous data access';
  exception when insufficient_privilege then null; end;
  begin
    perform public.soft_delete_incident(gen_random_uuid());
    raise exception 'FAIL: anonymous operational RPC access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);

do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'FAIL: regular user can list profiles'; end if;
  begin
    update public.profiles set role='admin' where id=auth.uid();
    raise exception 'FAIL: privilege escalation succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_update_profile(auth.uid(),auth.uid(),p_role=>'admin');
    raise exception 'FAIL: privileged RPC exposed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.incident_history(incident_id,actor_name,action) values(gen_random_uuid(),'Fraude','created');
    raise exception 'FAIL: audit injection succeeded';
  exception when insufficient_privilege then null; end;
end $$;

insert into storage.objects(bucket_id,name) values('incident-photos',auth.uid()::text || '/fixture.jpg');
do $$ begin
  begin
    insert into storage.objects(bucket_id,name) values('incident-photos','10000000-0000-4000-8000-000000000001/forged.jpg');
    raise exception 'FAIL: storage upload impersonation';
  exception when insufficient_privilege then null; end;
end $$;

insert into public.incidents(title,description,category,building,location,reporter_id)
values('Incidencia de prueba','La lámpara del salón no enciende.','Electricidad','Prueba','Aula de pruebas',auth.uid());
do $$ declare incident public.incidents; begin
  select * into incident from public.incidents where title='Incidencia de prueba';
  if incident.folio !~ '^INC-[0-9]{6,}$' or incident.reporter_id <> auth.uid() then raise exception 'FAIL: generated identity'; end if;
  if (select count(*) from public.incident_history where incident_id=incident.id and action='created') <> 1 then raise exception 'FAIL: missing creation audit'; end if;
end $$;
update public.incidents set status='Resuelta', observations='Revisión completada.' where title='Incidencia de prueba';
do $$ begin
  if exists(select 1 from public.incidents where title='Incidencia de prueba' and resolved_at is null) then raise exception 'FAIL: resolution timestamp'; end if;
  if not exists(select 1 from public.incident_history where action='status_changed' and changes ? 'status') then raise exception 'FAIL: missing status audit'; end if;
  begin
    delete from public.incidents where title='Incidencia de prueba';
    raise exception 'FAIL: physical delete succeeded';
  exception when insufficient_privilege then null; end;
end $$;
do $$ declare incident_id uuid; begin
  select id into incident_id from public.incidents where title='Incidencia de prueba';
  if not public.soft_delete_incident(incident_id) then raise exception 'FAIL: logical delete failed'; end if;
  if public.soft_delete_incident(incident_id) then raise exception 'FAIL: repeated delete reported success'; end if;
  if exists(select 1 from public.incidents where title='Incidencia de prueba') then raise exception 'FAIL: deleted incidence visible'; end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.categories) then raise exception 'FAIL: inactive account can read data'; end if;
  if exists(select 1 from storage.objects where bucket_id='incident-photos') then raise exception 'FAIL: inactive account can read photos'; end if;
  begin
    perform public.soft_delete_incident(gen_random_uuid());
    raise exception 'FAIL: inactive account can invoke operational RPC';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.incidents(title,description,category,building,location,reporter_id)
    values('Bloqueada','La cuenta no debe poder guardar.','Otros','Prueba','Prueba',auth.uid());
    raise exception 'FAIL: inactive account can create';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.profiles) < 3 then raise exception 'FAIL: admin cannot list users'; end if;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare n integer; begin
  begin
    perform public.admin_update_profile('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',p_role=>'user');
    raise exception 'FAIL: admin can demote own account';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_update_profile('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',p_role=>'user');
    raise exception 'FAIL: privileged RPC trusts a non-admin actor';
  exception when insufficient_privilege then null; end;
  perform public.admin_update_profile('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',p_role=>'admin');
  if not exists(select 1 from public.profiles where id='10000000-0000-4000-8000-000000000002' and role='admin') then
    raise exception 'FAIL: legitimate admin role assignment failed';
  end if;
  for n in 1..12 loop
    if not public.consume_classification_quota('10000000-0000-4000-8000-000000000001') then raise exception 'FAIL: quota denied too early'; end if;
  end loop;
  if public.consume_classification_quota('10000000-0000-4000-8000-000000000001') then raise exception 'FAIL: quota did not limit requests'; end if;
end $$;
reset role;
rollback;
