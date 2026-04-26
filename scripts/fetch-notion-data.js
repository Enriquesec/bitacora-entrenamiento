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
const DISCIPLINAS_ENTRENAMIENTO = ['Natación', 'Fuerza', 'Bici', 'Carrera'];
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
    // Jueves/Viernes: descanso es obligatorio
    if (DISCIPLINAS_DESCANSO.some(d => disciplina?.includes(d))) {
      return 'verde'; // descansó correctamente
    }
    if (tieneEjercicio && tienePasos) return 'verde'; // hizo ejercicio extra
    if (tieneEjercicio || tienePasos) return 'amarillo';
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

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: 'Fecha',
          direction: 'descending',
        },
      ],
    });

    const registros = response.results.map(page => {
      const props = page.properties;

      const fecha = props.Fecha?.date?.start;
      const pasos = props.Pasos?.number || 0;
      const disciplina = props.Disciplina?.select?.name || '';
      const duracion = props.Duración?.number || 0;
      const distancia = props['Distancia / Volumen']?.number || 0;
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
        const fecha = new Date(dia.fecha);
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
          tieneEjercicio: dia.disciplinas.length > 0,
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
      promedioPasos: Math.round(
        datos.reduce((sum, d) => sum + d.pasos, 0) / datos.length
      ),
      pasosTotal: datos.reduce((sum, d) => sum + d.pasos, 0),
    };

    // Distribución por disciplina
    const disciplinaCount = {};
    datos.forEach(dia => {
      dia.disciplinas.forEach(disc => {
        disciplinaCount[disc] = (disciplinaCount[disc] || 0) + 1;
      });
    });

    const distribucionDisciplinas = Object.entries(disciplinaCount)
      .map(([nombre, count]) => ({
        nombre,
        count,
        porcentaje: Math.round((count / stats.diasEjercicio) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Últimos 30 días
    const ultimos30 = datos.slice(-30);

    // Análisis por día de semana
    const diasNombre = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const porDiaSemana = {};
    datos.forEach(d => {
      const dia = diasNombre[d.diaSemana];
      if (!porDiaSemana[dia]) {
        porDiaSemana[dia] = { ejercicio: 0, pasos: 0, total: 0 };
      }
      porDiaSemana[dia].total++;
      if (d.tieneEjercicio) porDiaSemana[dia].ejercicio++;
      if (d.cumplePasos) porDiaSemana[dia].pasos++;
    });

    const salida = {
      actualizado: new Date().toISOString(),
      stats,
      distribucionDisciplinas,
      ultimos30,
      porDiaSemana,
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
