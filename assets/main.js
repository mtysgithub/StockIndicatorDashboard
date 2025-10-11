const dashboard = document.getElementById('dashboard');
const emptyState = document.getElementById('empty-state');

async function fetchJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}

function renderCard(chart) {
  const card = document.createElement('article');
  card.className = 'chart-card';
  card.innerHTML = `
    <header>
      <h2>${chart.metadata.name}</h2>
      <p>${chart.metadata.description || 'No description provided.'}</p>
    </header>
    <canvas id="canvas-${chart.metadata.id}"></canvas>
    <p class="chart-note" id="note-${chart.metadata.id}" role="status"></p>
    <div class="chart-meta">
      <span>Updated ${chart.metadata.lastUpdated ? new Date(chart.metadata.lastUpdated).toLocaleTimeString() : 'never'}</span>
      <button data-id="${chart.metadata.id}">Refresh now</button>
    </div>
  `;
  const refreshButton = card.querySelector('button');
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Refreshing…';
    try {
      const updated = await fetchJSON(`/api/charts/${chart.metadata.id}/trigger`, {
        method: 'POST',
      });
      renderChart(updated);
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Refresh now';
    }
  });

  dashboard.appendChild(card);
  renderChart(chart);
}

const charts = new Map();

function renderChart(chart) {
  const canvas = document.getElementById(`canvas-${chart.metadata.id}`);
  const note = document.getElementById(`note-${chart.metadata.id}`);
  if (!canvas) return;
  if (charts.has(chart.metadata.id)) {
    charts.get(chart.metadata.id).destroy();
    charts.delete(chart.metadata.id);
  }
  if (chart.payload.error) {
    canvas.style.display = 'none';
    if (note) {
      note.textContent = chart.payload.error;
      note.classList.add('chart-note--error');
      note.style.display = 'block';
    }
    return;
  }
  canvas.style.display = 'block';
  if (note) {
    note.textContent = chart.payload.note || '';
    note.classList.toggle('chart-note--error', false);
    note.style.display = chart.payload.note ? 'block' : 'none';
  }
  charts.set(
    chart.metadata.id,
    new Chart(canvas.getContext('2d'), {
      type: chart.payload.type || 'line',
      data: {
        labels: chart.payload.labels || [],
        datasets: chart.payload.datasets || [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            grid: {
              color: 'rgba(148, 163, 184, 0.2)',
            },
          },
          y: {
            grid: {
              color: 'rgba(148, 163, 184, 0.15)',
            },
          },
        },
        plugins: {
          legend: {
            labels: {
              color: '#e2e8f0',
            },
          },
        },
      },
    })
  );
}

async function bootstrap() {
  try {
    const metadata = await fetchJSON('/api/charts/');
    if (!metadata.length) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.remove();
    const chartsData = await Promise.all(
      metadata.map((meta) => fetchJSON(`/api/charts/${meta.id}`))
    );
    chartsData.forEach((chart) => renderCard(chart));
  } catch (error) {
    console.error('Failed to bootstrap dashboard', error);
    emptyState.querySelector('h3').textContent = 'Dashboard unavailable';
    emptyState.querySelector('p').textContent = 'Something went wrong while fetching charts. Please check the server logs.';
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
