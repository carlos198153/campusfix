# Verificación · Versión simplificada

Historial por fecha, actualizado el 5 de noviembre de 2026. Los resultados y capturas del 4 de noviembre se conservan como evidencia de esa versión; no son una nueva certificación visual de Arreglados o de los cambios de registro.

## Revisión del 5 de noviembre

- **64 pruebas locales aprobadas:** 20 de datos, 23 del adaptador Supabase simulado, 4 de PDF, 8 de React/jsdom, 5 de registro administrador y 4 de reglas heredadas. Vitest aísla las variables para no utilizar `.env.local` real ni ejecutar estas pruebas contra la base alojada.
- TypeScript de la aplicación y del backend aprobados.
- Build conectado de Vite aprobado y página local HTTP 200. El bundle utiliza la URL y clave pública reales; el escaneo no detectó patrones de claves privilegiadas, JWT `service_role` o claves privadas. La vista portátil entregada conserva una compilación demo separada; no se exportó desde el build conectado.
- Build para GitHub Pages con base `/campusfix-unacar/` y `VITE_USE_HASH_ROUTER=true` aprobado. La inspección estática confirmó tres referencias HTML y nueve fuentes bajo esa ruta; no equivale a una ejecución o despliegue de GitHub Actions.
- Revisión de código aprobada para el alcance actual, incluido el enlace de salto al contenido y su regresión automatizada.
- No hubo nueva comprobación visual en navegador: la infraestructura agotó el tiempo de espera de localhost. No se atribuyen las capturas anteriores a esta revisión.
- Workflow de Pages preparado, sin repositorio creado ni ejecución en GitHub. Supabase real tiene NIP, CORS y registro público configurados y verificados; solo queda iniciar y comprobar el recorrido con la primera cuenta.

## Provisión real de Supabase del 5 de noviembre

Proyecto CampusFix `kxostzjlzvydobgngcdg`, región `us-east-1`, PostgreSQL 17.11, estado ACTIVE_HEALTHY. Las dos migraciones se aplicaron mediante MCP y aparecen en el historial con versiones `20261105222213` y `20261105222523`; las fuentes SQL locales se renombraron con esos prefijos sin alterar su contenido ni el historial remoto.

| Control real                 | Resultado observado                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Edge Functions               | `register-admin` y `admin-users` ACTIVE v1; verificación JWT desactivada y activada respectivamente.                             |
| RLS                          | Activado en las ocho tablas revisadas; no es todavía una prueba de acceso con ambos roles.                                       |
| Fotografías                  | Bucket `incident-photos` privado, límite 5 MB, JPEG/PNG/WebP. Subida real aún no probada.                                        |
| Datos                        | Cero perfiles, cero administradores activos y cero reportes en el conteo real más reciente.                                      |
| Auth/settings                | HTTP 200, correo habilitado y `disable_signup: true`: registro público desactivado y verificado.                                 |
| Consulta anónima de reportes | HTTP 401, permiso rechazado como se esperaba.                                                                                    |
| `admin-users` sin JWT        | HTTP 401, solicitud de inicio de sesión y ningún dato entregado.                                                                 |
| `register-admin`             | POST de verificación del NIP `1324`: HTTP 200 con `valid: true`. No crea una cuenta por sí solo.                                 |
| CORS real                    | Origen `http://127.0.0.1:5175`: OPTIONS 204 y permiso para ese origen exacto. Origen no autorizado: 403 sin cabecera de permiso. |

La URL y clave pública reales están en `.env.local`, ignorado por Git y excluido del ZIP. El archivo público `docs/variables-publicas-github.txt` permite configurar GitHub sin incluir secretos del servidor. El usuario confirmó los ajustes guardados y las comprobaciones reales verificaron [la configuración del Dashboard](setup-supabase.md#tres-ajustes-del-dashboard-verificados). El proyecto está listo para crear el primer administrador.

**Aún no comprobado en Supabase real:** registro de cuenta, login, tokens de ambos roles, operaciones de reportes, fotos, baja/bloqueo de Auth y PDF con filas reales. Las respuestas de protección anteriores no prueban esos recorridos completos. No hubo nueva QA visual por el timeout de CUA/CDP.

## Comprobación local del 4 de noviembre

```sh
pnpm install
pnpm test
pnpm build
pnpm preview
```

La suite nueva pasó con **51 pruebas** y la compilación TypeScript/Vite fue aprobada. La suite cubre datos de demostración, adaptador Supabase simulado, PDF, flujos React, registro administrador y utilidades heredadas. Sus resultados no acreditan una conexión alojada.

Los archivos vigentes separan datos de demostración (`tests/data.test.ts`), adaptador Supabase con proveedor simulado (`tests/cloud-adapter.test.ts`), documentos (`tests/pdf.test.ts`) y flujos React (`tests/ui.test.tsx`). Las pruebas React utilizan jsdom: verifican controles y llamadas, pero no miden el diseño ni sustituyen una revisión de navegador. Las pruebas del adaptador no llaman a un proyecto alojado.

El verificador SQL local aplica ambas migraciones y las aserciones de la versión nueva. Su ejecución pasó con PGlite: comprobó la conservación de fechas e historial al migrar, privacidad por estudiante, permisos, baja, funciones de registro y cuotas. Utiliza esquemas mínimos de Auth y Storage; no prueba Auth API ni una subida remota real.

El tipado de Edge Functions pasó con `pnpm exec tsc -p supabase/tsconfig.json`. Las pruebas de backend incluyen tres casos nuevos de registro administrador en `supabase/tests/admin-enrollment.test.ts` —comparación de PIN, validación e identificación opaca de solicitudes— y cuatro pruebas de reglas heredadas del clasificador, conservadas por compatibilidad y sin interfaz vigente.

## Comprobación de navegador del 4 de noviembre

Se revisó la vista compilada de la versión simplificada en móvil y escritorio. Se observaron estos resultados con datos locales:

| Flujo                 | Resultado observado                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| NIP incorrecto        | `0000` fue rechazado.                                                                                               |
| NIP correcto          | `1324` abrió el formulario de datos de administrador.                                                               |
| Estado administrativo | Se cambió de Pendiente a Urgente, se guardó y apareció la confirmación. Se restauró Pendiente después de la prueba. |
| PDF semanal           | La semana del 2 al 8 de noviembre de 2026 mostró seis reportes y el navegador confirmó la descarga del archivo.     |

La creación y la baja de cuentas están cubiertas por pruebas React/jsdom; no se realizaron manualmente en este recorrido de navegador ni contra Supabase alojado. El revisor aprobó las cuatro capturas finales —escritorio, móvil, formulario y administración— sin fallos materiales. El PDF descargado de seis registros se renderizó en una página con descripciones completas, sin recortes y con encabezados blancos sobre azul. Esta revisión del documento concreto no certifica todos los tamaños de datos posibles.

## Matriz funcional vigente

| Caso                            | Resultado esperado                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio de sesión                | Una cuenta activa accede; contraseña incorrecta y cuenta dada de baja se rechazan.                                                                   |
| Demostración                    | Empieza como estudiante, anuncia datos locales y permite explorar roles mediante controles etiquetados.                                              |
| PIN incorrecto                  | No permite avanzar a la creación de administrador.                                                                                                   |
| PIN correcto                    | Permite completar nombre, correo y contraseña; el servidor vuelve a verificar el PIN al crear.                                                       |
| Secreto ausente                 | `register-admin` indica registro deshabilitado.                                                                                                      |
| Límite de registro              | Rechaza al superar límites; persiste entre ejecuciones.                                                                                              |
| Creación administrador          | Produce perfil activo de rol admin; no expone claves de servicio.                                                                                    |
| Contraseña administradora nueva | Demo y validación propia admiten 5; conectada exige al menos 6 o la política mayor de Auth. Estudiantes conservan 12.                                |
| Reporte estudiante              | Solo solicita título, descripción y fotografía opcional; se guarda Pendiente.                                                                        |
| Privacidad de reportes          | Estudiante A no consulta la fila ni foto del estudiante B.                                                                                           |
| Permisos estudiante             | No actualiza estados, edita reportes, administra estudiantes ni usa la consulta semanal.                                                             |
| Reporte administrador           | Puede enviar un reporte y consultar todos los reportes.                                                                                              |
| Estados                         | El administrador guarda Pendiente, Urgente o Solucionado; el estudiante lee el cambio.                                                               |
| Arreglados                      | Solucionado sale de la lista activa y aparece en Arreglados; reabrirlo lo devuelve a pendientes/urgentes. Mantiene privacidad por rol y PDF semanal. |
| Crear estudiante                | El administrador crea una cuenta `user`; el estudiante no puede crear cuentas.                                                                       |
| Baja por mala conducta          | Confirma la selección, marca deleted_at, desactiva y bloquea Auth, conservando reportes.                                                             |
| Sesión antigua                  | La cuenta dada de baja no obtiene datos con su token previo.                                                                                         |
| Semana                          | Incluye lunes a domingo en Ciudad de México y excluye el lunes siguiente.                                                                            |
| PDF                             | Solo administrador, periodo y filas coinciden con la selección; descarga legible con paginación.                                                     |
| Fotografía                      | JPEG/PNG/WebP hasta 5 MB; bucket privado y rechazo de acceso ajeno.                                                                                  |
| Interfaz                        | Teclado, foco del diálogo, pantallas pequeñas y mensajes de error permiten completar los flujos.                                                     |
| Fallo de conexión               | No muestra éxito sin guardar ni cambia a datos locales silenciosamente.                                                                              |
| Pages                           | Build respeta la ruta del repositorio, carga archivos y usa fragmentos para recargar rutas internas.                                                 |
| Recuperación en Pages           | Callback a la base con `?recovery=1`, sesión procesada y navegación a `/restablecer`; requiere comprobar correo real.                                |

## Ejecutar pruebas remotas

Prepara un administrador y dos estudiantes con reportes distintos, además de una cuenta de prueba que puedas dar de baja. Usa la clave pública y tokens de esos usuarios al comprobar RLS; el propietario SQL y `service_role` omiten el modelo ordinario de permisos.

Comprueba las peticiones directas además de los controles visibles: lectura de un reporte ajeno, cambio de estado como estudiante y llamada de `admin-users` sin rol deben rechazarse. Para el PIN, prueba tanto el paso de verificación como la creación final. El límite debe consumirse también ante una carga inválida según la implementación del servidor.

Para la semana de prueba usa lunes 2 a domingo 8 de noviembre de 2026 en `America/Mexico_City`, con registros próximos a ambas medianoches. No filtres utilizando únicamente la fecha UTC del timestamp.

## Registro de la revisión

| Fecha      | Entorno                     | Caso                                                 | Resultado                                                                                                                     |
| ---------- | --------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-04 | Local                       | Suite nueva                                          | 51 pruebas aprobadas: 19 de datos, 15 del adaptador simulado, 4 de PDF, 6 de React, 3 de registro y 4 de reglas heredadas.    |
| 2026-11-04 | Local                       | Compilación y exportación final                      | TypeScript, Vite y generación del HTML portátil aprobados.                                                                    |
| 2026-11-04 | PostgreSQL local con PGlite | Ambas migraciones, preservación y nuevos permisos    | Aprobado; Auth y Storage simulados en el entorno local.                                                                       |
| 2026-11-04 | Local                       | Tipado de Edge Functions                             | Aprobado.                                                                                                                     |
| 2026-11-04 | Local                       | Pruebas de funciones de backend                      | 3 pruebas nuevas de registro y 4 de reglas heredadas aprobadas.                                                               |
| 2026-11-04 | Navegador                   | Interfaz estudiante                                  | Revisada en móvil y escritorio.                                                                                               |
| 2026-11-04 | Navegador                   | PIN incorrecto                                       | El valor de prueba 0000 fue rechazado.                                                                                        |
| 2026-11-04 | Navegador                   | PIN correcto                                         | `1324` abrió el formulario de creación; alta manual no realizada.                                                             |
| 2026-11-04 | Navegador                   | Cambio de estado                                     | Pendiente → Urgente guardado con confirmación; restaurado después.                                                            |
| 2026-11-04 | Navegador y render PDF      | PDF semanal                                          | Semana 2–8 de noviembre: seis registros, descarga confirmada y una página revisada sin recortes, con descripciones completas. |
| 2026-11-04 | Pruebas React/jsdom         | Crear administrador, crear y dar de baja estudiantes | Aprobado dentro de las seis pruebas de interfaz; sin prueba manual alojada.                                                   |
| 2026-11-04 | Revisión visual             | Cuatro capturas finales y PDF de prueba              | Aprobados en el alcance observado; sin fallos materiales en escritorio, móvil, formulario y administración.                   |
| Pendiente  | Supabase alojado            | Primera cuenta y operaciones con usuarios            | Configuración de servidor verificada; todavía no se creó ni probó una cuenta real.                                            |
| 2026-11-04 | Publicación                 | Versión simplificada                                 | Intento bloqueado por aprobación; sin URL confirmada.                                                                         |
| 2026-11-05 | Local                       | Suite actual                                         | 64 pruebas aprobadas; app/backend TypeScript y revisión de código aprobados.                                                  |
| 2026-11-05 | Local                       | Build raíz, HTML portátil y build Pages              | Aprobados; Pages se compiló con `/campusfix-unacar/` y HashRouter.                                                            |
| 2026-11-05 | Navegador                   | Revisión visual nueva                                | No completada por timeout de infraestructura; no se certifican nuevas capturas.                                               |
| 2026-11-05 | GitHub Pages                | Workflow preparado                                   | Sin repositorio creado, sin ejecución remota y sin URL pública confirmada.                                                    |
| 2026-11-05 | Supabase alojado            | Provisión, migraciones y funciones                   | Proyecto real, dos migraciones aplicadas y dos Edge Functions ACTIVE v1.                                                      |
| 2026-11-05 | HTTP real                   | Protección y configuración guardada                  | Auth 200 con disable_signup:true; NIP 1324:200 valid:true; CORS local 204 exacto y origen ajeno 403; página local 200.        |

La publicación y las comprobaciones conectadas no se declaran aprobadas por existir una integración en código. En el intento anterior del 4 de noviembre, el helper de publicación requirió una aprobación al introducir su credencial mediante `write_stdin`; la revisión automática rechazó la acción porque `Granular.sandbox_approval=false`. El 5 de noviembre se preparó la ruta manual de GitHub solicitada, sin una conexión autenticada que permitiera crear el repositorio o publicar desde esta sesión.
