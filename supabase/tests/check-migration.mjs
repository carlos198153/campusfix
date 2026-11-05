// Local PostgreSQL verification with PGlite. Install the optional development
// dependency @electric-sql/pglite, then run:
// node supabase/tests/check-migration.mjs
// This substitutes only Supabase Auth/Storage schemas, not the application's SQL.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const database = new PGlite();
try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role',true),'');
    $$;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/'); $$;
    grant execute on function storage.foldername(text) to authenticated;
  `);
  await database.exec(await readFile(new URL('../migrations/20261105222213_campusfix.sql', import.meta.url), 'utf8'));
  console.log('PASS: application migration executes in PostgreSQL.');
  await database.exec(await readFile(new URL('./rls.sql', import.meta.url), 'utf8'));
  console.log('PASS: original role isolation, audit and incident lifecycle assertions.');
  await database.exec(`
    insert into auth.users(id,email,raw_user_meta_data) values
      ('20000000-0000-4000-8000-000000000001','upgrade-admin@example.invalid','{"full_name":"Admin anterior"}'),
      ('20000000-0000-4000-8000-000000000002','upgrade-student@example.invalid','{"full_name":"Alumno anterior"}');
    update public.profiles set active=true where id in ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
    update public.profiles set role='admin' where id='20000000-0000-4000-8000-000000000001';
    insert into public.incidents(title,description,category,building,location,reporter_id,status)
      select 'Reporte anterior '||status,'Descripción anterior conservada.','Otros','UNACAR','Aula',
        '20000000-0000-4000-8000-000000000002'::uuid,status
      from unnest(array['Pendiente','En proceso','Resuelta','Cancelada']) as status;
  `);
  const previousReports = (await database.query('select id,status,created_at,updated_at,resolved_at from public.incidents order by id')).rows;
  const previousHistory = (await database.query('select * from public.incident_history order by id')).rows;
  await database.exec(await readFile(new URL('../migrations/20261105222523_student_reports.sql', import.meta.url), 'utf8'));
  const migratedReports = (await database.query('select id,status,created_at,updated_at,resolved_at from public.incidents order by id')).rows;
  const mapping = { Pendiente: 'Pendiente', 'En proceso': 'Urgente', Resuelta: 'Solucionado', Cancelada: 'Pendiente' };
  assert.deepEqual(migratedReports, previousReports.map(row => ({ ...row, status: mapping[row.status] })));
  assert.deepEqual((await database.query('select * from public.incident_history order by id')).rows, previousHistory);
  console.log('PASS: second migration converts old states while retaining reports, timestamps and complete historical payloads.');
  await database.exec(await readFile(new URL('./student-rls.sql', import.meta.url), 'utf8'));
  console.log('PASS: student privacy, admin-only changes, retained soft removal, protected enrollment and durable quotas.');
  console.log('Auth API, Edge deployment, actual Storage upload and hosted Supabase still require integration checks.');
} finally {
  await database.close();
}
