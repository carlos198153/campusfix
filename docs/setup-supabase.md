# Supabase de CampusFix · Configuración verificada

Estado comprobado el 5 de noviembre de 2026. El proyecto real ya está creado; no necesitas crear otro ni volver a aplicar sus migraciones.

## Proyecto creado

| Dato                    | Valor                                      |
| ----------------------- | ------------------------------------------ |
| Nombre                  | CampusFix                                  |
| Referencia              | `kxostzjlzvydobgngcdg`                     |
| API pública             | `https://kxostzjlzvydobgngcdg.supabase.co` |
| Región / base           | `us-east-1` / PostgreSQL 17.11             |
| Estado de provisión     | ACTIVE_HEALTHY                             |
| Datos al último control | 0 perfiles y 0 reportes                    |

[Abrir el Dashboard de CampusFix](https://supabase.com/dashboard/project/kxostzjlzvydobgngcdg). El [registro público del proyecto](../supabase/proyecto-conectado.json) contiene metadatos, no claves privilegiadas.

Ya se aplicaron las fuentes SQL siguientes, alineadas con las versiones del historial remoto:

1. [`20261105222213_campusfix.sql`](../supabase/migrations/20261105222213_campusfix.sql).
2. [`20261105222523_student_reports.sql`](../supabase/migrations/20261105222523_student_reports.sql).

Las dos funciones están ACTIVE, versión 1: `register-admin` con `verify_jwt=false` y `admin-users` con `verify_jwt=true`. Ocho tablas tienen RLS activado. `incident-photos` es privado y admite JPEG, PNG y WebP de hasta 5 MB. Esto comprueba la infraestructura; no acredita todavía un recorrido de usuario autenticado.

## Tres ajustes del Dashboard verificados

Los secretos siguientes ya se guardaron. Puedes consultarlos en [Edge Functions → Secrets](https://supabase.com/dashboard/project/kxostzjlzvydobgngcdg/functions/secrets):

| Name              | Value                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `ADMIN_SETUP_PIN` | `1324`                                                                                    |
| `APP_ORIGIN`      | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:5175,http://127.0.0.1:5175` |

Son valores del servidor, no campos del formulario de inicio de sesión.

En [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/kxostzjlzvydobgngcdg/auth/providers), **Allow new users to sign up** ya quedó desactivado. Auth respondió HTTP 200 con `disable_signup: true` y correo habilitado. CampusFix crea cuentas mediante sus funciones.

**Verificado el 5 de noviembre:** el NIP `1324` respondió HTTP 200 con `valid: true`. El preflight CORS desde `http://127.0.0.1:5175` respondió 204 con ese origen exacto; un origen no autorizado recibió 403 sin cabecera de permiso. La página local respondió HTTP 200. Los ajustes están listos para crear la primera cuenta; aún hay cero perfiles, cero administradores activos y cero reportes.

## Configuración de la app y de GitHub

`.env.local` ya contiene la URL y la clave pública reales; está ignorado por Git y no se incluye en el ZIP. No lo sobrescribas ni lo subas. Para otra copia o para las **Repository variables** de GitHub, utiliza [variables-publicas-github.txt](variables-publicas-github.txt).

`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` son públicos. `service_role`, claves secretas y `ADMIN_SETUP_PIN` permanecen fuera del frontend. La vista `vista-previa.html` se conserva como demo independiente y no debe regenerarse usando el build conectado.

Cuando publiques con GitHub, añade a `APP_ORIGIN` el origen real `https://TU_USUARIO.github.io`, sin el nombre del repositorio. En Auth configura la URL base publicada y el retorno `https://TU_USUARIO.github.io/TU_REPO/?recovery=1`. Para pruebas locales, autoriza ese callback en los puertos 5173 y 5175 tanto con `localhost` como con `127.0.0.1`. La [guía de GitHub](github-pages-supabase.md) detalla esos pasos.

## Contraseñas de administrador y estudiante

CampusFix admite 5 caracteres para nuevas cuentas administradoras en demo y en su validación propia. Supabase Auth real aplica un mínimo de 6 o una política mayor del proyecto. Los estudiantes conservan 12 en CampusFix. El endpoint informa del mínimo real si Auth devuelve `weak_password` (422). No configures un mínimo de 5 esperando que Supabase lo acepte: [configuración oficial](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go) y [validación del servicio](https://github.com/supabase/auth/blob/master/internal/api/password.go).

El NIP `1324` es compartido: quien lo conoce puede crear administradores. La función lo verifica en el servidor y limita solicitudes; ese mecanismo no acredita identidad institucional. Sin el secreto, el registro queda deshabilitado.

## Qué falta verificar

Ahora crea el primer administrador y comprueba con sesiones reales: registro, login, estudiante que ve solo sus reportes, fotografía privada, cambio de estado, baja y PDF semanal. Esos recorridos completos todavía no están probados. La cuenta dada de baja debe quedar bloqueada aunque conserve un token anterior. Una URL de imagen ya firmada puede durar hasta su vencimiento.

Por ahora se verificaron Auth/settings HTTP 200, rechazo anónimo de reportes HTTP 401 y rechazo de `admin-users` sin JWT HTTP 401. Esos controles no prueban registro, login ni subida de fotos. Consulta [verificacion.md](verificacion.md) para los resultados exactos.

## Mantenimiento de migraciones

Las migraciones remotas anteriores ya están aplicadas. Antes de usar la CLI para cambios futuros, consulta `supabase --help`, la ayuda del subcomando y la [guía oficial de CLI v3](https://supabase.com/changelog/supabase-cli-v3). En v3, los comandos de base de datos apuntan por defecto al entorno local; un destino alojado requiere seleccionar explícitamente `--remote`. No repitas las migraciones iniciales ni sigas una receta de otra versión sin comprobar su destino e historial.
