let lineChart;
let barChart;
let pieChart;
let chartPeriod = 'week';
let chartOffset = 0;
let currentAdminSession = null;
let activitiesModalOpen = false;

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatHour(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}min`;
  return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
}

function updateDate() {
  const now = new Date();
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  const el = document.getElementById('currentDate');
  if (el) el.textContent = now.toLocaleDateString('pt-PT', options);
}

function initials(name) {
  return String(name || 'AD').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getAdminSnapshot() {
  if (typeof window.IMTSBStore.getAdminSnapshot === 'function') {
    return window.IMTSBStore.getAdminSnapshot();
  }
  const snapshot = window.IMTSBStore.getSnapshot();
  return {
    ...snapshot,
    fullHistory: snapshot.history || [],
    attendanceLogs: snapshot.attendanceLogs || []
  };
}

function toDateOnlyKey(iso) {
  return String(iso || '').slice(0, 10);
}

function getPeriodRange() {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (chartPeriod === 'day') {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() + chartOffset);
    end.setTime(start.getTime());
    end.setHours(23, 59, 59, 999);
    return { start, end, label: start.toLocaleDateString('pt-BR') };
  }

  if (chartPeriod === 'week') {
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday + (chartOffset * 7));
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return {
      start,
      end,
      label: `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`
    };
  }

  start.setDate(1);
  start.setMonth(start.getMonth() + chartOffset);
  start.setHours(0, 0, 0, 0);
  end.setTime(start.getTime());
  end.setMonth(start.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return {
    start,
    end,
    label: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  };
}

function isWithinRange(iso, range) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function buildChartSeries(history) {
  const range = getPeriodRange();
  const labels = [];
  const values = [];

  if (chartPeriod === 'day') {
    for (let hour = 8; hour <= 17; hour += 1) {
      labels.push(`${String(hour).padStart(2, '0')}h`);
      values.push(history.filter((item) => {
        if (!isWithinRange(item.completedAt || item.createdAt, range)) return false;
        return new Date(item.completedAt || item.createdAt).getHours() === hour;
      }).length);
    }
  } else {
    const cursor = new Date(range.start);
    while (cursor.getTime() <= range.end.getTime()) {
      const dayKey = toDateOnlyKey(cursor.toISOString());
      labels.push(cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
      values.push(history.filter((item) => toDateOnlyKey(item.completedAt || item.createdAt) === dayKey).length);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { labels, values, range };
}

function buildHourlyCounts(history, range) {
  const labels = ['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h'];
  const values = labels.map(() => 0);
  history.forEach((h) => {
    const ref = h.completedAt || h.createdAt;
    if (!isWithinRange(ref, range)) return;
    const hour = new Date(ref).getHours();
    const idx = hour - 8;
    if (idx >= 0 && idx < values.length) values[idx] += 1;
  });
  return { labels, values };
}

function initCharts() {
  if (lineChart || !window.Chart) return;

  const lineCtx = document.getElementById('lineChart')?.getContext('2d');
  const barCtx = document.getElementById('barChart')?.getContext('2d');
  const pieCtx = document.getElementById('pieChart')?.getContext('2d');
  if (!lineCtx || !barCtx || !pieCtx) return;

  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Atendimentos', data: [], borderColor: '#8C6746', backgroundColor: 'rgba(140,103,70,.1)', borderWidth: 3, tension: .35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: { labels: [], datasets: [{ label: 'Atendimentos', data: [], backgroundColor: 'rgba(191,167,153,.85)', borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: { labels: ['Aguardando', 'Em Atendimento', 'Concluido'], datasets: [{ data: [0, 0, 0], backgroundColor: ['rgba(140,103,70,.8)', 'rgba(191,167,153,.8)', 'rgba(38,5,5,.8)'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function updateCharts(snapshot) {
  if (!lineChart || !barChart || !pieChart) return;

  const history = snapshot.fullHistory || snapshot.history || [];
  const series = buildChartSeries(history);
  lineChart.data.labels = series.labels;
  lineChart.data.datasets[0].data = series.values;
  lineChart.update();

  const hourly = buildHourlyCounts(history, series.range);
  barChart.data.labels = hourly.labels;
  barChart.data.datasets[0].data = hourly.values;
  barChart.update();

  const waiting = snapshot.queue.filter((q) => q.status === 'aguardando').length;
  const running = snapshot.queue.filter((q) => q.status === 'em_atendimento').length;
  const done = history.length;
  pieChart.data.datasets[0].data = [waiting, running, done];
  pieChart.update();

  const label = document.getElementById('chartRangeLabel');
  if (label) label.textContent = series.range.label;
}

function computeWorkerMetrics(snapshot) {
  const history = snapshot.fullHistory || snapshot.history || [];
  const logs = snapshot.attendanceLogs || [];
  const workers = snapshot.users.filter((u) => u.role === 'trabalhador');
  const byWorker = {};

  workers.forEach((worker) => {
    byWorker[worker.name] = {
      worker,
      count: 0,
      durations: [],
      ratings: [],
      checkIns: [],
      totalWorkedSeconds: 0,
      openWorkedSeconds: 0,
      completionRate: 0,
      score: 0,
      recentHistory: [],
      firstActivityAt: null,
      lastActivityAt: null
    };
  });

  history.forEach((item) => {
    const name = item.attendedBy || 'Nao definido';
    if (!byWorker[name]) {
      byWorker[name] = {
        worker: { name, department: item.department || 'Sem setor' },
        count: 0,
        durations: [],
        ratings: [],
        checkIns: [],
        totalWorkedSeconds: 0,
        openWorkedSeconds: 0,
        completionRate: 0,
        score: 0,
        recentHistory: [],
        firstActivityAt: null,
        lastActivityAt: null
      };
    }
    byWorker[name].count += 1;
    if (item.serviceDurationSec) byWorker[name].durations.push(Number(item.serviceDurationSec));
    if (item.rating && Number.isFinite(Number(item.rating.score))) byWorker[name].ratings.push(Number(item.rating.score));
    byWorker[name].recentHistory.push(item);
    const itemDate = item.completedAt || item.createdAt || null;
    if (itemDate) {
      if (!byWorker[name].firstActivityAt || new Date(itemDate) < new Date(byWorker[name].firstActivityAt)) {
        byWorker[name].firstActivityAt = itemDate;
      }
      if (!byWorker[name].lastActivityAt || new Date(itemDate) > new Date(byWorker[name].lastActivityAt)) {
        byWorker[name].lastActivityAt = itemDate;
      }
    }
  });

  logs.forEach((log) => {
    if (!byWorker[log.workerName]) {
      byWorker[log.workerName] = {
        worker: { name: log.workerName, department: log.department || 'Sem setor' },
        count: 0,
        durations: [],
        ratings: [],
        checkIns: [],
        totalWorkedSeconds: 0,
        openWorkedSeconds: 0,
        completionRate: 0,
        score: 0,
        recentHistory: [],
        firstActivityAt: null,
        lastActivityAt: null
      };
    }
    byWorker[log.workerName].checkIns.push(log);
    const workedSeconds = Number(log.workedSeconds) || 0;
    const openWorkedSeconds = !log.checkOutAt && log.checkInAt
      ? Math.max(0, Math.floor((Date.now() - new Date(log.checkInAt).getTime()) / 1000))
      : 0;
    byWorker[log.workerName].totalWorkedSeconds += workedSeconds;
    byWorker[log.workerName].openWorkedSeconds += openWorkedSeconds;
    const logDate = log.checkOutAt || log.checkInAt || null;
    if (logDate) {
      if (!byWorker[log.workerName].firstActivityAt || new Date(logDate) < new Date(byWorker[log.workerName].firstActivityAt)) {
        byWorker[log.workerName].firstActivityAt = logDate;
      }
      if (!byWorker[log.workerName].lastActivityAt || new Date(logDate) > new Date(byWorker[log.workerName].lastActivityAt)) {
        byWorker[log.workerName].lastActivityAt = logDate;
      }
    }
  });

  return Object.keys(byWorker).map((name) => {
    const data = byWorker[name];
    const avgServiceSec = Math.round(average(data.durations) || 0);
    const avgRating = average(data.ratings) || 0;
    const completionRate = data.count ? Math.min(100, Math.round(((data.ratings.length || data.count) / data.count) * 100)) : 0;
    const totalWorkedSeconds = data.totalWorkedSeconds + data.openWorkedSeconds;
    const productivity = totalWorkedSeconds > 0 ? (data.count / (totalWorkedSeconds / 3600)) : data.count;
    const score = Math.round((data.count * 5) + (avgRating * 10) + (productivity * 12));
    const lastShift = data.checkIns
      .slice()
      .sort((a, b) => new Date(b.checkInAt || 0).getTime() - new Date(a.checkInAt || 0).getTime())[0] || null;
    const recentHistory = data.recentHistory
      .slice()
      .sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())
      .slice(0, 3);

    return {
      name,
      department: data.worker.department || 'Apoio ao Cliente',
      count: data.count,
      avgServiceSec,
      avgRating,
      completionRate,
      totalWorkedSeconds,
      loggedWorkedSeconds: data.totalWorkedSeconds,
      openWorkedSeconds: data.openWorkedSeconds,
      score,
      logs: data.checkIns,
      lastShift,
      recentHistory,
      totalShifts: data.checkIns.length,
      firstActivityAt: data.firstActivityAt,
      lastActivityAt: data.lastActivityAt
    };
  }).sort((a, b) => b.score - a.score || b.count - a.count);
}

function renderKPIs(snapshot) {
  const history = snapshot.fullHistory || snapshot.history || [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayDone = history.filter((h) => (h.completedAt || '').slice(0, 10) === todayKey).length;
  const waitingMins = snapshot.queue
    .filter((q) => q.status === 'aguardando')
    .map((q) => Math.max(0, Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 60000)));
  const avgWait = Math.round(average(waitingMins) || 0);

  const durSec = history.map((h) => Number(h.serviceDurationSec) || 0).filter((v) => v > 0);
  const scores = history
    .filter((h) => h.rating && Number.isFinite(Number(h.rating.score)))
    .map((h) => Number(h.rating.score));
  const sat = Math.round(((average(scores) || 0) / 5) * 100);
  const occ = snapshot.queue.length > 0 ? Math.round((snapshot.queue.filter((q) => q.status === 'em_atendimento').length / Math.max(1, snapshot.users.filter((u) => u.role === 'trabalhador').length)) * 100) : 0;

  document.getElementById('kpiAttend').textContent = String(todayDone);
  document.getElementById('kpiWait').textContent = `${avgWait}min`;
  document.getElementById('kpiOcc').textContent = `${occ}%`;
  document.getElementById('kpiSat').textContent = `${sat}%`;
  document.getElementById('kpiOccTrend').textContent = `${occ}%`;
  document.getElementById('trendAttend').textContent = `${history.length} total`;
}

function renderQueue(snapshot) {
  const queueList = document.getElementById('queueList');
  queueList.innerHTML = '';

  const grouped = {};
  snapshot.queue.forEach((ticket) => {
    const key = ticket.service || 'Outros';
    grouped[key] = (grouped[key] || 0) + 1;
  });

  Object.keys(grouped).forEach((service) => {
    const count = grouped[service];
    const block = document.createElement('div');
    block.className = 'queue-item';
    block.innerHTML = `
      <div>
        <div class="queue-service">${service}</div>
        <div class="queue-count">${count} pessoas aguardando</div>
      </div>
      <div class="queue-number">${String(count).padStart(2, '0')}</div>
    `;
    queueList.appendChild(block);
  });

  if (!Object.keys(grouped).length) {
    queueList.innerHTML = '<p>Sem fila no momento.</p>';
  }
}

function getPerformanceBadge(score) {
  if (score >= 160) return { label: 'Excelente', className: 'badge-excellent' };
  if (score >= 90) return { label: 'Bom', className: 'badge-good' };
  return { label: 'Regular', className: 'badge-regular' };
}

function openEmployeeDetail(name) {
  const href = `funcionario-detalhe.html?worker=${encodeURIComponent(name)}`;
  window.location.href = href;
}

function renderPerformance(snapshot) {
  const perf = document.getElementById('performanceBody');
  perf.innerHTML = '';

  const metrics = computeWorkerMetrics(snapshot);
  metrics.forEach((item) => {
    const badge = getPerformanceBadge(item.score);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="employee-info"><div class="employee-avatar">${initials(item.name)}</div><div><div class="employee-name">${item.name}</div><div class="employee-role">${item.department}</div></div></div></td>
      <td><strong>${item.count}</strong></td>
      <td>${formatDuration(item.avgServiceSec)}</td>
      <td><strong>${item.completionRate}%</strong></td>
      <td><span class="performance-badge ${badge.className}">${badge.label}</span></td>
      <td><button type="button" class="details-btn" data-worker-name="${item.name}">Ver detalhes</button></td>
    `;
    perf.appendChild(tr);
  });

  if (!metrics.length) {
    perf.innerHTML = '<tr><td colspan="6">Sem produtividade disponivel.</td></tr>';
  }

  perf.querySelectorAll('.details-btn').forEach((button) => {
    button.addEventListener('click', () => openEmployeeDetail(button.getAttribute('data-worker-name')));
  });

  renderEmployeeOfMonth(metrics);
  populateHistoryFilters(snapshot, metrics);
}

function renderEmployeeOfMonth(metrics) {
  const card = document.getElementById('employeeOfMonthCard');
  if (!card) return;

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthWinner = metrics.find((item) => item.logs.some((log) => String(log.checkInAt || '').slice(0, 7) === monthKey) || item.count > 0);
  if (!monthWinner) {
    card.textContent = 'Empregado do mes: sem dados suficientes';
    return;
  }

  card.textContent = `Empregado do mes: ${monthWinner.name} | ${monthWinner.count} atendimentos | nota ${monthWinner.score}`;
}

function renderEmployeeCards(metrics) {
  const container = document.getElementById('employeeDetailCards');
  const persistenceCard = document.getElementById('historyPersistenceCard');
  if (!container) return;

  if (persistenceCard) {
    const oldest = metrics
      .map((item) => item.firstActivityAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    persistenceCard.textContent = oldest
      ? `Histórico permanente ativo desde ${formatDate(oldest)}`
      : 'Histórico permanente ativo';
  }

  if (!metrics.length) {
    container.innerHTML = '<div class="employee-card-empty">Sem dados de funcionários para mostrar.</div>';
    return;
  }

  container.innerHTML = metrics.map((item) => {
    const badge = getPerformanceBadge(item.score);
    const lastShiftText = item.lastShift
      ? `${formatDate(item.lastShift.checkInAt)} | ${formatHour(item.lastShift.checkInAt)}${item.lastShift.checkOutAt ? ` - ${formatHour(item.lastShift.checkOutAt)}` : ' - em curso'}`
      : 'Sem jornada registada';
    const recentRows = item.recentHistory.length
      ? item.recentHistory.map((entry) => `
        <div class="employee-history-item">
          <span><strong>${escapeHtml(entry.code)}</strong> - ${escapeHtml(entry.service || '-')}</span>
          <span>${formatDate(entry.completedAt || entry.createdAt)} | ${formatDuration(entry.serviceDurationSec || 0)}</span>
        </div>
      `).join('')
      : '<div class="employee-card-empty">Sem atendimentos concluídos ainda.</div>';

    return `
      <article class="employee-detail-card">
        <div class="employee-detail-top">
          <div>
            <div class="employee-detail-name">${escapeHtml(item.name)}</div>
            <div class="employee-detail-subtitle">${escapeHtml(item.department)}</div>
          </div>
          <div class="employee-detail-score">${item.score}<span>${badge.label}</span></div>
        </div>
        <div class="employee-metrics-grid">
          <div class="employee-metric-box"><div class="employee-metric-label">Atendimentos</div><div class="employee-metric-value">${item.count}</div></div>
          <div class="employee-metric-box"><div class="employee-metric-label">Horas atendidas</div><div class="employee-metric-value">${formatDuration(item.totalWorkedSeconds)}</div></div>
          <div class="employee-metric-box"><div class="employee-metric-label">Tempo medio</div><div class="employee-metric-value">${formatDuration(item.avgServiceSec)}</div></div>
          <div class="employee-metric-box"><div class="employee-metric-label">Avaliacao media</div><div class="employee-metric-value">${item.avgRating ? item.avgRating.toFixed(1) : '0.0'}/5</div></div>
          <div class="employee-metric-box"><div class="employee-metric-label">Taxa de conclusao</div><div class="employee-metric-value">${item.completionRate}%</div></div>
          <div class="employee-metric-box"><div class="employee-metric-label">Jornadas</div><div class="employee-metric-value">${item.totalShifts}</div></div>
        </div>
        <div class="employee-history-strip">
          <h4>Ultima jornada</h4>
          <div class="employee-history-item">
            <span>${lastShiftText}</span>
            <span>${item.lastShift ? formatDuration((item.lastShift.workedSeconds || 0) + (!item.lastShift.checkOutAt ? item.openWorkedSeconds : 0)) : '-'}</span>
          </div>
        </div>
        <div class="employee-history-strip">
          <h4>Ultimos atendimentos</h4>
          <div class="employee-history-list">${recentRows}</div>
          <button type="button" class="details-btn" data-worker-name="${escapeHtml(item.name)}">Ver detalhes</button>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.details-btn').forEach((button) => {
    button.addEventListener('click', () => openEmployeeDetail(button.getAttribute('data-worker-name')));
  });
}

function populateHistoryFilters(snapshot, metrics) {
  const select = document.getElementById('historyWorkerFilter');
  if (!select) return;

  const selectedValue = select.value || 'all';
  select.innerHTML = '<option value="all">Todos os funcionarios</option>';

  metrics.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    select.appendChild(option);
  });

  if (Array.from(select.options).some((option) => option.value === selectedValue)) {
    select.value = selectedValue;
  }

  if (select.dataset.ready !== 'true') {
    select.dataset.ready = 'true';
    select.addEventListener('change', refreshDashboard);
  }
  const rangeSelect = document.getElementById('historyRangeFilter');
  if (rangeSelect && rangeSelect.dataset.ready !== 'true') {
    rangeSelect.dataset.ready = 'true';
    rangeSelect.addEventListener('change', refreshDashboard);
  }
}

function applyHistoryFilters(items, fieldName) {
  const workerFilter = document.getElementById('historyWorkerFilter')?.value || 'all';
  const rangeFilter = document.getElementById('historyRangeFilter')?.value || 'all';
  const now = Date.now();

  return items.filter((item) => {
    const who = item[fieldName] || item.workerName || '-';
    const ref = item.completedAt || item.checkInAt || item.createdAt;
    if (workerFilter !== 'all' && who !== workerFilter) return false;
    if (rangeFilter === 'week' && (now - new Date(ref).getTime()) > (28 * 24 * 3600 * 1000)) return false;
    if (rangeFilter === 'month' && (now - new Date(ref).getTime()) > (180 * 24 * 3600 * 1000)) return false;
    return true;
  });
}

function renderVisualization(snapshot) {
  const body = document.getElementById('visualizationBody');
  if (!body) return;
  body.innerHTML = '';

  const metrics = computeWorkerMetrics(snapshot);
  const logs = applyHistoryFilters(snapshot.attendanceLogs || [], 'workerName');

  logs.forEach((log) => {
    const workerMetrics = metrics.find((item) => item.name === log.workerName);
    const badge = getPerformanceBadge(workerMetrics ? workerMetrics.score : 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(log.checkInAt)}</td>
      <td>${formatHour(log.checkInAt)}${log.checkOutAt ? ` - ${formatHour(log.checkOutAt)}` : ''}</td>
      <td>${log.workerName}</td>
      <td>${workerMetrics ? workerMetrics.count : 0}</td>
      <td>${formatDuration(log.workedSeconds || 0)}</td>
      <td><span class="performance-badge ${badge.className}">${badge.label}</span></td>
    `;
    body.appendChild(tr);
  });

  if (!logs.length) {
    body.innerHTML = '<tr><td colspan="6">Sem registos de visualizacao e desempenho.</td></tr>';
  }
}

function renderHistory(snapshot) {
  const body = document.getElementById('historyBody');
  body.innerHTML = '';

  const history = applyHistoryFilters(snapshot.fullHistory || snapshot.history || [], 'attendedBy');
  history.forEach((h) => {
    const docs = (h.attachments || []).map((a) => a.name).join(', ') || '-';
    const rate = h.rating ? `${h.rating.score}/5` : '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(h.completedAt || h.createdAt)}</td>
      <td>${formatHour(h.completedAt || h.createdAt)}</td>
      <td>${h.code}</td>
      <td>${h.service}</td>
      <td>${h.attendedBy || '-'}</td>
      <td>${formatDuration(h.serviceDurationSec || 0)}</td>
      <td>${rate}</td>
      <td>${docs}</td>
    `;
    body.appendChild(tr);
  });

  if (!history.length) {
    body.innerHTML = '<tr><td colspan="8">Sem historico.</td></tr>';
  }
}

function renderAdminActivities(snapshot) {
  const body = document.getElementById('adminActivityBody');
  if (!body) return;

  body.innerHTML = '';
  const activities = snapshot.adminActivityLogs || [];

  activities.forEach((entry) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(entry.at)}</td>
      <td>${formatHour(entry.at)}</td>
      <td>${entry.adminName || '-'}</td>
      <td>${entry.action || '-'}</td>
      <td>${entry.details || '-'}</td>
    `;
    body.appendChild(tr);
  });

  if (!activities.length) {
    body.innerHTML = '<tr><td colspan="5">Sem atividades dos administradores ainda.</td></tr>';
  }
}

function render(snapshot) {
  renderKPIs(snapshot);
  renderQueue(snapshot);
  renderPerformance(snapshot);
  renderEmployeeCards(computeWorkerMetrics(snapshot));
  renderVisualization(snapshot);
  renderHistory(snapshot);
  renderAdminActivities(snapshot);
  renderWorkers(snapshot);
  updateCharts(snapshot);
}

function setActivitiesModal(open) {
  activitiesModalOpen = !!open;
  const modal = document.getElementById('activitiesModal');
  if (!modal) return;
  modal.classList.toggle('hidden', !activitiesModalOpen);
  document.body.style.overflow = activitiesModalOpen ? 'hidden' : '';
}

function setupActivitiesModal() {
  const openBtn = document.getElementById('btnOpenActivities');
  const closeBtn = document.getElementById('btnCloseActivities');
  const backdrop = document.getElementById('activitiesBackdrop');

  if (openBtn) openBtn.addEventListener('click', () => setActivitiesModal(true));
  if (closeBtn) closeBtn.addEventListener('click', () => setActivitiesModal(false));
  if (backdrop) backdrop.addEventListener('click', () => setActivitiesModal(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activitiesModalOpen) {
      setActivitiesModal(false);
    }
  });
}

function changeChartPeriod(period) {
  chartPeriod = period;
  chartOffset = 0;
  document.querySelectorAll('.filter-btn').forEach((b) => {
    if (b.textContent?.toLowerCase() === 'dia' || b.textContent?.toLowerCase() === 'semana' || b.textContent?.toLowerCase() === 'mes') {
      b.classList.remove('active');
    }
  });
  const clicked = Array.from(document.querySelectorAll('.chart-filter .filter-btn')).find((button) => button.textContent.toLowerCase() === (period === 'day' ? 'dia' : period === 'week' ? 'semana' : 'mes'));
  if (clicked) clicked.classList.add('active');
  render(getAdminSnapshot());
}

function navigateChartPeriod(step) {
  chartOffset += Number(step) || 0;
  if (chartOffset > 0) chartOffset = 0;
  render(getAdminSnapshot());
}

function exportData() {
  const snapshot = getAdminSnapshot();
  const metrics = computeWorkerMetrics(snapshot);
  const rows = (snapshot.fullHistory || []).map((h) => [
    formatDate(h.completedAt || h.createdAt),
    formatHour(h.completedAt || h.createdAt),
    h.code,
    h.service,
    h.userName,
    h.userEmail,
    h.attendedBy || '',
    h.serviceDurationSec || 0,
    h.rating ? h.rating.score : '',
    h.rating ? (h.rating.comment || '') : '',
    (h.attachments || []).map((a) => a.name).join(', ')
  ]);

  const head = ['Dia', 'Hora', 'Senha', 'Servico', 'Visitante', 'Email', 'Atendido Por', 'Duracao (seg)', 'Nota', 'Comentario', 'Documentos'];
  let format = document.getElementById('exportFormat')?.value;
  if (!format) format = 'excel';

  if (format === 'pdf') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Biblioteca de PDF nao carregada. Tente novamente.');
      return;
    }

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('Historico completo de atendimentos - IMTSB', 14, 12);
    doc.setFontSize(9);
    doc.text(`Gerado em ${formatDateTime(new Date().toISOString())}`, 14, 18);
    doc.autoTable({
      head: [head],
      body: rows,
      startY: 22,
      styles: { fontSize: 8 }
    });
    let nextY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 32;
    metrics.forEach((item, index) => {
      if (nextY > 175) {
        doc.addPage();
        nextY = 16;
      }

      const badge = getPerformanceBadge(item.score);
      doc.setFontSize(11);
      doc.text(`${item.name} - ${item.department}`, 14, nextY);
      doc.setFontSize(9);
      doc.text(`Desempenho: ${badge.label} | Pontuacao: ${item.score}`, 14, nextY + 6);
      doc.text(`Atendimentos: ${item.count} | Horas atendidas: ${formatDuration(item.totalWorkedSeconds)} | Jornadas: ${item.totalShifts}`, 14, nextY + 12);
      doc.text(`Tempo medio: ${formatDuration(item.avgServiceSec)} | Avaliacao media: ${item.avgRating ? item.avgRating.toFixed(1) : '0.0'}/5 | Taxa de conclusao: ${item.completionRate}%`, 14, nextY + 18);

      const cardRows = item.recentHistory.length
        ? item.recentHistory.map((entry) => [
            formatDate(entry.completedAt || entry.createdAt),
            entry.code,
            entry.service,
            formatDuration(entry.serviceDurationSec || 0),
            entry.rating ? `${entry.rating.score}/5` : '-'
          ])
        : [['-', '-', 'Sem atendimentos recentes', '-', '-']];

      doc.autoTable({
        head: [['Dia', 'Senha', 'Servico', 'Duracao', 'Avaliacao']],
        body: cardRows,
        startY: nextY + 22,
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8 }
      });
      nextY = doc.lastAutoTable.finalY + 10;
      if (index < metrics.length - 1 && nextY > 175) {
        doc.addPage();
        nextY = 16;
      }
    });
    if (currentAdminSession && typeof window.IMTSBStore.logAdminActivity === 'function') {
      window.IMTSBStore.logAdminActivity({
        adminName: currentAdminSession.name,
        action: 'Exportou historico',
        details: 'Formato PDF'
      });
    }
    doc.save(`historico_imtsb_${new Date().toISOString().split('T')[0]}.pdf`);
    return;
  }

  let html = '<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:20px;color:#2b2118}table{width:100%;border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #d7cec5;padding:8px;text-align:left;font-size:12px}h1,h2{color:#4a2a13}.card{border:1px solid #c9b7aa;border-radius:12px;padding:14px;margin:0 0 18px 0} .meta{margin:6px 0 10px 0;font-size:13px}</style></head><body>';
  html += `<h1>Historico completo de atendimentos - IMTSB</h1><p>Gerado em ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>`;
  metrics.forEach((item) => {
    const badge = getPerformanceBadge(item.score);
    html += `<div class="card"><h2>${escapeHtml(item.name)}</h2>`;
    html += `<div class="meta">Setor: ${escapeHtml(item.department)} | Desempenho: ${escapeHtml(badge.label)} | Pontuacao: ${item.score}</div>`;
    html += `<div class="meta">Atendimentos: ${item.count} | Horas atendidas: ${escapeHtml(formatDuration(item.totalWorkedSeconds))} | Jornadas: ${item.totalShifts}</div>`;
    html += `<div class="meta">Tempo medio: ${escapeHtml(formatDuration(item.avgServiceSec))} | Avaliacao media: ${escapeHtml(item.avgRating ? item.avgRating.toFixed(1) : '0.0')}/5 | Taxa de conclusao: ${item.completionRate}%</div>`;
    html += '<table><tr><th>Dia</th><th>Senha</th><th>Servico</th><th>Duracao</th><th>Avaliacao</th></tr>';
    if (item.recentHistory.length) {
      item.recentHistory.forEach((entry) => {
        html += '<tr>' + [
          formatDate(entry.completedAt || entry.createdAt),
          escapeHtml(entry.code),
          escapeHtml(entry.service),
          escapeHtml(formatDuration(entry.serviceDurationSec || 0)),
          escapeHtml(entry.rating ? `${entry.rating.score}/5` : '-')
        ].map((c) => `<td>${c}</td>`).join('') + '</tr>';
      });
    } else {
      html += '<tr><td>-</td><td>-</td><td>Sem atendimentos recentes</td><td>-</td><td>-</td></tr>';
    }
    html += '</table></div>';
  });
  html += '<table><tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr>';
  rows.forEach((r) => {
    html += '<tr>' + r.map((c) => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
  });
  html += '</table></body></html>';

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_imtsb_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  if (currentAdminSession && typeof window.IMTSBStore.logAdminActivity === 'function') {
    window.IMTSBStore.logAdminActivity({
      adminName: currentAdminSession.name,
      action: 'Exportou historico',
      details: 'Formato Excel'
    });
  }
}

function setupWorkerForm() {
  const btn = document.getElementById('btnAddWorker');
  if (!btn) return;

  const nameEl = document.getElementById('newWorkerName');
  const emailEl = document.getElementById('newWorkerEmail');
  const passEl = document.getElementById('newWorkerPass');
  const deptEl = document.getElementById('newWorkerDept');
  const msgEl = document.getElementById('workerFormMsg');

  btn.addEventListener('click', () => {
    const result = window.IMTSBStore.addWorker({
      name: nameEl.value,
      email: emailEl.value,
      password: passEl.value,
      department: deptEl.value,
      adminName: currentAdminSession ? currentAdminSession.name : 'Administrador'
    });

    if (!result.ok) {
      msgEl.textContent = result.message;
      msgEl.style.color = '#b91c1c';
      return;
    }

    msgEl.textContent = result.message;
    msgEl.style.color = '#0f766e';
    nameEl.value = '';
    emailEl.value = '';
    passEl.value = '';
    render(getAdminSnapshot());
  });
}

function renderWorkers(snapshot) {
  const workersBody = document.getElementById('workersBody');
  if (!workersBody) return;

  workersBody.innerHTML = '';
  const workers = snapshot.users.filter((u) => u.role === 'trabalhador');

  workers.forEach((w) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${w.name}</td>
      <td>${w.email}</td>
      <td>${w.department || 'Apoio ao Cliente'}</td>
      <td><button type="button" class="remove-worker-btn" data-worker-id="${w.id}">Remover</button></td>
    `;
    workersBody.appendChild(tr);
  });

  if (!workers.length) {
    workersBody.innerHTML = '<tr><td colspan="4">Sem trabalhadores cadastrados.</td></tr>';
  }

  workersBody.querySelectorAll('.remove-worker-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const workerId = btn.getAttribute('data-worker-id');
      const result = window.IMTSBStore.removeWorker(workerId, currentAdminSession ? currentAdminSession.name : 'Administrador');
      const msgEl = document.getElementById('workerFormMsg');
      if (msgEl) {
        msgEl.textContent = result.message;
        msgEl.style.color = result.ok ? '#0f766e' : '#b91c1c';
      }
      if (result.ok) render(getAdminSnapshot());
    });
  });
}

function sair() {
  window.IMTSBStore.logout();
}

function refreshDashboard() {
  render(getAdminSnapshot());
}

function saveAndResetDay() {
  const shouldContinue = confirm('Deseja guardar o historico do dia e reiniciar os contadores para 0? O historico acumulado continuara disponivel no painel.');
  if (!shouldContinue) return;

  const label = prompt('Etiqueta do dia (opcional):', new Date().toLocaleDateString('pt-BR')) || '';
  const result = window.IMTSBStore.archiveAndResetDay(label, currentAdminSession ? currentAdminSession.name : 'Administrador');
  alert(result.ok ? result.message : 'Falha ao reiniciar o dia.');
  render(getAdminSnapshot());
}

document.addEventListener('DOMContentLoaded', () => {
  const session = window.IMTSBStore.requireRole(['admin']);
  if (!session) return;
  currentAdminSession = session;

  updateDate();
  const p = document.getElementById('adminProfileName');
  const i = document.getElementById('adminInitials');
  if (p) p.textContent = session.name;
  if (i) i.textContent = initials(session.name);

  if (typeof window.IMTSBStore.logAdminActivity === 'function') {
    window.IMTSBStore.logAdminActivity({
      adminName: session.name,
      action: 'Entrou no painel administrativo',
      details: 'Acesso ao dashboard'
    });
  }

  initCharts();
  setupActivitiesModal();
  setupWorkerForm();
  render(getAdminSnapshot());

  window.IMTSBStore.onChange(() => {
    render(getAdminSnapshot());
  });

  const btn = document.getElementById('btnSairAdmin');
  if (btn) btn.addEventListener('click', sair);
  const btnResetDay = document.getElementById('btnResetDayAdmin');
  if (btnResetDay) btnResetDay.addEventListener('click', saveAndResetDay);
});
