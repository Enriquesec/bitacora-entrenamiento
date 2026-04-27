let dashboardData = null;

async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('No se pudo cargar data.json');
    dashboardData = await response.json();
    console.log('Datos cargados:', dashboardData);
    renderDashboard();
  } catch (error) {
    console.error('Error loading data:', error);
    showError('No se pudieron cargar los datos. Asegúrate de ejecutar "npm run fetch-data" primero.');
  }
}

function showError(message) {
  const container = document.querySelector('.container');
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.35);
    color: #f87171;
    padding: 20px;
    border-radius: 12px;
    margin: 20px 0;
    font-weight: 500;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.9em;
  `;
  errorDiv.textContent = message;
  container.insertBefore(errorDiv, container.firstChild);
}

function renderDashboard() {
  if (!dashboardData) return;

  const stats = dashboardData.stats;

  // Actualizar fecha
  document.getElementById('updated').textContent = new Date(dashboardData.actualizado).toLocaleString('es-ES');

  // Estadísticas principales
  document.getElementById('totalDias').textContent = stats.totalDias;
  document.getElementById('diasVerdes').textContent = `${stats.diasVerdes}/${stats.totalDias}`;
  document.getElementById('diasEjercicio').textContent = stats.diasEjercicio;
  document.getElementById('diasPasos').textContent = stats.diasPasos;
  document.getElementById('promedioPasos').textContent = stats.promedioPasos.toLocaleString();

  // Resumen de colores
  document.getElementById('countVerdes').textContent = stats.diasVerdes;
  document.getElementById('countAmarillos').textContent = stats.diasAmarillos;
  document.getElementById('countRojos').textContent = stats.diasRojos;
  document.getElementById('countGrises').textContent = stats.diasGrises;

  // Tabla de días de la semana
  renderWeekTable();

  // Gráficos
  renderCharts();
}

function renderWeekTable() {
  const tbody = document.getElementById('weekTable');
  tbody.innerHTML = '';

  const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const porDiaSemana = dashboardData.porDiaSemana;

  diasNombre.forEach((dia, idx) => {
    const stats = porDiaSemana[dia.substring(0, 3)] || { total: 0, ejercicio: 0, pasos: 0, verdes: 0 };
    const cumplimiento = stats.total > 0 ? Math.round((stats.verdes / stats.total) * 100) : 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${dia}</strong></td>
      <td>${stats.total}</td>
      <td>${stats.ejercicio}</td>
      <td>${stats.pasos}</td>
      <td>${cumplimiento}%</td>
    `;
    tbody.appendChild(row);
  });
}

function renderCharts() {
  renderHeatmap();
  renderPieChart();
}

function renderHeatmap() {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';

  const colorMap = {
    verde:   '#34d399',
    amarillo: '#fb923c',
    rojo:    '#f87171',
    gris:    '#1e293b',
    futuro:  'transparent'
  };
  const estadoLabel = { verde: 'Verde', amarillo: 'Naranja', rojo: 'Rojo', gris: 'Sin datos', futuro: 'Próximamente' };
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Generar todos los días del 2026
  const hoy = new Date();
  const year = 2026;
  const startYear = new Date(`${year}-01-01T00:00:00`);
  const endYear = new Date(`${year}-12-31T23:59:59`);
  const diasMap = Object.fromEntries(dashboardData.todosLosDias.map(d => [d.fecha, d]));
  
  const diasCompletos = [];
  for (let d = new Date(startYear); d <= endYear; d.setDate(d.getDate() + 1)) {
    const fStr = d.toISOString().split('T')[0];
    if (diasMap[fStr]) {
      // Si el día está en el mapa pero es después de hoy, forzamos estado futuro
      const dia = {...diasMap[fStr]};
      if (d > hoy) dia.estado = 'futuro';
      diasCompletos.push(dia);
    } else {
      diasCompletos.push({
        fecha: fStr,
        estado: d > hoy ? 'futuro' : 'gris',
        pasos: 0, disciplinas: [], duracion: 0
      });
    }
  }

  // Pad start so first day aligns to its day-of-week (Mon = row 0)
  const startPad  = (startYear.getDay() + 6) % 7;
  const cells     = [...Array(startPad).fill(null), ...diasCompletos];
  const totalWeeks = Math.ceil(cells.length / 7);

  // ── Month labels ──────────────────────────────────────────
  const monthRow = document.createElement('div');
  monthRow.className = 'heatmap-months';

  let lastMonth = -1;
  for (let w = 0; w < totalWeeks; w++) {
    const span = document.createElement('span');
    for (let r = 0; r < 7; r++) {
      const c = cells[w * 7 + r];
      if (c) {
        const m = new Date(c.fecha + 'T00:00:00').getMonth();
        if (m !== lastMonth) { 
          span.textContent = MONTHS[m]; 
          lastMonth = m; 
        }
        break;
      }
    }
    monthRow.appendChild(span);
  }

  // ── Grid row (day labels + cells) ────────────────────────
  const gridRow = document.createElement('div');
  gridRow.className = 'heatmap-grid-row';

  const dayLabels = document.createElement('div');
  dayLabels.className = 'heatmap-day-labels';
  ['L','M','X','J','V','S','D'].forEach(lbl => {
    const el = document.createElement('span');
    el.textContent = lbl;
    dayLabels.appendChild(el);
  });

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  // Shared tooltip
  let tip = document.getElementById('heatmap-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'heatmap-tip';
    tip.className = 'heatmap-tooltip';
    document.body.appendChild(tip);
  }

  cells.forEach(dia => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    if (dia) {
      if (dia.estado === 'futuro') {
        cell.classList.add('futuro');
      }
      
      const color = colorMap[dia.estado];
      cell.style.background = color;
      
      if (dia.estado !== 'gris' && dia.estado !== 'futuro') {
        cell.style.boxShadow = `0 0 5px ${color}55`;
      }

      cell.addEventListener('mouseenter', e => {
        tip.innerHTML =
          `<div class="tt-date">${dia.fecha}</div>` +
          `<div class="tt-row">Estado: <strong>${estadoLabel[dia.estado]}</strong></div>` +
          (dia.pasos > 0 ? `<div class="tt-row">Pasos: <strong>${dia.pasos.toLocaleString()}</strong></div>` : '') +
          (dia.disciplinaPrincipal ? `<div class="tt-row">Disciplina: <strong>${dia.disciplinaPrincipal}</strong></div>` : '') +
          (dia.duracion ? `<div class="tt-row">Duración: <strong>${dia.duracion} min</strong></div>` : '');
        tip.classList.add('visible');
        moveTip(e);
      });
      cell.addEventListener('mousemove', moveTip);
      cell.addEventListener('mouseleave', () => tip.classList.remove('visible'));
    } else {
      cell.style.background = 'transparent';
      cell.style.pointerEvents = 'none';
    }
    grid.appendChild(cell);
  });

  function moveTip(e) {
    tip.style.left = (e.clientX + 14) + 'px';
    tip.style.top  = (e.clientY - 10) + 'px';
  }

  gridRow.appendChild(dayLabels);
  gridRow.appendChild(grid);
  container.appendChild(monthRow);
  container.appendChild(gridRow);
}

function renderPieChart() {
  const ctx = document.getElementById('pieChart').getContext('2d');

  const disciplinas = dashboardData.distribucionDisciplinas;
  const labels = disciplinas.map(d => `${d.nombre} (${d.porcentaje}%)`);
  const data = disciplinas.map(d => d.count);

  const colores = [
    '#00d4ff',
    '#34d399',
    '#a78bfa',
    '#fbbf24',
    '#f87171',
    '#fb923c',
  ];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colores.slice(0, data.length),
          borderColor: 'rgba(15, 23, 42, 0.9)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            color: '#9ca3af',
            font: { family: 'Roboto', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 10,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#00d4ff',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(0, 212, 255, 0.2)',
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: function(context) {
              return `${context.label}: ${context.parsed.y} sesiones`;
            },
          },
        },
      },
    },
  });
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', loadData);
