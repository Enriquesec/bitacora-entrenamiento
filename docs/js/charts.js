/* global dashboardData */
/* exported renderCharts, renderHeatmap, renderPieChart, renderTrendChart */

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
  const colores = data.map(v => v >= 10000 ? 'rgba(0, 212, 255, 0.75)' : 'rgba(248, 113, 113, 0.7)');

  new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pasos diarios',
          data,
          backgroundColor: colores,
          borderColor: colores,
          borderWidth: 0,
          borderRadius: 2,
        },
        {
          type: 'line',
          label: 'Meta (10k)',
          data: Array(labels.length).fill(10000),
          borderColor: 'rgba(52, 211, 153, 0.5)',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#9ca3af', boxWidth: 20, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 12,
          callbacks: {
            label(context) {
              const val = context.parsed.y;
              return `${context.dataset.label}: ${val ? val.toLocaleString('es-MX') : 0}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            callback(value) {
              return value >= 1000 ? value / 1000 + 'k' : value;
            },
          },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 15 },
        },
      },
    },
  });
}

function renderHeatmap() {
  const container = document.getElementById('heatmap');
  container.innerHTML = '';

  const colorMap = {
    verde: '#34d399',
    amarillo: '#fb923c',
    rojo: '#f87171',
    gris: '#1e293b',
    futuro: 'transparent',
  };
  const estadoLabel = { verde: 'Verde', amarillo: 'Naranja', rojo: 'Rojo', gris: 'Sin datos', futuro: 'Próximamente' };
  const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const hoy = new Date();
  const startYear = new Date('2025-12-29T00:00:00');
  const endYear = new Date(2026, 11, 31, 23, 59, 59);

  const diasMap = Object.fromEntries(dashboardData.todosLosDias.map(d => [d.fecha, d]));

  const diasCompletos = [];
  for (let d = new Date(startYear); d <= endYear; d.setDate(d.getDate() + 1)) {
    const fStr = d.toISOString().split('T')[0];
    if (diasMap[fStr]) {
      const dia = { ...diasMap[fStr] };
      if (d > hoy) dia.estado = 'futuro';
      diasCompletos.push(dia);
    } else {
      diasCompletos.push({ fecha: fStr, estado: d > hoy ? 'futuro' : 'gris', pasos: 0, disciplinas: [], duracion: 0 });
    }
  }

  const startPad = (startYear.getDay() + 6) % 7;
  const cells = [...Array(startPad).fill(null), ...diasCompletos];
  const totalWeeks = Math.ceil(cells.length / 7);

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

  const gridRow = document.createElement('div');
  gridRow.className = 'heatmap-grid-row';

  const dayLabels = document.createElement('div');
  dayLabels.className = 'heatmap-day-labels';
  ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(lbl => {
    const el = document.createElement('span');
    el.textContent = lbl;
    dayLabels.appendChild(el);
  });

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  let tip = document.getElementById('heatmap-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'heatmap-tip';
    tip.className = 'heatmap-tooltip';
    document.body.appendChild(tip);
  }

  function moveTip(e) {
    tip.style.left = e.clientX + 14 + 'px';
    tip.style.top = e.clientY - 10 + 'px';
  }

  cells.forEach(dia => {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    if (dia) {
      if (dia.estado === 'futuro') cell.classList.add('futuro');

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
  const colores = ['#00d4ff', '#34d399', '#a78bfa', '#fbbf24', '#f87171', '#fb923c'];

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
            label(context) {
              return `${context.label}: ${context.parsed} sesiones`;
            },
          },
        },
      },
    },
  });
}
