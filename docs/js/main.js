/* global renderCharts */

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

  // Insights automáticos
  renderInsights();

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

  diasNombre.forEach((dia, _idx) => {
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

function computeInsights() {
  const datos = dashboardData.todosDatos;
  const hoy = new Date().toISOString().split('T')[0];
  const sorted = [...datos].sort((a, b) => b.fecha.localeCompare(a.fecha));

  let racha = 0;
  for (const d of sorted) {
    if (d.fecha > hoy) continue;
    if (d.estado === 'verde' || d.estado === 'amarillo') racha++;
    else break;
  }

  const CARDIO = ['Natación', 'Carrera', 'Bici', 'Mixto'];
  const ultimoCardio = sorted.find(d => d.fecha <= hoy && d.disciplinas.some(disc => CARDIO.includes(disc)));
  const diasSinCardio = ultimoCardio
    ? Math.round((new Date(hoy) - new Date(ultimoCardio.fecha)) / 86400000)
    : null;

  const ultimoFuerza = sorted.find(d => d.fecha <= hoy && (d.disciplinas.includes('Fuerza') || d.disciplinas.includes('Mixto')));
  const diasSinFuerza = ultimoFuerza
    ? Math.round((new Date(hoy) - new Date(ultimoFuerza.fecha)) / 86400000)
    : null;

  const hace7 = new Date();
  hace7.setDate(hace7.getDate() - 6);
  const hace7Str = hace7.toISOString().split('T')[0];
  const ultimos7 = datos.filter(d => d.fecha >= hace7Str && d.fecha <= hoy && d.pasos > 0);
  const promedioUltimos7 = ultimos7.length
    ? Math.round(ultimos7.reduce((s, d) => s + d.pasos, 0) / ultimos7.length)
    : 0;
  const diffPasos = dashboardData.stats.promedioPasos > 0
    ? Math.round(((promedioUltimos7 - dashboardData.stats.promedioPasos) / dashboardData.stats.promedioPasos) * 100)
    : 0;

  return { racha, diasSinCardio, diasSinFuerza, promedioUltimos7, diffPasos };
}

function renderInsights() {
  const container = document.getElementById('insightsGrid');
  if (!container) return;

  const { racha, diasSinCardio, diasSinFuerza, promedioUltimos7, diffPasos } = computeInsights();
  const insights = [];

  if (racha >= 2) {
    insights.push({ icon: '🔥', title: `${racha} días seguidos`, desc: `Llevas ${racha} días consecutivos cumpliendo el objetivo.`, type: 'positive' });
  } else {
    insights.push({ icon: '⚠️', title: 'Sin racha activa', desc: 'No hay cumplimiento consecutivo registrado. ¡Momento de retomar!', type: 'warning' });
  }

  if (diasSinCardio !== null) {
    if (diasSinCardio === 0) {
      insights.push({ icon: '🏊', title: 'Cardio hoy', desc: 'Hiciste cardio hoy.', type: 'positive' });
    } else if (diasSinCardio > 4) {
      insights.push({ icon: '🏊', title: `${diasSinCardio} días sin cardio`, desc: `La última sesión de cardio fue hace ${diasSinCardio} días.`, type: 'warning' });
    } else {
      insights.push({ icon: '🏊', title: `Cardio hace ${diasSinCardio}d`, desc: `Última sesión de cardio hace ${diasSinCardio} día${diasSinCardio > 1 ? 's' : ''}.`, type: 'neutral' });
    }
  }

  if (diasSinFuerza !== null) {
    if (diasSinFuerza === 0) {
      insights.push({ icon: '💪', title: 'Fuerza hoy', desc: 'Hiciste una sesión de fuerza hoy.', type: 'positive' });
    } else if (diasSinFuerza > 3) {
      insights.push({ icon: '💪', title: `${diasSinFuerza} días sin fuerza`, desc: `La última sesión de fuerza fue hace ${diasSinFuerza} días.`, type: 'warning' });
    } else {
      insights.push({ icon: '💪', title: `Fuerza hace ${diasSinFuerza}d`, desc: `Última sesión de fuerza hace ${diasSinFuerza} día${diasSinFuerza > 1 ? 's' : ''}.`, type: 'neutral' });
    }
  }

  if (promedioUltimos7 > 0) {
    const signo = diffPasos >= 0 ? '+' : '';
    insights.push({
      icon: '👟',
      title: `${promedioUltimos7.toLocaleString('es-MX')} pasos/día`,
      desc: `Promedio últimos 7 días: ${signo}${diffPasos}% vs. tu media general (${dashboardData.stats.promedioPasos.toLocaleString('es-MX')}).`,
      type: diffPasos >= 0 ? 'positive' : 'warning',
    });
  }

  container.innerHTML = insights.map(ins => `
    <div class="insight-card insight-${ins.type}">
      <span class="insight-icon">${ins.icon}</span>
      <div class="insight-body">
        <div class="insight-title">${ins.title}</div>
        <div class="insight-desc">${ins.desc}</div>
      </div>
    </div>`).join('');
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', loadData);
