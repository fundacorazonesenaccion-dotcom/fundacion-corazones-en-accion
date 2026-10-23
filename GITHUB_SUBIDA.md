# Subida a GitHub: archivos individuales, sin carpetas

1. Crear un repositorio nuevo (puede ser privado).
2. En GitHub, pulsar Add file → Upload files.
3. Seleccionar **todos los archivos de esta carpeta** (no subir el ZIP).
4. Confirmar que `server.js`, `package.json`, `index.html`, `admin.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `render.yaml` y los archivos de documentación quedan **en la raíz del repositorio**.
5. Pulsar Commit changes.
6. En Render crear **Web Service**, conectar el repositorio, runtime Node, build command `npm install`, start command `npm start`, plan Free.
7. Configurar las variables secretas descritas en `SECURITY.md`. Nunca subir tokens o contraseñas a GitHub.
8. Mantener `ALLOW_REAL_DATA=false` y Turso de pruebas hasta completar las verificaciones de seguridad y funcionamiento.

**Nota:** Esta es una versión adaptada con todos los archivos en la raíz para facilitar la carga desde la web de GitHub; no incluye el código fuente del panel original (no fue entregado). El archivo `admin.html` sí es una interfaz funcional para la API incluida en `server.js`.
