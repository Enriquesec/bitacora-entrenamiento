# Bitácora de Entrenamiento 📊

Dashboard interactivo de seguimiento de entrenamiento físico conectado a una base de datos en Notion. Visualiza tu progreso con gráficos, estadísticas y análisis automático del cumplimiento de objetivos.

## Características

✅ **Gráfico de barras**: Visualiza los últimos 30 días con código de colores
- 🟢 Verde: Cumpliste ejercicio + 10k pasos
- 🟡 Amarillo: Solo cumpliste ejercicio O pasos
- 🔴 Rojo: No cumpliste objetivos
- ⚪ Gris: Sin datos registrados

✅ **Estadísticas generales**:
- Días totales registrados
- Porcentaje de cumplimiento
- Días con ejercicio / pasos
- Promedio diario de pasos

✅ **Análisis por disciplina**: Gráfico pie mostrando distribución de entrenamientos

✅ **Análisis por día de semana**: Tabla con cumplimiento por cada día

✅ **Actualización automática**: GitHub Action ejecuta diariamente a las 00:00 UTC

## Configuración Inicial

### 1. Crear token de API en Notion

1. Ve a [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click en "Create new integration"
3. Dale un nombre (ej: "Dashboard Entrenamiento")
4. Copia el **Internal Integration Token**
5. Comparte tu base de datos con la integración:
   - Abre tu página en Notion
   - Click en los tres puntos (⋯) > Connections
   - Busca tu integración y dale acceso
   - Copia el **Database ID** de la URL: `https://notion.so/[DATABASE_ID]?v=...`

### 2. Clonar y configurar el repositorio

```bash
git clone https://github.com/tu-usuario/bitacora-entrenamiento.git
cd bitacora-entrenamiento

npm install
cp .env.example .env
```

Edita `.env` con tus credenciales:
```
NOTION_API_KEY=tu_token_aqui
NOTION_DATABASE_ID=tu_database_id_aqui
```

### 3. Ejecutar localmente

```bash
npm run fetch-data
npm run dev
```

Esto abrirá el dashboard en `http://localhost:8080`

## Configuración en GitHub

### 1. Crear repositorio en GitHub

```bash
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/bitacora-entrenamiento.git
git branch -M main
git push -u origin main
```

### 2. Configurar secretos de GitHub

1. Ve a **Settings** > **Secrets and variables** > **Actions**
2. Click en "New repository secret"
3. Agrega:
   - `NOTION_API_KEY`: Tu token de Notion
   - `NOTION_DATABASE_ID`: Tu Database ID

### 3. Activar GitHub Pages

1. Ve a **Settings** > **Pages**
2. En "Source", selecciona **Deploy from a branch**
3. Selecciona rama `main` y carpeta `/docs`
4. Click en Save

El dashboard estará disponible en: `https://tu-usuario.github.io/bitacora-entrenamiento/`

### 4. Ejecutar GitHub Action

1. Ve a **Actions**
2. Selecciona "Update Training Data"
3. Click en "Run workflow"

El workflow se ejecutará automáticamente cada día a las 00:00 UTC.

## Estructura de la BD en Notion

Tu tabla debe tener estas columnas:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Fecha | Date | Fecha del entrenamiento |
| Hora | Time | Hora del entrenamiento (opcional) |
| Pasos | Number | Cantidad de pasos |
| Disciplina | Select | Tipo de entrenamiento (Natación, Fuerza, Bici, etc) |
| Duración | Number | Duración en horas |
| Distancia / Volumen | Number | Distancia o volumen |
| Tipo | Select | Variante del entrenamiento |
| ... | ... | Otros campos se ignorarán |

## Personalización

### Cambiar objetivos diarios

Edita `scripts/fetch-notion-data.js`:

```javascript
const PASOS_OBJETIVO = 10000;  // Cambiar aquí
```

### Cambiar disciplinas

```javascript
const DISCIPLINAS_ENTRENAMIENTO = ['Natación', 'Fuerza', 'Bici', 'Carrera'];
const DIAS_DESCANSO = [4, 5];  // 4=Jueves, 5=Viernes
```

### Cambiar colores

Edita `docs/css/style.css`:

```css
.verde { color: #10b981; }
.amarillo { color: #f59e0b; }
.rojo { color: #ef4444; }
```

## Solución de problemas

**Error: "No se pudieron cargar los datos"**
- Asegúrate de ejecutar `npm run fetch-data` antes de abrir index.html
- Verifica que NOTION_API_KEY y NOTION_DATABASE_ID sean correctos

**GitHub Action falla**
- Ve a **Actions** y revisa los logs
- Verifica que los secretos estén configurados correctamente
- Asegúrate de que la integración tiene acceso a tu base de datos

**Los gráficos no se muestran**
- Abre la consola del navegador (F12) para ver errores
- Verifica que data.json existe en `docs/`

## Licencia

MIT
