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
  document.getElementById('diasCumplimiento').textContent = `${stats.diasCumplimiento}/${stats.totalDias}`;
  document.getElementById('diasEjercicio').textContent = stats.diasEjercicio;
  document.getElementById('diasPasos').textContent = stats.diasPasos;
  document.getElementById('promedioPasos').textContent = stats.promedioPasos.toLocaleString('es-MX');

  // Racha reciente
  renderRachas();

  // Resumen semanal
  renderWeeklySummary();

  // Tabla de días de la semana
  renderWeekTable();

  // Gráficos
  renderCharts();
}

function renderRachas() {
  const container = document.getElementById('rachaCards');
  if (!container || !dashboardData.rachas) return;

  const ventanas = [
    dashboardData.rachas.d7,
    dashboardData.rachas.d15,
    dashboardData.rachas.d30,
  ];

  container.innerHTML = ventanas.map(v => {
    const pctPasos  = Math.round((v.pasos  / v.dias) * 100);
    const pctFuerza = Math.round((v.fuerza / v.dias) * 100);
    const pctCardio = Math.round((v.cardio / v.dias) * 100);

    function metrica(valor, dias, pct, cls, label) {
      return `
        <div class="racha-metric">
          <div class="racha-metric-top">
            <span class="racha-metric-value ${cls}">${valor}</span>
            <span class="racha-metric-total">/${dias}</span>
            <span class="racha-metric-pct">${pct}%</span>
          </div>
          <div class="racha-metric-label">${label}</div>
          <div class="racha-bar">
            <div class="racha-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }

    return `
      <div class="racha-card">
        <div class="racha-card-title">${v.dias} días</div>
        <div class="racha-metrics">
          ${metrica(v.pasos,  v.dias, pctPasos,  'fill-pasos',  'Pasos 10k')}
          ${metrica(v.fuerza, v.dias, pctFuerza, 'fill-fuerza', 'Fuerza')}
          ${metrica(v.cardio, v.dias, pctCardio, 'fill-cardio', 'Cardio')}
        </div>
      </div>`;
  }).join('');
}

function renderWeekTable() {
  const tbody = document.getElementById('weekTable');
  tbody.innerHTML = '';

  const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const porDiaSemana = dashboardData.porDiaSemana;

  diasNombre.forEach((dia, idx) => {
    const stats = porDiaSemana[dia.substring(0, 3)] || { total: 0, ejercicio: 0, pasos: 0, verdes: 0 };
    
    const pctEjercicio = stats.total > 0 ? Math.round((stats.ejercicio / stats.total) * 100) : 0;
    const pctPasos = stats.total > 0 ? Math.round((stats.pasos / stats.total) * 100) : 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${dia}</strong></td>
      <td>${stats.total}</td>
      <td>${stats.ejercicio} (${pctEjercicio}%)</td>
      <td>${stats.pasos} (${pctPasos}%)</td>
    `;
    tbody.appendChild(row);
  });
}

function renderWeeklySummary() {
  const container = document.getElementById('weeklySummary');
  if (!container || !dashboardData.semanas) return;

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const DIAS_LABEL = ['L','M','X','J','V','S','D'];
  const COLOR_ESTADO = {
    verde:    '#34d399',
    amarillo: '#fb923c',
    rojo:     '#f87171',
    gris:     '#1e293b',
  };

  const hoyStr = new Date().toISOString().split('T')[0];

  // Render newest week first
  const semanas = [...dashboardData.semanas].reverse();

  container.innerHTML = semanas.map(semana => {
    const inicio = new Date(semana.inicio + 'T00:00:00');
    const fin    = new Date(semana.fin    + 'T00:00:00');
    const fmtD   = d => `${d.getDate()} ${MESES[d.getMonth()]}`;
    const label  = `${fmtD(inicio)} – ${fmtD(fin)} ${fin.getFullYear()}`;

    const cumpleFuerza = semana.sesionesFuerza >= 5;
    const cumpleCardio = semana.sesionesCardio >= 3;
    const cumplePasos  = semana.diasPasos10k  >= 7;
    const metasOk      = cumpleFuerza && cumpleCardio && cumplePasos;
    const metasCero    = semana.sesionesFuerza === 0 && semana.sesionesCardio === 0 && semana.diasPasos10k === 0;

    let statusLabel, statusClass;
    if (semana.esSemanaActual) {
      statusLabel = 'En curso'; statusClass = 'status-encurso';
    } else if (metasOk) {
      statusLabel = 'Cumplida'; statusClass = 'status-cumplida';
    } else if (metasCero) {
      statusLabel = 'Fallida';  statusClass = 'status-fallida';
    } else {
      statusLabel = 'Parcial';  statusClass = 'status-parcial';
    }

    function bar(value, goal, cls, title) {
      const pct = Math.min(100, Math.round((value / goal) * 100));
      const met = value >= goal;
      return `
        <div class="progress-row">
          <span class="progress-label">${title}</span>
          <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${pct}%"></div></div>
          <span class="progress-value ${met ? 'met' : ''}">${value}/${goal}</span>
        </div>`;
    }

    // Day dots — compute position from date offset relative to week start
    const diasMap = {};
    semana.diasResumen.forEach(d => {
      const diff = Math.round((new Date(d.fecha + 'T00:00:00') - inicio) / 86400000);
      if (diff >= 0 && diff < 7) diasMap[diff] = d;
    });

    const dots = DIAS_LABEL.map((lbl, i) => {
      const slotDate = new Date(inicio);
      slotDate.setDate(slotDate.getDate() + i);
      const slotStr = slotDate.toISOString().split('T')[0];
      const dia = diasMap[i];

      let bg, border = '';
      if (dia && dia.estado !== 'gris') {
        bg = COLOR_ESTADO[dia.estado] || COLOR_ESTADO.gris;
      } else if (slotStr > hoyStr) {
        bg = 'transparent'; border = 'border:1px solid rgba(255,255,255,0.1);';
      } else {
        bg = COLOR_ESTADO.gris;
      }

      const tip = dia && dia.disciplinaPrincipal
        ? `${slotStr} · ${dia.disciplinaPrincipal} · ${(dia.pasos||0).toLocaleString('es-MX')} pasos`
        : slotStr;

      return `<div class="day-dot"><div class="day-dot-color" style="background:${bg};${border}" title="${tip}"></div><span class="day-dot-label">${lbl}</span></div>`;
    }).join('');

    return `
      <div class="week-card${semana.esSemanaActual ? ' week-card--current' : ''}">
        <div class="week-card-header">
          <span class="week-range">${label}</span>
          <span class="week-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="week-card-body">
          ${bar(semana.sesionesFuerza, 5, 'fill-fuerza', 'Fuerza')}
          ${bar(semana.sesionesCardio, 3, 'fill-cardio', 'Cardio')}
          ${bar(semana.diasPasos10k,  7, 'fill-pasos',  'Pasos 10k')}
        </div>
        <div class="week-dots">${dots}</div>
      </div>`;
  }).join('');
}

function renderCharts() {
  renderHeatmap();
  renderPieChart();
  renderTrendChart();
}

function renderTrendChart() {
  const ctx = document.getElementById('trendChart');
  if (!ctx || !dashboardData.todosDatos) return;
  
  const todosLosDatos = dashboardData.todosDatos;
  const labels = todosLosDatos.map(d => {
    const date = new Date(d.fecha + 'T00:00:00');
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  });
  const data = todosLosDatos.map(d => d.pasos);

  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pasos diarios',
          data,
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0, 212, 255, 0.05)',
          fill: true,
          tension: 0.2,
          pointRadius: todosLosDatos.length > 60 ? 1 : 3,
          pointHoverRadius: 6,
          borderWidth: 2,
          pointBackgroundColor: '#00d4ff',
        },
        {
          label: 'Meta (10k)',
          data: Array(labels.length).fill(10000),
          borderColor: 'rgba(52, 211, 153, 0.4)',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { 
            color: '#9ca3af',
            boxWidth: 20,
            font: { size: 11 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          callbacks: {
            label: function(context) {
              const val = context.parsed.y;
              return `${context.dataset.label}: ${val ? val.toLocaleString('es-MX') : 0}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { 
            color: '#64748b',
            callback: function(value) {
              return value >= 1000 ? (value / 1000) + 'k' : value;
            }
          }
        },
        x: {
          grid: { display: false },
          ticks: { 
            color: '#64748b',
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 15
          }
        }
      }
    }
  });
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

  const hoy = new Date();
  
  // Iniciar exactamente el 29 de diciembre de 2025
  const startYear = new Date('2025-12-29T00:00:00');
  // Terminar al final del 2026
  const endYear = new Date(2026, 11, 31, 23, 59, 59);
  
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
  const labels = disciplinas.map(d => `${d.nombre}: ${d.count} (${d.porcentaje}%)`);
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
              return `${context.label}: ${context.parsed} sesiones`;
            },
          },
        },
      },
    },
  });
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', loadData);
