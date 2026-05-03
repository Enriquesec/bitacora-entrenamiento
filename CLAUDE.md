# Guía para Claude

## Regla obligatoria: Service Worker

**Cada vez que modifiques cualquiera de estos archivos, debes subir la versión del caché en `docs/sw.js`:**

- `docs/index.html`
- `docs/css/style.css`
- `docs/js/main.js`
- `docs/js/charts.js`
- `docs/icons/icon.svg`

El campo a actualizar es la primera línea de `docs/sw.js`:

```js
const CACHE_NAME = 'bitacora-vN'; // incrementar N
```

Si no se hace, los usuarios seguirán viendo la versión anterior cacheada aunque el servidor tenga los archivos nuevos.

Incluir el bump del Service Worker en el mismo commit que los cambios de UI.
