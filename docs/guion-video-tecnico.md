# Video 2 · Arquitectura y permisos

**Duración prevista:** 4 minutos y 30 segundos. Versión simplificada del 4 de noviembre de 2026. Este archivo contiene el guion, no un video grabado.

## Preparación

Abre `package.json`, `src/lib/data.ts`, `src/lib/validation.ts`, ambas migraciones, `register-admin`, `admin-users` y el generador PDF. Ten a mano resultados actuales de las pruebas. Oculta claves, tokens y contraseñas; el PIN compartido solicitado no debe confundirse con esas credenciales.

| Tiempo | Acción | Narración sugerida |
|---|---|---|
| 0:00–0:30 | Mostrar estructura y dependencias. | «CampusFix usa React, Vite y TypeScript, con navegación de React Router y consultas de TanStack Query. Los formularios utilizan Zod y los reportes PDF, jsPDF y AutoTable. Las fuentes se alojan con el proyecto.» |
| 0:30–1:00 | Mostrar arquitectura y `dataService`. | «La interfaz llama a una capa de datos. Con las variables públicas configuradas usa Supabase; sin ellas muestra una demostración identificada. Una falla de conexión no se presenta como un cambio exitoso a la nube.» |
| 1:00–1:40 | Abrir la migración de noviembre y las políticas. | «La actualización conserva el esquema y los reportes previos. El rol user se presenta como Estudiante. Sus políticas permiten insertar reportes y consultar solo los propios. La administración ve el conjunto y modifica el estado. Los tres estados son Pendiente, Urgente y Solucionado.» |
| 1:40–2:20 | Mostrar `register-admin` y el nombre del secreto. | «El registro de administrador no requiere una sesión previa. El servidor valida ADMIN_SETUP_PIN y limita intentos con estado persistente en PostgreSQL. Sin secreto, el registro se deshabilita. El PIN 1324 es compartido: conocerlo permite crear un administrador, por lo que no representa una validación de identidad institucional.» |
| 2:20–2:55 | Abrir la función administrativa y la baja lógica. | «La administración de estudiantes sí requiere token y rol administrador activo. Una baja marca deleted_at, desactiva el perfil y bloquea Auth, conservando reportes e historial. Las políticas también deben rechazar una sesión antigua de esa cuenta.» |
| 2:55–3:25 | Mostrar el helper de semana y la consulta PDF. | «La semana debe empezar en lunes. Se seleccionan las fechas de creación de lunes a domingo en America/Mexico_City. La consulta semanal exige administrador y el PDF se construye con esa selección.» |
| 3:25–4:00 | Mostrar resultados actuales de pruebas y build. | «Estas son las pruebas ejecutadas de la revisión actual. Comprueban permisos, estados y límites de fechas según su alcance. La compilación produce el frontend. Las pruebas locales no reemplazan Auth API, Storage y RLS en un proyecto alojado.» |
| 4:00–4:30 | Mostrar guía Supabase, README y registro de verificación. | «Para operar hay que aplicar ambas migraciones, desplegar las funciones, configurar el secreto y las variables públicas y comprobar ambos roles. La documentación registra qué se verificó y qué necesita servicios reales. El HTML portátil permite mostrar la demo sin servidor.» |

## Presentar evidencia con precisión

Utiliza solo cifras y resultados que correspondan a esta revisión. Las pruebas de octubre pertenecen al alcance anterior. Si Supabase no está configurado, explica: «La integración está preparada; las comprobaciones remotas requieren el proyecto y sus credenciales». No muestres `service_role` ni conviertas la demostración del PIN en una afirmación de seguridad de producción.
