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
  const recordPasos = Math.max(...dashboardData.todosDatos.map(d => d.pasos));
  document.getElementById('totalDias').textContent = stats.totalDias;
  document.getElementById('diasCumplimiento').textContent = `${stats.diasCumplimiento}/${stats.totalDias}`;
  document.getElementById('diasEjercicio').textContent = stats.diasEjercicio;
  document.getElementById('diasPasos').textContent = stats.diasPasos;
  document.getElementById('promedioPasos').textContent = stats.promedioPasos.toLocaleString('es-MX');
  document.getElementById('recordPasos').textContent = recordPasos.toLocaleString('es-MX');

  // Insights automáticos
  renderInsights();

  // Racha reciente
  renderRachas();

  // Panel "¿Qué falta esta semana?"
  renderThisWeek();

  // Resumen semanal
  renderWeeklySummary();

  // Tabla de días de la semana
  renderWeekTable();

  // Gráficos
  renderCharts();
}

function renderRachas() {
  const container = document.getElementById('rachaCards');
  if (!container || !dashboardData.todosDatos) return;

  const CARDIO = ['Natación', 'Carrera', 'Bici'];
  const hoy = new Date().toISOString().split('T')[0];
  const datos = dashboardData.todosDatos;

  function calcVentana(n) {
    const corte = new Date();
    corte.setDate(corte.getDate() - (n - 1));
    const corteStr = corte.toISOString().split('T')[0];
    const ventana = datos.filter(d => d.fecha >= corteStr && d.fecha <= hoy);
    return {
      dias: n,
      pasos:  ventana.filter(d => d.cumplePasos).length,
      fuerza: ventana.filter(d => d.disciplinas.includes('Fuerza') || d.disciplinas.includes('Mixto')).length,
      cardio: ventana.filter(d => d.disciplinas.some(disc => CARDIO.includes(disc)) || d.disciplinas.includes('Mixto')).length,
    };
  }

  const ventanas = [calcVentana(7), calcVentana(15), calcVentana(30)];

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

function renderThisWeek() {
  const container = document.getElementById('thisWeekPanel');
  if (!container || !dashboardData.semanas) return;

  const semana = dashboardData.semanas.find(s => s.esSemanaActual);
  if (!semana) { container.style.display = 'none'; return; }

  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const inicio = new Date(semana.inicio + 'T00:00:00');
  const fin    = new Date(semana.fin    + 'T00:00:00');
  const fmtD   = d => `${d.getDate()} ${MESES[d.getMonth()]}`;

  // Días restantes en la semana (incluyendo hoy). Lun=7, Mar=6, ... Dom=1
  const posInWeek = (new Date().getDay() + 6) % 7;
  const remainingDays = 7 - posInWeek;

  const faltaFuerza = Math.max(0, 5 - semana.sesionesFuerza);
  const faltaCardio = Math.max(0, 3 - semana.sesionesCardio);
  const faltaPasos  = Math.max(0, 7 - semana.diasPasos10k);

  function status(falta, remaining) {
    if (falta === 0) return 'ok';
    return falta <= remaining ? 'alcanzable' : 'imposible';
  }

  function goalCard(title, current, goal, falta, remaining, type) {
    const st = status(falta, remaining);
    let txt;
    if (st === 'ok') {
      txt = 'Meta cumplida';
    } else if (st === 'imposible') {
      txt = 'Fuera de alcance';
    } else if (type === 'pasos') {
      txt = `Falt${falta === 1 ? 'a' : 'an'} ${falta} día${falta > 1 ? 's' : ''}`;
    } else {
      txt = `Falt${falta === 1 ? 'a' : 'an'} ${falta} sesión${falta > 1 ? 'es' : ''}`;
    }

    return `
      <div class="goal-card goal-card--${st}">
        <div class="goal-card-title">${title}</div>
        <div class="goal-card-progress">
          <span class="goal-current">${current}</span><span class="goal-sep">/${goal}</span>
        </div>
        <div class="goal-card-status">${txt}</div>
      </div>`;
  }

  const diasLabel = remainingDays === 1 ? '1 día restante' : `${remainingDays} días restantes`;

  container.innerHTML = `
    <div class="twp-header">
      <span class="twp-title">Esta semana &middot; ${fmtD(inicio)} – ${fmtD(fin)}</span>
      <span class="twp-remaining">${diasLabel}</span>
    </div>
    <div class="twp-goals">
      ${goalCard('Fuerza',   semana.sesionesFuerza, 5, faltaFuerza, remainingDays, 'fuerza')}
      ${goalCard('Cardio',   semana.sesionesCardio, 3, faltaCardio, remainingDays, 'cardio')}
      ${goalCard('Pasos 10k', semana.diasPasos10k,  7, faltaPasos,  remainingDays, 'pasos')}
    </div>`;
}

function renderWeeklySummary() {
  const container = document.getElementById('weeklySummary');
  if (!container || !dashboardData.semanas) return;

  const MESES_NOMBRE = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const MESES_CORTO  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const DIAS_LABEL   = ['L','M','X','J','V','S','D'];
  const CARDIO_DISC  = ['Natación', 'Carrera', 'Bici'];
  const COLOR_ESTADO = { verde: '#26a641', amarillo: '#006d32', rojo: '#1e293b', gris: '#1e293b' };

  const hoy = new Date();
  const hoyStr      = hoy.toISOString().split('T')[0];
  const mesActual   = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  const inicioMes   = mesActual + '-01';
  const finMes      = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0];

  // Solo semanas del mes actual, de más nueva a más antigua
  const semanasDelMes = [...dashboardData.semanas]
    .filter(s => s.fin >= inicioMes && s.inicio <= finMes)
    .reverse();

  // Agrupar días pasados por mes
  const porMes = {};
  (dashboardData.todosDatos || []).forEach(dia => {
    const mes = dia.fecha.substring(0, 7);
    if (mes >= mesActual) return;
    if (!porMes[mes]) porMes[mes] = [];
    porMes[mes].push(dia);
  });

  const mesesPasados = Object.keys(porMes).sort().reverse().map(mesKey => {
    const dias = porMes[mesKey];
    const [y, m] = mesKey.split('-');
    return {
      label:        `${MESES_NOMBRE[parseInt(m) - 1]} ${y}`,
      diasFuerza:   dias.filter(d => d.disciplinas.includes('Fuerza')   || d.disciplinas.includes('Mixto')).length,
      diasNatacion: dias.filter(d => d.disciplinas.some(disc => CARDIO_DISC.includes(disc)) || d.disciplinas.includes('Mixto')).length,
      diasPasos:    dias.filter(d => d.cumplePasos).length,
    };
  });

  // ── Tarjeta semanal ───────────────────────────────────────
  function weekCard(semana) {
    const inicio = new Date(semana.inicio + 'T00:00:00');
    const fin    = new Date(semana.fin    + 'T00:00:00');
    const fmtD   = d => `${d.getDate()} ${MESES_CORTO[d.getMonth()]}`;
    const label  = `${fmtD(inicio)} – ${fmtD(fin)} ${fin.getFullYear()}`;

    const metasOk   = semana.sesionesFuerza >= 5 && semana.sesionesCardio >= 3 && semana.diasPasos10k >= 7;
    const metasCero = semana.sesionesFuerza === 0 && semana.sesionesCardio === 0 && semana.diasPasos10k === 0;

    let statusLabel, statusClass;
    if (semana.esSemanaActual)  { statusLabel = 'En curso'; statusClass = 'status-encurso'; }
    else if (metasOk)           { statusLabel = 'Cumplida'; statusClass = 'status-cumplida'; }
    else if (metasCero)         { statusLabel = 'Fallida';  statusClass = 'status-fallida'; }
    else                        { statusLabel = 'Parcial';  statusClass = 'status-parcial'; }

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
        ? `${slotStr} · ${dia.disciplinaPrincipal} · ${(dia.pasos || 0).toLocaleString('es-MX')} pasos`
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
  }

  // Mes con mayor actividad total
  const maxScore = mesesPasados.length
    ? Math.max(...mesesPasados.map(m => m.diasFuerza + m.diasNatacion + m.diasPasos))
    : 0;

  function monthCard(mes) {
    const score = mes.diasFuerza + mes.diasNatacion + mes.diasPasos;
    const esRecord = score === maxScore && maxScore > 0;
    return `
      <div class="month-card${esRecord ? ' month-card--record' : ''}">
        <div class="month-card-title">
          ${mes.label}
          ${esRecord ? '<span class="month-record-badge">Récord</span>' : ''}
        </div>
        <div class="month-stats">
          <div class="month-stat">
            <span class="month-stat-value fill-fuerza">${mes.diasFuerza}</span>
            <span class="month-stat-label">Fuerza</span>
          </div>
          <div class="month-stat">
            <span class="month-stat-value fill-cardio">${mes.diasNatacion}</span>
            <span class="month-stat-label">Natación</span>
          </div>
          <div class="month-stat">
            <span class="month-stat-value fill-pasos">${mes.diasPasos}</span>
            <span class="month-stat-label">Pasos 10k</span>
          </div>
        </div>
      </div>`;
  }

  const weeklyHTML  = semanasDelMes.map(weekCard).join('');
  const monthlyHTML = mesesPasados.length
    ? `<div class="monthly-section">
        <div class="monthly-section-title">Meses anteriores</div>
        <div class="monthly-grid">${mesesPasados.map(monthCard).join('')}</div>
       </div>`
    : '';

  container.innerHTML = weeklyHTML + monthlyHTML;
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

function initSidebar() {
  const sectionIds = ['kpis', 'insights', 'racha', 'graficas', 'semanas'];
  const links = {};
  sectionIds.forEach(id => {
    const el = document.querySelector(`.sidebar-link[href="#${id}"]`);
    if (el) links[id] = el;
  });

  if (!Object.keys(links).length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        Object.values(links).forEach(l => l.classList.remove('active'));
        if (links[entry.target.id]) links[entry.target.id].classList.add('active');
      }
    });
  }, { rootMargin: '-15% 0px -75% 0px', threshold: 0 });

  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

// Cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initSidebar();
});
