# Seguridad y puesta en marcha — Corazones en Acción

## Estado inicial (protegido)
`ALLOW_REAL_DATA=false` es el valor predeterminado en Render. La API responde HTTP 503 para formularios normales; no recopiles datos personales hasta completar validación y autorización. En modo de pruebas solo acepta **fixtures sintéticos** enviados intencionalmente con `x-corazones-test: test-fixture` (nunca uses ese encabezado desde la web pública). Este encabezado NO es un control de acceso criptográfico; por tanto, usa **una base Turso separada para pruebas** antes de activar producción. No publiques esta base con información privada.

## Variables de entorno
- `TURSO_DATABASE_URL`: URL de la **base de pruebas**, luego de producción en corte controlado.
- `TURSO_AUTH_TOKEN`: token con permisos mínimos para esa base. No compartir ni poner en el HTML.
- `ADMIN_PASSWORD`: contraseña única larga (24+ caracteres recomendado).
- `SESSION_SECRET`: cadena aleatoria de al menos 32 caracteres. Cambiarla invalida sesiones.
- `BACKUP_ENCRYPTION_KEY`: 64 caracteres hexadecimales (32 bytes) exclusivos para cifrar exportaciones.
- `ALLOW_REAL_DATA`: mantener `false` hasta terminar auditoría y autorización.
- `NODE_ENV=production`.

Genera claves locales con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Nunca incluirlas en repositorios, capturas ni chats.

## Pruebas manuales obligatorias en el despliegue
1. GET `/api/health` devuelve 200 y BD conectada; GET `/api/public/status` informa `pruebas`.
2. POST `/api/public/solicitudes` sin encabezado de fixture debe devolver 503. No introducir datos reales.
3. Abrir `/admin`; sin sesión `/api/admin/solicitudes` debe devolver 401.
4. Contraseña incorrecta devuelve 401; después de 8 intentos en 15 minutos, 429 para esa IP **en la instancia activa**.
5. Contraseña válida establece cookie `HttpOnly; Secure; SameSite=Strict`, y devuelve solicitudes sintéticas desde Turso.
6. Actualizar una solicitud sintética y confirmar que persiste al recargar.
7. `GET /api/admin/backup` sin sesión debe dar 401. Con sesión y clave configurada, descargar respaldo cifrado; confirmar que no expone texto de solicitudes y **probar descifrado y restauración en una BD de pruebas aislada** antes de confiar en los respaldos.
8. Verificar en navegador que solicitudes web ajenas al origen no modifican el panel.
9. No cargar fotos, nombres, números de documento ni información de migrantes durante estas pruebas.

## Copias de seguridad
En `/admin` hay un botón para exportar la tabla `solicitudes` como JSON cifrado con AES-256-GCM. Conserva **la clave en un lugar diferente** del archivo de respaldo. Si la pierdes, no podrás abrirlo. Este respaldo es **manual**, no automático, y no equivale a una restauración probada ni a respaldo integral de todas las tablas/archivos de un sistema externo. Usa además las opciones de protección/recuperación habilitadas por tu plan de Turso, después de comprobar su disponibilidad.

## Límites conocidos para producción
- Los límites por IP están en memoria y se reinician cuando Render reinicia la instancia; no son protección distribuida ni anti-bot robusta. Antes de exponerse masivamente implementar rate limiting compartido, desafío antispam (p. ej. Turnstile) y monitoreo.
- El panel usa una sola contraseña administrativa, sin MFA, sin cuentas por rol y sin auditoría de cambios. Para datos sensibles o gestión de varios empleados se debe migrar a autenticación individual con MFA, permisos mínimos y trazabilidad.
- Los reportes enviados por WhatsApp salen al servicio externo según decisión de quien lo use; el bloqueo de la API no impide ese canal. No anunciar confidencialidad absoluta.
- El proyecto adjunto contiene solo la interfaz y el panel construido en este paquete, no demuestra paridad con el panel previo de la Fundación.
- Antes de recibir datos personales: publicar políticas de tratamiento, definir autorización/base legal, retención, procedimiento de eliminación, responsables y atención de incidentes con asesoría legal adecuada.
- `GET /api/admin/backup` puede contener toda la información de la tabla; no compartir el archivo sin cifrado ni clave.
