# Corazones en Acción — sitio + panel real + Turso + PWA Android

## Qué incluye
- Sitio público real `/` y panel administrativo dinámico `/admin`.
- API Express conectada a la base de datos Turso; crea la tabla `solicitudes` si no existe.
- Formularios de reportes, voluntariado y apadrinamiento, integrados con la base de datos.
- Autenticación del panel por cookie HttpOnly, Secure y SameSite; sesiones de 8 horas.
- PWA instalable desde Chrome Android (no APK nativo ni publicación en Play Store).

**IMPORTANTE:** Es un panel funcional nuevo para las solicitudes de este HTML, NO una recuperación del panel original que no se proporcionó. Si ya hay un panel con otras tablas y funciones, se requiere su código para migrarlas sin perderlas. No ejecutar este proyecto contra una base de datos con objetos incompatibles sin revisión previa. La página declara un agente IA por WhatsApp pero el proyecto no trae dicha automatización; sigue siendo un enlace normal.

## Publicar en Render (un único Web Service, plan Free)
1. Subir carpeta a un repositorio privado en GitHub (sin secretos).
2. Render → New → Blueprint → elegir repositorio que contiene `render.yaml`.
3. Completar los secretos `TURSO_DATABASE_URL` (`libsql://...`), `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD` (usar una contraseña larga y única). Render genera `SESSION_SECRET`.
4. Deploy. Comprobar `https://<tu-servicio>.onrender.com/api/health` (`ok: true`) y el panel `https://<tu-servicio>.onrender.com/admin`.
5. En Render → Settings → Custom Domains: añadir `fundacioncorazonesenaccion.org` (SOLO si de verdad controlan ese dominio), seguir registros DNS de Render y verificar HTTPS. **No cambiar DNS antes de confirmar servicios existentes y copias de seguridad.**
6. Probar cada formulario con **datos ficticios** y verificar su aparición en `/admin`; después cambiar estados y confirmar que persisten tras recargar.
7. En Chrome Android, menú ⋮ → Añadir a pantalla de inicio / Instalar aplicación.

## Costos y límites
Render Free puede dormir tras 15 minutos y tardar cerca de un minuto en despertar; no garantiza disponibilidad continua. Dominios propios se incluyen dentro del límite del plan; el registro/renovación del dominio NO es gratuito. Turso también tiene cuotas de uso. No se han verificado credenciales, DNS, envío real ni producción desde este entorno.

## Seguridad / lo pendiente para operación sensible
- Cambiar de autenticación de contraseña única a cuentas individuales con MFA y auditoría antes de procesar datos sensibles a escala.
- Implementar política de privacidad, consentimiento cuando corresponda, avisos de tratamiento (Ley 1581/2012) y políticas de retención.
- Protección anti-abuso distribuida: el rate limit incluido es básico, en memoria, y no reemplaza un WAF/CAPTCHA.
- Copias de seguridad, manejo de accesos y gestión de incidentes. El modo gratuito no es ideal para datos delicados.
- Agregar el PDF original y recursos gráficos oficiales si están disponibles. El icono es provisional.
- Si se requiere APK, compilar y firmar una TWA o Capacitor una vez operativa la URL pública.
