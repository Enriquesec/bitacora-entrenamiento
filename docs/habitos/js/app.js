'use strict';

const STORAGE_KEY = 'habitos-app-v1';
const DIA_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TABS = ['hoy', 'semana', 'insights', 'ajustes'];
const TAB_TITLES = { hoy: 'Hoy', semana: 'Semana', insights: 'Insights', ajustes: 'Ajustes' };

const CATEGORIES = [
  { id: 'salud', label: 'Salud', color: '#146B4E' },
  { id: 'mente', label: 'Mente', color: '#3B6FA0' },
  { id: 'disciplina', label: 'Disciplina', color: '#B4642B' },
  { id: 'social', label: 'Social', color: '#7A4FA3' },
  { id: 'otro', label: 'Otro', color: '#5c6a63' },
];

function categoryOf(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// ---------- fechas ----------
function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayISO() {
  return toKey(new Date());
}
function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function startOfWeek(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function weekLabel(monday) {
  const sunday = addDays(monday, 6);
  const opts = { day: 'numeric', month: 'short' };
  return `${monday.toLocaleDateString('es-MX', opts)} — ${sunday.toLocaleDateString('es-MX', opts)}`;
}
function lastNDays(n, endKey) {
  const end = parseKey(endKey);
  return Array.from({ length: n }, (_, i) => toKey(addDays(end, -(n - 1 - i))));
}

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------- datos por defecto ----------
function defaultHabits() {
  const created = todayISO();
  return [
    {
      id: 'h1',
      emoji: '🏋️',
      name: 'Ejercicio',
      categoryId: 'salud',
      createdAt: created,
      archived: false,
    },
    {
      id: 'h2',
      emoji: '📖',
      name: 'Lectura / Aprendizaje',
      categoryId: 'mente',
      createdAt: created,
      archived: false,
    },
    {
      id: 'h3',
      emoji: '🎯',
      name: 'Trabajo en proyectos',
      categoryId: 'disciplina',
      createdAt: created,
      archived: false,
    },
    {
      id: 'h4',
      emoji: '🌿',
      name: 'Detox redes',
      categoryId: 'mente',
      createdAt: created,
      archived: false,
    },
    {
      id: 'h5',
      emoji: '☕',
      name: 'Sin café después de las 12',
      categoryId: 'salud',
      createdAt: created,
      archived: false,
    },
  ];
}
function defaultState() {
  return { habits: defaultHabits(), checks: {}, theme: 'auto' };
}

// ---------- estado ----------
let state = null;
let activeTab = 'hoy';
let weekMonday = startOfWeek(new Date());
let deferredInstallPrompt = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    return {
      habits: Array.isArray(data.habits) ? data.habits : defaultHabits(),
      checks: data.checks && typeof data.checks === 'object' ? data.checks : {},
      theme: data.theme || 'auto',
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeHabits() {
  return state.habits.filter((h) => !h.archived);
}

function isDone(habitId, dateKey) {
  return !!(state.checks[dateKey] && state.checks[dateKey][habitId]);
}

// ---------- mutaciones ----------
function toggleCheck(habitId, dateKey) {
  const day = { ...(state.checks[dateKey] || {}) };
  if (day[habitId]) delete day[habitId];
  else day[habitId] = true;
  const nextChecks = { ...state.checks };
  if (Object.keys(day).length === 0) delete nextChecks[dateKey];
  else nextChecks[dateKey] = day;
  state.checks = nextChecks;
  saveState();
}

function addHabit({ emoji, name, categoryId }) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;
  state.habits.push({
    id: 'h' + Date.now(),
    emoji: emoji || '✅',
    name: trimmed,
    categoryId: categoryId || 'otro',
    createdAt: todayISO(),
    archived: false,
  });
  saveState();
}

function setArchived(id, archived) {
  const h = state.habits.find((x) => x.id === id);
  if (h) h.archived = archived;
  saveState();
}

function removeHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  const checks = {};
  for (const [k, v] of Object.entries(state.checks)) {
    const copy = { ...v };
    delete copy[id];
    if (Object.keys(copy).length) checks[k] = copy;
  }
  state.checks = checks;
  saveState();
}

function moveHabit(id, dir) {
  const list = state.habits;
  const activeIdxs = list.map((h, i) => (!h.archived ? i : -1)).filter((i) => i !== -1);
  const pos = activeIdxs.findIndex((i) => list[i].id === id);
  const targetPos = pos + dir;
  if (pos < 0 || targetPos < 0 || targetPos >= activeIdxs.length) return;
  const i = activeIdxs[pos];
  const j = activeIdxs[targetPos];
  [list[i], list[j]] = [list[j], list[i]];
  saveState();
}

// ---------- métricas ----------
function currentStreak(habitId, fromKey) {
  let s = 0;
  let d = parseKey(fromKey);
  if (!isDone(habitId, toKey(d))) d = addDays(d, -1);
  while (isDone(habitId, toKey(d))) {
    s++;
    d = addDays(d, -1);
  }
  return s;
}

function bestStreakEver(habitId) {
  const keys = Object.keys(state.checks)
    .filter((k) => state.checks[k][habitId])
    .sort();
  if (!keys.length) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < keys.length; i++) {
    const prev = parseKey(keys[i - 1]);
    const cur = parseKey(keys[i]);
    run = toKey(addDays(prev, 1)) === toKey(cur) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function completionRate(habitId, days) {
  const habit = state.habits.find((h) => h.id === habitId);
  const createdAt = habit ? habit.createdAt : todayISO();
  const span = lastNDays(days, todayISO()).filter((k) => k >= createdAt);
  if (!span.length) return 0;
  const done = span.filter((k) => isDone(habitId, k)).length;
  return done / span.length;
}

// ---------- motor de insights ----------
function computeInsights() {
  const habits = activeHabits();
  const today = todayISO();

  if (!habits.length) {
    return {
      suggestions: [
        {
          icon: '👋',
          text: 'Agrega tu primer hábito desde Ajustes para empezar a ver estadísticas.',
        },
      ],
    };
  }

  const suggestions = [];
  const last7 = lastNDays(7, today);
  const prev7 = lastNDays(7, toKey(addDays(parseKey(today), -7)));

  const pctFor = (days) => {
    let total = 0;
    let done = 0;
    for (const k of days) {
      for (const h of habits) {
        if (k < h.createdAt) continue;
        total++;
        if (isDone(h.id, k)) done++;
      }
    }
    return total ? Math.round((100 * done) / total) : 0;
  };

  const thisWeekPct = pctFor(last7);
  const prevWeekPct = pctFor(prev7);
  const delta = thisWeekPct - prevWeekPct;

  const rates = habits
    .map((h) => ({
      habit: h,
      rate: completionRate(h.id, 14),
      streak: currentStreak(h.id, today),
      best: bestStreakEver(h.id),
    }))
    .sort((a, b) => b.rate - a.rate);

  const bestHabit = rates[0];
  const worstHabit = rates[rates.length - 1];

  if (prevWeekPct > 0 || thisWeekPct > 0) {
    if (delta >= 10)
      suggestions.push({
        icon: '📈',
        text: `Vas mejor que la semana pasada (+${delta} pts). ¡Sigue así!`,
      });
    else if (delta <= -10)
      suggestions.push({
        icon: '📉',
        text: `Bajaste ${Math.abs(delta)} pts respecto a la semana pasada. Revisa qué cambió.`,
      });
  }

  const ageDaysOf = (h) => Math.round((parseKey(today) - parseKey(h.createdAt)) / 86400000);

  if (habits.length > 1 && bestHabit.habit.id !== worstHabit.habit.id) {
    if (worstHabit.rate < 0.4 && ageDaysOf(worstHabit.habit) >= 7) {
      suggestions.push({
        icon: '🔧',
        text: `"${worstHabit.habit.name}" tiene ${Math.round(worstHabit.rate * 100)}% de cumplimiento en 14 días. Considera hacerlo más pequeño o ajustar la meta.`,
      });
    }
    if (bestHabit.rate >= 0.85) {
      suggestions.push({
        icon: '⭐',
        text: `"${bestHabit.habit.name}" va muy bien (${Math.round(bestHabit.rate * 100)}%). Es tu hábito más sólido.`,
      });
    }
  }

  for (const r of rates) {
    if (r.streak >= 7)
      suggestions.push({
        icon: '🔥',
        text: `Llevas ${r.streak} días seguidos con "${r.habit.name}". ¡Racha fuerte!`,
      });
  }

  const weekdaySum = [0, 0, 0, 0, 0, 0, 0];
  const weekdayCount = [0, 0, 0, 0, 0, 0, 0];
  for (const k of lastNDays(28, today)) {
    const dow = (parseKey(k).getDay() + 6) % 7;
    let dayTotal = 0;
    let dayDone = 0;
    for (const h of habits) {
      if (k < h.createdAt) continue;
      dayTotal++;
      if (isDone(h.id, k)) dayDone++;
    }
    if (dayTotal > 0) {
      weekdaySum[dow] += dayDone / dayTotal;
      weekdayCount[dow]++;
    }
  }
  const weekdayAvg = weekdaySum.map((s, i) => (weekdayCount[i] ? s / weekdayCount[i] : null));
  const validIdx = weekdayAvg.map((v, i) => (v == null ? null : i)).filter((i) => i !== null);
  if (validIdx.length >= 5) {
    const worstDayIdx = validIdx.reduce((a, b) => (weekdayAvg[a] <= weekdayAvg[b] ? a : b));
    const rest = validIdx.filter((i) => i !== worstDayIdx);
    const restAvg = rest.reduce((s, i) => s + weekdayAvg[i], 0) / rest.length;
    if (restAvg - weekdayAvg[worstDayIdx] >= 0.2) {
      suggestions.push({
        icon: '📆',
        text: `Los ${DIA_LABELS[worstDayIdx]} sueles cumplir menos que el resto de la semana. Prueba poner un recordatorio ese día.`,
      });
    }
  }

  if (habits.length > 6) {
    suggestions.push({
      icon: '🎯',
      text: `Tienes ${habits.length} hábitos activos. Enfocarte en 3-5 a la vez suele mejorar el cumplimiento.`,
    });
  }

  for (const h of habits) {
    const ageDays = Math.round((parseKey(today) - parseKey(h.createdAt)) / 86400000);
    if (ageDays >= 14) {
      const checkedRecently = lastNDays(14, today).some((k) => isDone(h.id, k));
      if (!checkedRecently) {
        suggestions.push({
          icon: '🗄️',
          text: `No has marcado "${h.name}" en 14 días. Si ya no aplica, archívalo desde Ajustes.`,
        });
      }
    }
  }

  if (!suggestions.length) {
    suggestions.push({
      icon: '👍',
      text: 'Todo se ve estable. Sigue registrando tus días para más insights.',
    });
  }

  return { thisWeekPct, prevWeekPct, delta, rates, weekdayAvg, suggestions };
}

// ---------- render: componentes ----------
function ringSvg(pct, size, label) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${center}" cy="${center}" r="${r}" fill="none" style="stroke:var(--border)" stroke-width="6" />
      <circle cx="${center}" cy="${center}" r="${r}" fill="none" style="stroke:var(--accent);transition:stroke-dasharray .4s ease"
        stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${(pct / 100) * c} ${c}" transform="rotate(-90 ${center} ${center})" />
      <text x="${center}" y="${center + 5}" text-anchor="middle" font-size="13" font-family="'IBM Plex Mono', monospace"
        style="fill:var(--text)" font-weight="600">${label ?? pct + '%'}</text>
    </svg>`;
}

// ---------- render: vistas ----------
function renderHoy() {
  const habits = activeHabits();
  const today = todayISO();
  const doneCount = habits.filter((h) => isDone(h.id, today)).length;
  const pct = habits.length ? Math.round((100 * doneCount) / habits.length) : 0;
  const dateLabel = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const rows = habits.length
    ? habits
        .map((h) => {
          const done = isDone(h.id, today);
          const s = currentStreak(h.id, today);
          const cat = categoryOf(h.categoryId);
          return `
        <div class="habitRow">
          <div class="habitInfo">
            <span class="catDot" style="background:${cat.color}"></span>
            <span class="habitEmoji">${h.emoji}</span>
            <div>
              <div class="habitName">${escapeHtml(h.name)}</div>
              ${s > 1 ? `<div class="streakTag">🔥 ${s} días</div>` : ''}
            </div>
          </div>
          <button class="toggleBig${done ? ' done' : ''}" data-toggle="${h.id}" aria-label="${escapeHtml(h.name)}">${done ? '✓' : ''}</button>
        </div>`;
        })
        .join('')
    : '<div class="emptyState">Aún no tienes hábitos. Ve a <strong>Ajustes</strong> para agregar el primero.</div>';

  return `
    <div class="todayHead">
      <div>
        <div class="dateLabel">${capitalize(dateLabel)}</div>
        <div class="doneCount">${doneCount}/${habits.length} completados hoy</div>
      </div>
      ${ringSvg(pct, 64)}
    </div>
    <div class="card habitsList">${rows}</div>
  `;
}

function renderSemana() {
  const habits = activeHabits();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekMonday, i));
  const dayKeys = days.map(toKey);
  const today = todayISO();
  const isCurrentWeek = toKey(weekMonday) === toKey(startOfWeek(new Date()));

  let totalPossible = 0;
  let totalDone = 0;
  for (const k of dayKeys.filter((k) => k <= today)) {
    for (const h of habits) {
      if (k < h.createdAt) continue;
      totalPossible++;
      if (isDone(h.id, k)) totalDone++;
    }
  }
  const weekPct = totalPossible ? Math.round((100 * totalDone) / totalPossible) : 0;

  const headerCells = days
    .map((d, i) => {
      const k = toKey(d);
      const isToday = k === today;
      return `<th class="thDay${isToday ? ' thToday' : ''}"><div class="dowLabel">${DIA_LABELS[i]}</div><div class="domLabel">${d.getDate()}</div></th>`;
    })
    .join('');

  const rows = habits.length
    ? habits
        .map((h) => {
          const count = dayKeys.filter((k) => isDone(h.id, k)).length;
          const cat = categoryOf(h.categoryId);
          const cells = dayKeys
            .map((k) => {
              const done = isDone(h.id, k);
              const future = k > today || k < h.createdAt;
              return `<td class="tdCell"><button class="cell${done ? ' done' : ''}${future ? ' future' : ''}" data-toggle="${h.id}" data-day="${k}" ${future ? 'disabled' : ''} aria-label="${escapeHtml(h.name)} ${k}">${done ? '✓' : ''}</button></td>`;
            })
            .join('');
          return `<tr><td class="tdHabit"><span class="catDot" style="background:${cat.color}"></span><span class="habitEmojiSm">${h.emoji}</span><span class="habitNameSm">${escapeHtml(h.name)}</span></td>${cells}<td class="tdMini">${count}/7</td></tr>`;
        })
        .join('')
    : `<tr><td colspan="9" class="emptyRow">Agrega hábitos en Ajustes.</td></tr>`;

  return `
    <div class="weekNav">
      <button class="navBtn" data-week="-1">‹</button>
      <div class="weekLabel">${weekLabel(weekMonday)} ${!isCurrentWeek ? '<button class="hoyBtn" data-week="0">hoy</button>' : ''}</div>
      <button class="navBtn" data-week="1">›</button>
    </div>
    <div class="weekRingRow">${ringSvg(weekPct, 56)}<span class="weekRingLabel">Cumplimiento de la semana</span></div>
    <div class="matrixWrap"><table class="table"><thead><tr><th class="thHabit"></th>${headerCells}<th class="thMini">sem</th></tr></thead><tbody>${rows}</tbody></table></div>
  `;
}

function renderInsights() {
  const data = computeInsights();
  const habits = activeHabits();

  const ringsHtml = habits.length
    ? `<div class="insightRings">
        <div class="ringCol">${ringSvg(data.thisWeekPct, 70)}<span>Esta semana</span></div>
        <div class="ringCol">${ringSvg(data.prevWeekPct, 70)}<span>Semana pasada</span></div>
      </div>`
    : '';

  const bars = data.weekdayAvg
    ? `<div class="card"><h3 class="cardTitle">Cumplimiento por día (28 días)</h3>
        <div class="weekdayBars">${data.weekdayAvg
          .map(
            (v, i) => `
          <div class="barCol">
            <div class="barTrack"><div class="barFill" style="height:${v == null ? 0 : Math.round(v * 100)}%"></div></div>
            <span>${DIA_LABELS[i]}</span>
          </div>`
          )
          .join('')}</div>
      </div>`
    : '';

  const rateItems = (data.rates || [])
    .map(
      (r) => `
      <div class="rateItem">
        <div class="rateRow">
          <span>${r.habit.emoji} ${escapeHtml(r.habit.name)}</span>
          <div class="rateTrack"><div class="rateFill" style="width:${Math.round(r.rate * 100)}%"></div></div>
          <span class="rateVal">${Math.round(r.rate * 100)}%</span>
        </div>
        <div class="rateSub">racha actual: ${r.streak}d · mejor racha: ${r.best}d</div>
      </div>`
    )
    .join('');

  const suggestions = data.suggestions
    .map(
      (s) =>
        `<div class="suggestion"><span class="suggestionIcon">${s.icon}</span><span>${s.text}</span></div>`
    )
    .join('');

  return `
    ${ringsHtml}
    ${bars}
    ${rateItems ? `<div class="card"><h3 class="cardTitle">Cumplimiento por hábito (14 días)</h3>${rateItems}</div>` : ''}
    <div class="card"><h3 class="cardTitle">Sugerencias</h3>${suggestions}</div>
  `;
}

function renderAjustes() {
  const active = state.habits.filter((h) => !h.archived);
  const archived = state.habits.filter((h) => h.archived);

  const catOptions = CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join('');

  const activeRows = active.length
    ? active
        .map(
          (h, i) => `
      <div class="manageRow">
        <span class="catDot" style="background:${categoryOf(h.categoryId).color}"></span>
        <span class="habitEmojiSm">${h.emoji}</span>
        <span class="habitNameSm">${escapeHtml(h.name)}</span>
        <div class="rowBtns">
          <button class="miniBtn" data-move="${h.id}:-1" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button class="miniBtn" data-move="${h.id}:1" ${i === active.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="miniBtn" data-archive="${h.id}:1">📥</button>
          <button class="miniBtn danger" data-remove="${h.id}">×</button>
        </div>
      </div>`
        )
        .join('')
    : '<div class="emptyState">Sin hábitos activos.</div>';

  const archivedRows = archived
    .map(
      (h) => `
      <div class="manageRow">
        <span class="habitEmojiSm">${h.emoji}</span>
        <span class="habitNameSm dim">${escapeHtml(h.name)}</span>
        <div class="rowBtns">
          <button class="miniBtn" data-archive="${h.id}:0">📤 restaurar</button>
          <button class="miniBtn danger" data-remove="${h.id}">×</button>
        </div>
      </div>`
    )
    .join('');

  return `
    <div class="card">
      <h3 class="cardTitle">Nuevo hábito</h3>
      <div class="addForm">
        <input id="newHabitEmoji" class="emojiInput" maxlength="4" value="✅" aria-label="emoji" />
        <input id="newHabitName" class="nameInput" placeholder="Nombre del hábito" />
        <select id="newHabitCategory" class="catSelect" aria-label="categoría">${catOptions}</select>
        <button type="button" class="primary" id="addHabitBtn">Agregar</button>
      </div>
    </div>

    <div class="card">
      <h3 class="cardTitle">Tus hábitos</h3>
      ${activeRows}
    </div>

    ${archived.length ? `<div class="card"><h3 class="cardTitle">Archivados</h3>${archivedRows}</div>` : ''}

    <div class="card">
      <h3 class="cardTitle">Tema</h3>
      <div class="segmented">
        ${['auto', 'light', 'dark']
          .map(
            (t) =>
              `<button class="segBtn${state.theme === t ? ' active' : ''}" data-set-theme="${t}">${t === 'auto' ? 'Auto' : t === 'light' ? 'Claro' : 'Oscuro'}</button>`
          )
          .join('')}
      </div>
    </div>

    <div class="card">
      <h3 class="cardTitle">Datos</h3>
      <div class="dataBtns">
        <button class="ghost" id="exportBtn">Exportar respaldo</button>
        <label class="ghost fileLabel">Importar respaldo<input type="file" id="importInput" accept="application/json" hidden /></label>
        <button class="ghost danger" id="resetBtn">Borrar todo</button>
      </div>
      <div id="installRow"></div>
    </div>
  `;
}

// ---------- exportar / importar ----------
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mis-habitos-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data.habits) || typeof data.checks !== 'object')
        throw new Error('formato inválido');
      state = { habits: data.habits, checks: data.checks, theme: data.theme || state.theme };
      saveState();
      applyTheme();
      render();
      alert('Respaldo importado correctamente.');
    } catch {
      alert('No se pudo importar el archivo: formato inválido.');
    }
  };
  reader.readAsText(file);
}

// ---------- tema ----------
function resolveTheme() {
  if (state.theme === 'light' || state.theme === 'dark') return state.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme() {
  document.documentElement.setAttribute('data-theme', resolveTheme());
}

// ---------- instalación PWA ----------
function renderInstallRow() {
  const row = document.getElementById('installRow');
  if (!row) return;
  if (!deferredInstallPrompt) {
    row.innerHTML = '';
    return;
  }
  row.innerHTML = `<button class="primary" id="installBtn" style="margin-top:10px;width:100%">📲 Instalar app</button>`;
  document.getElementById('installBtn').addEventListener('click', async () => {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    renderInstallRow();
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  renderInstallRow();
});

// ---------- eventos de la vista ----------
function onViewClick(e) {
  const toggleBtn = e.target.closest('[data-toggle]');
  if (toggleBtn && !toggleBtn.disabled) {
    const day = toggleBtn.dataset.day || todayISO();
    toggleCheck(toggleBtn.dataset.toggle, day);
    render();
    return;
  }
  const weekBtn = e.target.closest('[data-week]');
  if (weekBtn) {
    const delta = Number(weekBtn.dataset.week);
    weekMonday = delta === 0 ? startOfWeek(new Date()) : addDays(weekMonday, delta * 7);
    render();
    return;
  }
  const moveBtn = e.target.closest('[data-move]');
  if (moveBtn) {
    const [id, dir] = moveBtn.dataset.move.split(':');
    moveHabit(id, Number(dir));
    render();
    return;
  }
  const archiveBtn = e.target.closest('[data-archive]');
  if (archiveBtn) {
    const [id, flag] = archiveBtn.dataset.archive.split(':');
    setArchived(id, flag === '1');
    render();
    return;
  }
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) {
    if (confirm('¿Eliminar este hábito y todo su historial?')) {
      removeHabit(removeBtn.dataset.remove);
      render();
    }
    return;
  }
  const themeBtn = e.target.closest('[data-set-theme]');
  if (themeBtn) {
    state.theme = themeBtn.dataset.setTheme;
    saveState();
    applyTheme();
    render();
    return;
  }
  if (e.target.id === 'exportBtn') {
    exportData();
    return;
  }
  if (e.target.id === 'resetBtn') {
    if (confirm('Esto borrará todos tus hábitos y registros en este dispositivo. ¿Continuar?')) {
      state = defaultState();
      saveState();
      render();
    }
    return;
  }
  if (e.target.id === 'addHabitBtn') {
    submitNewHabit();
  }
}

function submitNewHabit() {
  const emoji = document.getElementById('newHabitEmoji').value;
  const name = document.getElementById('newHabitName').value;
  const categoryId = document.getElementById('newHabitCategory').value;
  addHabit({ emoji, name, categoryId });
  render();
}

function onViewKeydown(e) {
  if (e.key === 'Enter' && e.target.id === 'newHabitName') {
    e.preventDefault();
    submitNewHabit();
  }
}

function onViewChange(e) {
  if (e.target.id === 'importInput') {
    const file = e.target.files[0];
    if (file) importData(file);
  }
}

// ---------- render maestro y navegación ----------
function render() {
  const view = document.getElementById('view');
  document.getElementById('viewTitle').textContent = TAB_TITLES[activeTab];
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });
  switch (activeTab) {
    case 'hoy':
      view.innerHTML = renderHoy();
      break;
    case 'semana':
      view.innerHTML = renderSemana();
      break;
    case 'insights':
      view.innerHTML = renderInsights();
      break;
    case 'ajustes':
      view.innerHTML = renderAjustes();
      renderInstallRow();
      break;
    default:
      view.innerHTML = '';
  }
  view.scrollTop = 0;
}

function onHashChange() {
  const tab = location.hash.replace('#', '');
  activeTab = TABS.includes(tab) ? tab : 'hoy';
  render();
}

function setTab(tab) {
  location.hash = TABS.includes(tab) ? tab : 'hoy';
}

function init() {
  state = loadState();
  applyTheme();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'auto') applyTheme();
  });

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) setTab(btn.dataset.tab);
  });

  const view = document.getElementById('view');
  view.addEventListener('click', onViewClick);
  view.addEventListener('keydown', onViewKeydown);
  view.addEventListener('change', onViewChange);

  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}

document.addEventListener('DOMContentLoaded', init);
