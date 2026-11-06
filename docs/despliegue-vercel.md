# Publicar CampusFix

Versión simplificada del 4 de noviembre de 2026. Necesitas una cuenta del proveedor de publicación y un proyecto Supabase configurado. No se da por publicada esta revisión.

## Preparar

1. Sigue [la guía de Supabase](setup-supabase.md): ambas migraciones, Auth, Storage y funciones `register-admin` y `admin-users`.
2. Configura `ADMIN_SETUP_PIN=1324` únicamente en Supabase. Quien conozca ese PIN puede crear un administrador; revisa ese alcance antes de abrir el registro en un dominio accesible.
3. Ejecuta `pnpm test` y `pnpm build`.
4. Revisa los flujos de ambos roles con `pnpm preview`.
5. Excluye `.env.local`, contraseñas y claves privadas de Git.

## Configurar Vercel

Importa el repositorio y selecciona la carpeta de `package.json` como raíz.

| Opción | Valor |
|---|---|
| Framework | Vite |
| Instalación | `pnpm install` |
| Compilación | `pnpm build` |
| Salida | `dist` |
| Variables de build | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

No agregues `ADMIN_SETUP_PIN` ni `service_role` a variables `VITE_*`. [`vercel.json`](../vercel.json) permite recargar rutas de React Router. Al cambiar variables públicas, crea un nuevo despliegue.

## Dominio y comprobación

Autoriza el origen HTTPS definitivo en `APP_ORIGIN` de las funciones y en la configuración de Auth. Agrega solo retornos que controle la aplicación. Revisa [la matriz de pruebas](verificacion.md) después de publicar.

Comprueba registro administrador con PIN, inicio de sesión, estudiante que ve solo sus reportes, cambio de estado administrativo, baja de estudiante que conserva los reportes y PDF semanal. La demostración HTML portátil no reemplaza un despliegue ni prueba los servicios conectados.

Si la publicación se realiza con otro proveedor, conserva los mismos requisitos: servir `dist/`, resolver rutas SPA, configurar las dos variables públicas al compilar y autorizar el origen en el backend. El resultado y la URL deben registrarse cuando la publicación termine realmente.
