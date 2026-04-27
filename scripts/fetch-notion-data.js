const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const databaseId = process.env.NOTION_DATABASE_ID;

// Configuración
const PASOS_OBJETIVO = 10000;
const DISCIPLINAS_ENTRENAMIENTO = ['Natación', 'Fuerza', 'Bici', 'Carrera', 'Mixto'];
const DISCIPLINAS_DESCANSO = ['Descanso'];
const DISCIPLINAS_SIN_ENTRENAR = ['Sin entrenamiento'];

// Días de obligatorio descanso
const DIAS_DESCANSO = [4, 5]; // jueves (4) y viernes (5)

function determinarEstado(dia, pasos, disciplina) {
  const esDescansoObligatorio = DIAS_DESCANSO.includes(dia);
  const tienePasos = pasos >= PASOS_OBJETIVO;
  const tieneEjercicio =
    DISCIPLINAS_ENTRENAMIENTO.some(d => disciplina?.includes(d)) ||
    (esDescansoObligatorio && DISCIPLINAS_DESCANSO.some(d => disciplina?.includes(d)));

  if (!pasos && !disciplina) return 'gris'; // sin datos

  if (esDescansoObligatorio) {
    // Jueves/Viernes: Verde solo si cumple pasos. 
    // Si no cumple pasos: Amarillo si hizo ejercicio, Rojo si no.
    if (tienePasos) return 'verde';
    if (tieneEjercicio && !DISCIPLINAS_DESCANSO.some(d => disciplina?.includes(d))) return 'amarillo';
    return 'rojo';
  }

  // Otros días: ejercicio + pasos obligatorios
  if (tieneEjercicio && tienePasos) return 'verde';
  if (tieneEjercicio || tienePasos) return 'amarillo';
  return 'rojo';
}

async function fetchData() {
  try {
    console.log('Fetching data from Notion...');

    const allResults = [];
    let cursor = undefined;
    do {
      const response = await notion.databases.query({
        database_id: databaseId,
        sorts: [{ property: 'Fecha', direction: 'descending' }],
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      allResults.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const registros = allResults.map(page => {
      const props = page.properties;

      const fecha = props.Fecha?.date?.start;
      const pasos = props.Pasos?.number || 0;
      const disciplina = props.Disciplina?.title?.[0]?.plain_text || '';
      const duracion = props['Duración (min)']?.number || 0;
      const distancia = parseFloat(props['Distancia / Volumen']?.rich_text?.[0]?.plain_text || '0') || 0;
      const tipo = props.Tipo?.select?.name || '';

      return {
        id: page.id,
        fecha,
        pasos,
        disciplina,
        duracion,
        distancia,
        tipo,
      };
    });

    // Agrupar por fecha
    const porFecha = {};
    registros.forEach(reg => {
      if (!reg.fecha) return;

      if (!porFecha[reg.fecha]) {
        porFecha[reg.fecha] = {
          fecha: reg.fecha,
          pasos: 0,
          disciplinas: [],
          duracion: 0,
          distancia: 0,
        };
      }

      porFecha[reg.fecha].pasos += reg.pasos;
      if (reg.disciplina) {
        porFecha[reg.fecha].disciplinas.push(reg.disciplina);
      }
      porFecha[reg.fecha].duracion += reg.duracion;
      porFecha[reg.fecha].distancia += reg.distancia;
    });

    // Procesar datos
    const datos = Object.values(porFecha)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map(dia => {
        const fecha = new Date(dia.fecha + 'T00:00:00');
        const diaSemana = fecha.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
        const disciplinaPrincipal = dia.disciplinas[0] || '';
        const estado = determinarEstado(diaSemana, dia.pasos, disciplinaPrincipal);

        return {
          fecha: dia.fecha,
          diaSemana,
          pasos: dia.pasos,
          disciplinas: dia.disciplinas,
          disciplinaPrincipal,
          duracion: Math.round(dia.duracion * 10) / 10,
          distancia: Math.round(dia.distancia * 10) / 10,
          estado,
          cumplePasos: dia.pasos >= PASOS_OBJETIVO,
          tieneEjercicio: DISCIPLINAS_ENTRENAMIENTO.some(d => disciplinaPrincipal?.includes(d)),
        };
      });

    // Calcular estadísticas
    const stats = {
      totalDias: datos.length,
      diasEjercicio: datos.filter(d => d.tieneEjercicio).length,
      diasPasos: datos.filter(d => d.cumplePasos).length,
      diasVerdes: datos.filter(d => d.estado === 'verde').length,
      diasAmarillos: datos.filter(d => d.estado === 'amarillo').length,
      diasRojos: datos.filter(d => d.estado === 'rojo').length,
      diasGrises: datos.filter(d => d.estado === 'gris').length,
      diasCumplimiento: datos.filter(d => d.estado === 'verde' || d.estado === 'amarillo').length,
      promedioPasos: Math.round(
        datos.filter(d => d.pasos > 0).reduce((sum, d) => sum + d.pasos, 0) /
        datos.filter(d => d.pasos > 0).length
      ),
      pasosTotal: datos.reduce((sum, d) => sum + d.pasos, 0),
    };

    // Distribución por disciplina
    const disciplinaCount = {};
    let totalSesiones = 0;
    datos.forEach(dia => {
      dia.disciplinas.forEach(disc => {
        disciplinaCount[disc] = (disciplinaCount[disc] || 0) + 1;
        totalSesiones++;
      });
    });

    const distribucionDisciplinas = Object.entries(disciplinaCount)
      .map(([nombre, count]) => ({
        nombre,
        count,
        porcentaje: Math.round((count / totalSesiones) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    const porFechaMap = Object.fromEntries(datos.map(d => [d.fecha, d]));
    const hoy = new Date();

    // Últimos 30 días calendario
    const ultimos30 = [];
    for (let i = 29; i >= 0; i--) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() - i);
      const fechaStr = fecha.toISOString().split('T')[0];
      ultimos30.push(porFechaMap[fechaStr] || {
        fecha: fechaStr, diaSemana: fecha.getDay(), pasos: 0,
        disciplinas: [], disciplinaPrincipal: '', duracion: 0,
        distancia: 0, estado: 'gris', cumplePasos: false, tieneEjercicio: false,
      });
    }

    // Todos los días desde el primer registro hasta hoy
    const inicio = new Date(datos[0].fecha + 'T00:00:00');
    const todosLosDias = [];
    for (let d = new Date(inicio); d <= hoy; d.setDate(d.getDate() + 1)) {
      const fechaStr = d.toISOString().split('T')[0];
      todosLosDias.push(porFechaMap[fechaStr] || {
        fecha: fechaStr, diaSemana: d.getDay(), pasos: 0,
        disciplinas: [], disciplinaPrincipal: '', duracion: 0,
        distancia: 0, estado: 'gris', cumplePasos: false, tieneEjercicio: false,
      });
    }

    // Resúmenes semanales (Lun-Dom)
    const CARDIO_DISC = ['Natación', 'Carrera', 'Bici'];

    function getWeekStartStr(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }

    const semanaMap = {};
    todosLosDias.forEach(dia => {
      const ws = getWeekStartStr(dia.fecha);
      if (!semanaMap[ws]) semanaMap[ws] = { inicio: ws, dias: [] };
      semanaMap[ws].dias.push(dia);
    });

    const hoyStr = hoy.toISOString().split('T')[0];

    const semanas = Object.values(semanaMap)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map(({ inicio, dias }) => {
        const finDate = new Date(inicio + 'T00:00:00');
        finDate.setDate(finDate.getDate() + 6);
        const fin = finDate.toISOString().split('T')[0];
        const esSemanaActual = hoyStr >= inicio && hoyStr <= fin;

        let sesionesFuerza = 0;
        let sesionesCardio = 0;
        let diasPasos10k = 0;

        dias.forEach(dia => {
          const isMixto = dia.disciplinas.includes('Mixto');
          if (dia.disciplinas.includes('Fuerza') || isMixto) sesionesFuerza++;
          if (dia.disciplinas.some(d => CARDIO_DISC.includes(d)) || isMixto) sesionesCardio++;
          if (dia.cumplePasos) diasPasos10k++;
        });

        return {
          inicio,
          fin,
          esSemanaActual,
          sesionesFuerza,
          sesionesCardio,
          diasPasos10k,
          totalDias: dias.length,
          diasResumen: dias.map(d => ({
            fecha: d.fecha,
            diaSemana: d.diaSemana,
            estado: d.estado,
            disciplinaPrincipal: d.disciplinaPrincipal,
            pasos: d.pasos,
            cumplePasos: d.cumplePasos,
          })),
        };
      });

    // Análisis por día de semana
    const diasNombre = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const porDiaSemana = {};
    datos.forEach(d => {
      const dia = diasNombre[d.diaSemana];
      if (!porDiaSemana[dia]) {
        porDiaSemana[dia] = { ejercicio: 0, pasos: 0, verdes: 0, total: 0 };
      }
      porDiaSemana[dia].total++;
      if (d.tieneEjercicio) porDiaSemana[dia].ejercicio++;
      if (d.cumplePasos) porDiaSemana[dia].pasos++;
      if (d.estado === 'verde') porDiaSemana[dia].verdes++;
    });

    const salida = {
      actualizado: new Date().toISOString(),
      stats,
      distribucionDisciplinas,
      ultimos30,
      todosLosDias,
      porDiaSemana,
      semanas,
      todosDatos: datos,
    };

    // Guardar JSON
    const outputPath = path.join(__dirname, '../docs/data.json');
    fs.writeFileSync(outputPath, JSON.stringify(salida, null, 2));

    console.log(`✓ Datos actualizados en ${outputPath}`);
    console.log(`✓ Total registros: ${datos.length}`);
    console.log(`✓ Últimos 30 días: ${ultimos30.length}`);

  } catch (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }
}

fetchData();
