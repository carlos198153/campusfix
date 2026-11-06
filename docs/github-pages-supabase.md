# Conectar la base de datos y publicar con GitHub

Guía manual · 5 de noviembre de 2026. El workflow está preparado; esta guía no afirma que exista un repositorio o una publicación en tu cuenta.

## Qué usa CampusFix

| Parte                            | Servicio                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App compilada y servida por HTTP | Configurada con la URL y clave pública del proyecto real CampusFix.                                      |
| Base de datos creada             | PostgreSQL 17.11 en Supabase, referencia `kxostzjlzvydobgngcdg`, con migraciones aplicadas y RLS activo. |
| Cuentas y fotografías            | Auth y Storage desplegados; todavía faltan ajustes del Dashboard y pruebas de usuario reales.            |
| Vista portátil                   | `vista-previa.html` conserva datos locales de demostración en `localStorage`.                            |
| Publicación prevista             | GitHub Pages servirá el frontend; todavía no se creó el repositorio ni se publicó.                       |

Publicar la página no conecta la base de datos por sí solo. Los ejemplos del navegador tampoco se copian automáticamente a PostgreSQL.

## 1. Terminar Supabase sin crear otro proyecto

El [proyecto CampusFix](https://supabase.com/dashboard/project/kxostzjlzvydobgngcdg) ya tiene ambas migraciones y sus dos funciones activas. No repitas su creación ni la aplicación de SQL.

Los [tres ajustes del Dashboard](setup-supabase.md#tres-ajustes-del-dashboard-verificados) ya se guardaron y verificaron: NIP `1324` válido con HTTP 200, CORS que acepta el origen local y rechaza uno ajeno, y registro público desactivado (`disable_signup: true`). El proyecto está listo para crear la primera cuenta administradora; el registro y login completos todavía no se han probado.

Para mantenimiento futuro, consulta la ayuda de tu versión de CLI y la [guía oficial de v3](https://supabase.com/changelog/supabase-cli-v3) antes de ejecutar comandos: el destino de base de datos es local por defecto y un proyecto alojado requiere selección explícita con `--remote`. El proyecto de esta entrega ya está migrado.

### Contraseñas de administrador

CampusFix admite **5 caracteres para nuevas cuentas administradoras en la demostración**. Con Supabase real, la interfaz exige al menos **6**, y el proyecto puede imponer una longitud mayor. El servidor de Auth actual eleva cualquier mínimo inferior a 6: cambiar una opción a 5 no lo habilita. Los estudiantes siguen requiriendo 12 en CampusFix. Verificado en el [código oficial de Supabase Auth](https://github.com/supabase/auth/blob/master/internal/conf/configuration.go) y su [validación de contraseñas](https://github.com/supabase/auth/blob/master/internal/api/password.go).

## 2. Probar la conexión en tu computadora

La copia de trabajo ya tiene `.env.local` configurado e ignorado por Git; ese archivo no va en el ZIP. Para otra copia, toma los valores públicos de [variables-publicas-github.txt](variables-publicas-github.txt):

```dotenv
VITE_SUPABASE_URL=https://kxostzjlzvydobgngcdg.supabase.co
VITE_SUPABASE_ANON_KEY=COPIA_LA_CLAVE_PUBLICA_DEL_ARCHIVO_ENTREGADO
```

Abre la app o ejecuta `pnpm dev` y crea el primer administrador con el NIP `1324`; después prueba el login y un reporte de estudiante. Estos recorridos aún no se han validado con tokens reales. El último conteo sigue en cero perfiles, cero administradores activos y cero reportes; la respuesta HTTP 200 de la página confirma que el frontend se sirve.

El NIP es compartido: quien lo conoce puede crear administradores. `ADMIN_SETUP_PIN` se configura solo como secreto de Supabase; no lo agregues a las variables del frontend ni a GitHub para compilar la página.

## 3. Subir el proyecto a GitHub

Crea un repositorio llamado, por ejemplo, `campusfix`. La opción pública permite usar Pages con GitHub Free; la disponibilidad en repositorios privados depende del plan. [GitHub documenta esos requisitos de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Sube **el contenido de la carpeta del proyecto**, de modo que `package.json` quede en la raíz del repositorio. Incluye `src`, `public`, `supabase`, `docs`, los archivos de configuración, `pnpm-lock.yaml` y `.github/workflows/deploy-pages.yml`. No subas `node_modules`, `.pnpm-store`, `dist` ni `.env.local`.

Puedes usar **Add file → Upload files** en la web. Comprueba que `.github/workflows/deploy-pages.yml` aparezca con esa ruta exacta; si falta, créalo con **Add file → Create new file** y copia el archivo entregado. Mantén la rama `main`, que es la configurada en el workflow. Consulta las instrucciones oficiales para [crear el repositorio](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository) y [subir archivos](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository).

## 4. Agregar las dos variables públicas

En el repositorio abre **Settings → Secrets and variables → Actions → Variables → New repository variable** y crea:

| Nombre                   | Valor                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://kxostzjlzvydobgngcdg.supabase.co`                                                            |
| `VITE_SUPABASE_ANON_KEY` | Copia la clave pública publishable de [variables-publicas-github.txt](variables-publicas-github.txt). |

El workflow lee **Repository variables**, no los campos de Secrets. Estas dos claves de conexión pública terminan en el JavaScript del navegador; los permisos reales dependen de la sesión y RLS. No agregues `service_role`, contraseñas ni `ADMIN_SETUP_PIN`. [GitHub explica dónde crear estas variables](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

Si dejas ambas vacías, se publica una demostración local identificada. Si completas solo una, el workflow se detiene con un mensaje de configuración incompleta.

## 5. Activar Pages y ejecutar

1. Abre **Settings → Pages**.
2. En **Build and deployment → Source**, selecciona **GitHub Actions**.
3. En **Actions**, abre **Publicar CampusFix en GitHub Pages**.
4. Pulsa **Run workflow**, selecciona `main` y ejecútalo.
5. Espera que terminen `build` y `deploy`. La URL aparece en el resultado del despliegue y en Pages cuando termina correctamente.

El archivo [deploy-pages.yml](../.github/workflows/deploy-pages.yml) instala Node.js 22 y el pnpm fijado en `package.json`, ejecuta pruebas y compila `dist/`. Los cambios posteriores en `main` vuelven a activar el proceso. No necesitas proporcionar un token personal al workflow.

Para una página de proyecto, la dirección suele seguir el formato `https://TU_USUARIO.github.io/campusfix/`. El workflow obtiene la ruta base desde Pages; también permite sobrescribirla con la variable opcional `VITE_APP_BASE_PATH`. Para ese ejemplo sería `/campusfix/`; para un dominio en la raíz, `/`. La [guía de Vite](https://vite.dev/guide/static-deploy#github-pages) explica la diferencia.

Pages usa `VITE_USE_HASH_ROUTER=true`. Las rutas se verán como `/campusfix/#/arreglados`; el fragmento lo resuelve React Router y no se solicita al servidor como otra página. Esto permite recargar rutas internas en un hosting estático. [Comportamiento documentado de HashRouter](https://reactrouter.com/api/declarative-routers/HashRouter).

## 6. Autorizar el dominio en Supabase

Para la URL del ejemplo:

- En Auth, establece **Site URL** como `https://TU_USUARIO.github.io/campusfix/` y agrega `https://TU_USUARIO.github.io/campusfix/?recovery=1` a los retornos autorizados.
- Para desarrollo, autoriza `http://localhost:5173/?recovery=1`, `http://127.0.0.1:5173/?recovery=1`, `http://localhost:5175/?recovery=1` y `http://127.0.0.1:5175/?recovery=1` según los puertos utilizados.
- En [Edge Functions → Secrets](https://supabase.com/dashboard/project/kxostzjlzvydobgngcdg/functions/secrets), añade a `APP_ORIGIN` solo el origen publicado, sin ruta: `https://TU_USUARIO.github.io`. Conserva los cuatro orígenes locales y guarda el cambio.

Las URLs de Auth y el origen CORS son datos distintos: Auth necesita la ruta del repositorio, mientras CORS recibe el origen. CampusFix recibe la recuperación en esa URL base con `?recovery=1`, procesa la sesión y después abre su formulario de contraseña. No configures el retorno directamente dentro del fragmento `#`. Consulta la [configuración oficial de retornos de Supabase](https://supabase.com/docs/guides/auth/redirect-urls) y comprueba el recorrido desde un correo real.

## Comprobar y resolver problemas

Prueba acceso con ambos roles, reporte nuevo, sección **Arreglados**, cambio de estado y PDF semanal. Verifica también recargar una ruta interna y mostrar fotografías y fuentes. Registra el resultado real en [verificacion.md](verificacion.md).

| Problema                                 | Qué revisar                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Primera ejecución roja                   | Completa Pages y las variables y vuelve a ejecutar el workflow.                       |
| La página muestra demostración           | Ambas variables públicas estaban vacías al compilar; configúralas y ejecuta de nuevo. |
| Faltan fuentes o archivos                | Ruta base correcta, archivos de `public` incluidos y build actual.                    |
| Una ruta interna da 404                  | El workflow debe usar HashRouter; conserva el `#` de la URL.                          |
| Crear administrador rechaza 5 caracteres | Supabase exige al menos 6 o la política mayor del proyecto.                           |
| Funciones fallan desde Pages             | Dominio exacto en `APP_ORIGIN`, funciones desplegadas y perfil activo.                |

La URL solo se considera publicada cuando GitHub confirma `deploy` y puedes abrirla. Preparar el workflow no ejecuta el despliegue en tu cuenta.
