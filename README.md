# CampusFix · UNACAR

**Reporta, gestiona y transforma tu campus.** Revisión del 5 de noviembre de 2026: los estudiantes reportan problemas y consultan su avance; los administradores atienden los reportes y generan el PDF semanal. Los solucionados se consultan en **Arreglados**.

La aplicación compilada y servida por HTTP está configurada con el proyecto real de Supabase. **Los secretos, el NIP y la desactivación del registro público ya se guardaron y verificaron**. La app está lista para que crees la primera cuenta administradora; todavía no se ha probado un registro o login completo. El archivo `vista-previa.html` se conserva como demostración local separada.

## Qué base de datos usa

La base real es **PostgreSQL 17.11 en Supabase**, proyecto **CampusFix**, referencia `kxostzjlzvydobgngcdg`, región `us-east-1`. Ya se aplicaron las dos migraciones, se desplegaron las dos Edge Functions y se verificaron RLS y el bucket privado de fotografías. [Abrir el Dashboard del proyecto](https://supabase.com/dashboard/project/kxostzjlzvydobgngcdg).

La **vista portátil de demostración** utiliza `localStorage` del navegador, sin conexión a esa base. Sus ejemplos no se migran automáticamente. El proyecto real todavía tiene cero perfiles y cero reportes; no se ha comprobado el alta o inicio de sesión de usuarios reales. La [guía de Supabase](docs/setup-supabase.md) identifica exactamente lo terminado y lo pendiente.

## Ejecutar

Requisitos: Node.js 22 LTS compatible y pnpm.

```sh
pnpm install
pnpm dev
```

Para comprobar y compilar:

```sh
pnpm test
pnpm build
pnpm preview
```

Vite muestra la dirección local. `pnpm build` crea `dist/` y `pnpm preview` sirve esa versión compilada.

## Qué permite cada rol

| Acción                                                | Estudiante   | Administrador                    |
| ----------------------------------------------------- | ------------ | -------------------------------- |
| Crear reporte con título, descripción y foto opcional | Sí           | Sí                               |
| Consultar reportes                                    | Solo propios | Todos                            |
| Leer el estado                                        | Sí           | Sí                               |
| Cambiar estado                                        | No           | Pendiente, Urgente o Solucionado |
| Crear estudiantes y darlos de baja                    | No           | Sí                               |
| Descargar PDF semanal de lunes a domingo              | No           | Sí                               |

El rol interno `user` se muestra como **Estudiante**. Los estudiantes no editan lo enviado ni cambian estados.

## Crear una cuenta administradora

En el inicio de sesión, selecciona **Crear cuenta de administrador**, introduce el PIN `1324` y completa nombre, correo y contraseña. Las nuevas cuentas administradoras admiten 5 caracteres en demostración; con Supabase real se requieren al menos 6 o el mínimo mayor del proyecto. Las cuentas de estudiantes conservan el mínimo de 12. [Límite del proveedor y configuración](docs/setup-supabase.md#contraseñas-de-administrador-y-estudiante).

En una instalación conectada, el PIN debe existir como secreto `ADMIN_SETUP_PIN` de `register-admin`; se verifica en el servidor y se limita la frecuencia de intentos. Sin ese secreto, el registro se deshabilita. En demostración, el PIN se comprueba solo en el navegador.

**Cualquier persona que conozca el PIN puede crear una cuenta administradora.** Este mecanismo compartido forma parte del alcance solicitado; no equivale a autenticación institucional fuerte. Consulta [la configuración del backend](docs/setup-supabase.md).

## Configuración de Supabase confirmada

1. `ADMIN_SETUP_PIN=1324` guardado: la verificación real respondió HTTP 200 con `valid: true`.
2. `APP_ORIGIN` guardado y probado: el origen local permitido recibió 204 con su origen exacto y uno no autorizado recibió 403. [Valores de referencia](docs/setup-supabase.md#tres-ajustes-del-dashboard-verificados).
3. Registro público ordinario desactivado: Auth respondió HTTP 200 con `disable_signup: true`.

El último conteo real sigue en cero perfiles, cero administradores activos y cero reportes. Abre la app y usa **Crear cuenta de administrador** con NIP `1324` para iniciar el primer registro. `.env.local` contiene la configuración pública real y está excluido de Git y del ZIP; para otra copia o GitHub usa [las variables públicas entregadas](docs/variables-publicas-github.txt). Nunca pongas `service_role` o `ADMIN_SETUP_PIN` en variables `VITE_*`.

## Vista previa portátil

La entrega permite abrir [vista-previa.html](vista-previa.html) sin servidor. Este archivo conserva una compilación **solo de demostración**, con JavaScript, estilos y fuentes incluidos y rutas con `#`. Su separación respecto del build conectado se verificó.

Conserva ese archivo: no lo regeneres a partir del `dist/` conectado ni exportes con `.env.local` real. Una nueva vista de demostración necesita un build aislado con las dos variables Supabase vacías; el exportador no elimina una conexión real ya compilada.

## Documentación

- [Manual de usuario](docs/manual-usuario.md).
- [Manual técnico](docs/manual-tecnico.md).
- [Supabase, migración y registro administrador](docs/setup-supabase.md).
- [Guía manual de GitHub Pages y Supabase](docs/github-pages-supabase.md).
- [Publicación en Vercel](docs/despliegue-vercel.md).
- [Verificación vigente y límites](docs/verificacion.md).
- [Guion del video funcional](docs/guion-video-funcional.md).
- [Guion del video técnico](docs/guion-video-tecnico.md).
- [Producto](PRODUCT.md) y [diseño](DESIGN.md).

La infraestructura y configuración de Supabase están listas para crear el primer administrador. Aún falta comprobar el acceso y las operaciones con tokens reales. La referencia a UNACAR y el delfín corresponden a un proyecto académico y no sustituyen su identidad oficial.

Comprobaciones del 5 de noviembre: **64 pruebas locales aprobadas con entorno aislado de `.env.local`**, TypeScript de app/backend y PGlite aprobados. Build conectado de Vite aprobado y servidor local HTTP 200; la URL y la clave pública reales aparecen en el bundle, sin secretos privilegiados detectados en el escaneo. En Supabase se verificaron migraciones, RLS, bucket y respuestas HTTP de protección. Aún no se prueban registro, login o fotos con usuarios reales. No hubo nueva QA visual por timeout ni despliegue en GitHub. Consulta [verificacion.md](docs/verificacion.md).

## Publicar con GitHub

Se incluye [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml). Sube el contenido del proyecto a un repositorio con `package.json` en su raíz, agrega las dos variables públicas de Supabase en **Settings → Secrets and variables → Actions → Variables** y selecciona **GitHub Actions** en **Settings → Pages**. Sigue [los pasos completos](docs/github-pages-supabase.md).

El workflow instala pnpm, prueba, compila y publica `dist/`; utiliza rutas con `#` para Pages. Sin ambas variables públicas publica una demostración identificada, no una base compartida. No se creó un repositorio ni se ejecutó este workflow en una cuenta de GitHub durante la entrega. No hay una URL pública confirmada.
