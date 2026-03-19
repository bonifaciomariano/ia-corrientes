# Estrategias de IA · Cámara de Diputados de Corrientes
## Dashboard de seguimiento del proyecto 2026

### Deploy en GitHub Pages

1. Crear repositorio en GitHub (puede ser privado)
2. Subir todos los archivos de esta carpeta
3. Ir a Settings → Pages → Source: "Deploy from branch" → main → / (root)
4. La URL quedará disponible en `https://[usuario].github.io/[repo]`

### Configurar sincronización (Gist)

1. Ir a github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generar un token con permiso `gist`
3. Crear un Gist privado en gist.github.com con un archivo `ia-estado-2026.json` y contenido `{}`
4. Copiar el ID del Gist (aparece en la URL: `gist.github.com/usuario/ESTE-ES-EL-ID`)
5. En la web → pestaña Configuración → ingresar Gist ID y token → Guardar

### Contraseña de editor
La contraseña por defecto es `ia2026`. Cambiarla desde el archivo `data.js` línea final (campo `editorPassword`).

### Archivos
- `index.html` — estructura de la app
- `styles.css` — sistema de diseño (manual de estilo del proyecto)
- `data.js` — todos los datos del proyecto (fases, productos, hitos)
- `app.js` — lógica de la aplicación
