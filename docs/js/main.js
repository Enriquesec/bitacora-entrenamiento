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
    background: #fee2e2;
    border: 2px solid #fca5a5;
    color: #7f1d1d;
    padding: 20px;
    border-radius: 8px;
    margin: 20px 0;
    font-weight: 500;
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
    const stats = porDiaSemana[dia.substring(0, 3)] || { total: 0, ejercicio: 0, pasos: 0 };
    const cumplimiento = stats.total > 0 ? Math.round((stats.ejercicio / stats.total) * 100) : 0;

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
  renderBarChart();
  renderPieChart();
}

function renderBarChart() {
  const ctx = document.getElementById('barChart').getContext('2d');

  const ultimos30 = dashboardData.ultimos30;
  const labels = ultimos30.map(d => {
    const fecha = new Date(d.fecha);
    return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
  });

  const coloresEstado = {
    verde: '#10b981',
    amarillo: '#f59e0b',
    rojo: '#ef4444',
    gris: '#d1d5db',
  };

  const colores = ultimos30.map(d => coloresEstado[d.estado] || '#999');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cumplimiento diario',
          data: ultimos30.map(d => {
            if (d.estado === 'verde') return 3;
            if (d.estado === 'amarillo') return 2;
            if (d.estado === 'rojo') return 1;
            return 0;
          }),
          backgroundColor: colores,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: undefined,
      scales: {
        y: {
          beginAtZero: true,
          max: 3,
          ticks: {
            callback: function(value) {
              const labels = ['', 'Incumplido', 'Parcial', 'Cumplido'];
              return labels[value] || '';
            },
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          displayColors: false,
          callbacks: {
            title: function(context) {
              return `Fecha: ${labels[context[0].dataIndex]}`;
            },
            label: function(context) {
              const dia = ultimos30[context.dataIndex];
              return [
                `Pasos: ${dia.pasos}`,
                `Disciplina: ${dia.disciplinaPrincipal || 'N/A'}`,
                `Duración: ${dia.duracion}h`,
                `Estado: ${dia.estado.toUpperCase()}`,
              ];
            },
          },
        },
      },
    },
  });
}

function renderPieChart() {
  const ctx = document.getElementById('pieChart').getContext('2d');

  const disciplinas = dashboardData.distribucionDisciplinas;
  const labels = disciplinas.map(d => `${d.nombre} (${d.porcentaje}%)`);
  const data = disciplinas.map(d => d.count);

  const colores = [
    '#3b82f6', // azul
    '#ef4444', // rojo
    '#10b981', // verde
    '#f59e0b', // amarillo
    '#8b5cf6', // púrpura
    '#ec4899', // rosa
  ];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colores.slice(0, data.length),
          borderColor: '#fff',
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
            padding: 15,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
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
