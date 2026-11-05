-- Run only in an isolated test project after both migrations. Fixtures roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','new-admin@example.invalid','{"full_name":"Admin Prueba","role":"admin","active":true}'),
 ('30000000-0000-4000-8000-000000000002','student-one@example.invalid','{"full_name":"Alumno Uno"}'),
 ('30000000-0000-4000-8000-000000000003','student-two@example.invalid','{"full_name":"Alumno Dos"}'),
 ('30000000-0000-4000-8000-000000000004','pending-admin@example.invalid','{"full_name":"Nuevo Admin"}');
do $$ begin
  if exists(select 1 from public.profiles where id='30000000-0000-4000-8000-000000000001' and (active or role<>'user')) then
    raise exception 'FAIL: metadata granted privileges';
  end if;
end $$;
update public.profiles set active=true where id in ('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003');
update public.profiles set role='admin' where id='30000000-0000-4000-8000-000000000001';

set local role anon;
do $$ begin
  begin perform public.complete_admin_enrollment('30000000-0000-4000-8000-000000000004','Nuevo Admin');
    raise exception 'FAIL: anonymous enrollment RPC access';
  exception when insufficient_privilege then null; end;
  begin perform public.consume_admin_enrollment_quota(repeat('a',64));
    raise exception 'FAIL: anonymous throttle RPC access';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.profiles)<>1 then raise exception 'FAIL: student sees user directory'; end if;
  if exists(select 1 from public.incidents) then raise exception 'FAIL: student sees previous users reports'; end if;
  begin update public.profiles set role='admin' where id=auth.uid();
    raise exception 'FAIL: student escalated role';
  exception when insufficient_privilege then null; end;
  begin perform public.complete_admin_enrollment(auth.uid(),'Alumno Uno');
    raise exception 'FAIL: student can invoke enrollment RPC';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_remove_student(auth.uid(),auth.uid());
    raise exception 'FAIL: student can invoke account removal';
  exception when insufficient_privilege then null; end;
end $$;
insert into public.incidents(title,description) values('Reporte alumno uno','La lámpara del aula no funciona.');
insert into public.incidents(title,description,reporter_id,status,category,priority,building,location,assignee_id,observations)
values('Reporte con campos forjados','La ventana del aula está dañada.','30000000-0000-4000-8000-000000000003','Solucionado','Electricidad','Crítica','Forjado','Forjada','30000000-0000-4000-8000-000000000001','Forjada');
do $$ declare affected integer; begin
  if (select count(*) from public.incidents)<>2 then raise exception 'FAIL: own report visibility'; end if;
  if exists(select 1 from public.incidents where reporter_id<>auth.uid() or status<>'Pendiente' or category<>'Otros'
    or building<>'Campus UNACAR' or location<>'Ver descripción' or priority<>'Media' or assignee_id is not null or observations<>'') then
    raise exception 'FAIL: forged student metadata was accepted';
  end if;
  update public.incidents set status='Solucionado' where title='Reporte alumno uno';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: student changed a status'; end if;
  begin perform public.soft_delete_incident((select id from public.incidents limit 1));
    raise exception 'FAIL: student can remove reports';
  exception when insufficient_privilege then null; end;
end $$;
insert into storage.objects(bucket_id,name) values('incident-photos',auth.uid()::text||'/one.jpg');
do $$ declare affected integer; begin
  update storage.objects set name=auth.uid()::text||'/changed.jpg' where bucket_id='incident-photos';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: student can replace submitted photos'; end if;
  delete from storage.objects where bucket_id='incident-photos';
  get diagnostics affected=row_count;
  if affected<>0 then raise exception 'FAIL: student can delete submitted photos'; end if;
end $$;

select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
insert into storage.objects(bucket_id,name) values('incident-photos',auth.uid()::text||'/two.jpg');
insert into public.incidents(title,description,photo_url) values('Reporte alumno dos','Se cayó una parte del techo.',auth.uid()::text||'/two.jpg');
do $$ begin
  if (select count(*) from public.incidents)<>1 then raise exception 'FAIL: students can read each other'; end if;
  if exists(select 1 from storage.objects where name like '30000000-0000-4000-8000-000000000002/%') then raise exception 'FAIL: cross-student photo exposure'; end if;
end $$;

select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.incidents set status='Urgente' where title='Reporte alumno uno';
update public.incidents set status='Solucionado' where title='Reporte con campos forjados';
do $$ begin
  if not exists(select 1 from public.incidents where title='Reporte alumno uno' and status='Urgente') then raise exception 'FAIL: admin status update'; end if;
  if not exists(select 1 from public.incidents where title='Reporte con campos forjados' and resolved_at is not null) then raise exception 'FAIL: resolution date'; end if;
  if not exists(select 1 from public.incident_history where actor_id=auth.uid() and action='status_changed') then raise exception 'FAIL: admin history missing'; end if;
  begin update public.incidents set status='Resuelta' where title='Reporte alumno uno';
    raise exception 'FAIL: old state still accepted';
  exception when check_violation then null; end;
end $$;
reset role;
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $$ declare removed public.profiles; denied boolean:=false; n integer; client integer; key text; begin
  begin perform public.admin_remove_student('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000003');
    raise exception 'FAIL: student actor trusted by privileged RPC';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_remove_student('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: administrator self removal';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_remove_student('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001');
    raise exception 'FAIL: removal of another administrator';
  exception when insufficient_privilege then null; end;
  begin perform public.admin_update_profile('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',p_role=>'admin');
    raise exception 'FAIL: role promotion bypasses NIP';
  exception when insufficient_privilege then null; end;
  select * into removed from public.admin_remove_student('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');
  if removed.active or removed.deleted_at is null then raise exception 'FAIL: soft removal state'; end if;
  perform public.admin_remove_student('30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000003');
  if not exists(select 1 from public.incidents where title='Reporte alumno dos' and deleted_at is null) then raise exception 'FAIL: removal destroyed report'; end if;
  if not exists(select 1 from public.incident_history where actor_id=removed.id) then raise exception 'FAIL: removal destroyed history'; end if;
  begin perform public.admin_update_profile('30000000-0000-4000-8000-000000000001',removed.id,p_active=>true);
  exception when others then denied:=true; end;
  if not denied then raise exception 'FAIL: removed account reactivated'; end if;
  perform public.complete_admin_enrollment('30000000-0000-4000-8000-000000000004','Nuevo Admin');
  if not exists(select 1 from public.profiles where id='30000000-0000-4000-8000-000000000004' and role='admin' and active and deleted_at is null) then
    raise exception 'FAIL: server admin enrollment failed';
  end if;
  if public.consume_admin_enrollment_quota(null) or public.consume_admin_enrollment_quota('invalid') then raise exception 'FAIL: invalid throttle key'; end if;
  for n in 1..5 loop
    if not public.consume_admin_enrollment_quota(repeat('a',64)) then raise exception 'FAIL: per-client quota too restrictive'; end if;
  end loop;
  if public.consume_admin_enrollment_quota(repeat('a',64)) then raise exception 'FAIL: per-client quota not enforced'; end if;
  for client in 1..5 loop
    key:=lpad(client::text,64,'0');
    for n in 1..5 loop
      if not public.consume_admin_enrollment_quota(key) then raise exception 'FAIL: global quota too restrictive'; end if;
    end loop;
  end loop;
  if public.consume_admin_enrollment_quota(repeat('f',64)) then raise exception 'FAIL: global quota not enforced'; end if;
end $$;
reset role;
do $$ begin
  if (select count(*) from private.account_events where target_id='30000000-0000-4000-8000-000000000003' and action='student_removed')<>1 then
    raise exception 'FAIL: removal audit is missing or duplicated';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  if exists(select 1 from public.incidents) or exists(select 1 from public.incident_history) then raise exception 'FAIL: removed user JWT can read reports'; end if;
  if exists(select 1 from storage.objects where bucket_id='incident-photos') then raise exception 'FAIL: removed user JWT can read photos'; end if;
  begin insert into public.incidents(title,description) values('Reporte no permitido','La cuenta retirada intenta guardar.');
    raise exception 'FAIL: removed user JWT can report';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
