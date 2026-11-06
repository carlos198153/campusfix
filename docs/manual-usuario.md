# Manual de usuario · CampusFix

Versión simplificada · Revisión del 5 de noviembre de 2026.

## 1. Conocer el entorno

CampusFix permite avisar de un problema del campus y consultar su avance. Comprueba el aviso que identifica el entorno:

- **Demostración local:** ejemplos guardados en el navegador. Puedes explorar los roles mediante controles identificados; no se envían reportes a la universidad.
- **Supabase configurado:** cuentas y reportes pertenecen al proyecto conectado por el responsable de la instalación.

La demostración comienza como estudiante. Los cambios locales no se sincronizan entre dispositivos. El archivo `vista-previa.html` también sirve para explorar la demostración sin un servidor; sus rutas incluyen `#`.

## 2. Acceder

Los estudiantes utilizan el correo y la contraseña de la cuenta que les haya creado un administrador. Escribe ambos datos en el inicio de sesión y pulsa **Entrar**. Si la cuenta está inactiva o fue dada de baja, contacta al responsable del sistema.

Los controles de demostración permiten explorar sin introducir credenciales reales. La demostración no valida una contraseña contra la universidad. Al terminar en un equipo compartido, cierra sesión.

La opción **Olvidé mi contraseña** solicita un enlace al correo de la cuenta cuando Supabase está conectado. Su entrega depende de la configuración de correo. La demostración local no envía esos mensajes.

### Crear una cuenta de administrador

1. En el inicio de sesión, pulsa **Crear cuenta de administrador**.
2. En **NIP de administración**, introduce el PIN `1324` y pulsa **Continuar**.
3. Completa nombre, correo y contraseña: mínimo 5 caracteres en demostración; conectado a Supabase, mínimo 6 o la longitud mayor que indique el servicio. Este cambio solo afecta al alta de administradores; los estudiantes mantienen 12.
4. Confirma y atiende la respuesta del sistema.

En una instalación conectada, la función del servidor debe estar configurada para permitir este registro. Si indica que no está disponible, solicita al responsable que configure `ADMIN_SETUP_PIN`.

**Quien conoce el PIN puede crear una cuenta administradora.** Es un PIN compartido previsto para este proyecto; no acredita pertenencia a la institución. En la demostración se comprueba en el navegador y no protege un sistema real.

## 3. Hacer un reporte

1. Pulsa **Hacer un reporte**.
2. Escribe un título breve que identifique el problema.
3. Describe qué ocurre y dónde se encuentra. Por ejemplo: «La lámpara del aula 3 del edificio B no enciende desde esta mañana».
4. Si ayuda a entender el problema, añade una fotografía JPEG, PNG o WebP de hasta 5 MB.
5. Revisa los datos y envía el reporte.

La ubicación se explica en la descripción. No es obligatorio adjuntar una foto. Evita incluir rostros, documentos o datos personales innecesarios. Los errores de validación indican qué dato debe corregirse; espera la confirmación de envío antes de abandonar la pantalla.

Ante un peligro inmediato, sigue el protocolo de emergencia del campus. El formulario no sustituye ese aviso.

## 4. Consultar mis reportes

Como estudiante, la lista muestra los reportes de tu cuenta. Abre una tarjeta para leer su título, descripción, fotografía disponible y estado.

La lista principal conserva los reportes pendientes y urgentes. Cuando la administración marca uno como Solucionado, se mueve a **Arreglados**, accesible desde la navegación. Allí puedes consultar tus problemas atendidos sin mezclarlos con los que siguen abiertos.

| Estado | Significado |
|---|---|
| Pendiente | El reporte está registrado y espera atención. |
| Urgente | La administración lo ha señalado para atención urgente. |
| Solucionado | La administración ha marcado el problema como atendido. |

El estudiante consulta el resultado de su envío. Los cambios de estado corresponden a administradores. Si necesitas aportar una corrección o información adicional, comunícala al responsable de mantenimiento según el procedimiento de tu institución.

## 5. Atender reportes como administrador

La cuenta administradora puede usar **Hacer un reporte** y también consultar los reportes de todos los usuarios. Abre el reporte que necesites atender, selecciona **Pendiente**, **Urgente** o **Solucionado** y guarda el cambio según el control mostrado.

Revisa la confirmación antes de continuar. El estudiante verá el nuevo estado al consultar su reporte. Marcarlo como solucionado debe corresponder a la comprobación del trabajo realizado.

Al guardar Solucionado se abre **Arreglados**, donde la administración ve los reportes resueltos de todos los usuarios. Si se reabre un reporte cambiándolo a Pendiente o Urgente, vuelve a la lista principal. La separación no elimina datos ni excluye los reportes del PDF de la semana correspondiente.

## 6. Administrar estudiantes

Desde la sección de estudiantes, crea una cuenta con nombre, correo y contraseña inicial de al menos 12 caracteres. Entrega el acceso por un canal adecuado de la institución.

Si corresponde dar de baja una cuenta por mala conducta, pulsa **Eliminar** junto al estudiante y después **Eliminar acceso**. Comprueba el nombre y correo antes de confirmar. La cuenta queda inactiva y su acceso se bloquea; los reportes que había enviado se conservan para la administración.

Los estudiantes no disponen del módulo de cuentas. La baja de una cuenta tampoco equivale a borrar sus reportes.

## 7. Descargar el PDF semanal

Solo el administrador accede a **PDF semanal**. Elige una fecha en **Semana del**; el sistema la ajusta al lunes de esa semana. Revisa el periodo indicado y pulsa **Descargar PDF semanal**.

El periodo comprende **lunes a domingo**, según la fecha de creación de cada reporte en la zona horaria de Ciudad de México. El PDF contiene los reportes que corresponden a esa semana y los estados que tienen al generarlo.

En demostración, el PDF contiene ejemplos. En una instalación conectada, utiliza los registros que la administración obtiene del proyecto Supabase. Descargar un documento no modifica el estado de las incidencias.

## 8. Ayuda y problemas habituales

| Situación | Qué hacer |
|---|---|
| Aparece Demostración local | Es el entorno de ejemplos. El responsable debe configurar Supabase para operar con cuentas reales. |
| PIN incorrecto o registro limitado | Revisa el PIN y espera el tiempo indicado. Los intentos se limitan en el servidor conectado. |
| Registro de administrador no disponible | El responsable debe revisar el secreto y el despliegue de `register-admin`. |
| No puedo ver reportes de otra persona | Es el permiso esperado de una cuenta estudiante. |
| No puedo cambiar un estado | Esa acción corresponde a un administrador. |
| No puedo iniciar sesión | Comprueba correo, contraseña y que tu cuenta permanezca activa. |
| La fotografía no carga | Comprueba sesión y conexión y vuelve a abrir el reporte. |
| PDF sin reportes | Comprueba el intervalo semanal y las fechas de creación. |
| Error al enviar | Lee el mensaje y comprueba la conexión; no asumas que quedó guardado sin confirmación. |

Puedes avanzar con Tab y activar botones con Enter o Espacio. Los diálogos permiten cerrar mediante su control y conservan el foco del teclado. Para informar de una falla, indica pantalla, acción y mensaje; no envíes contraseñas.
