function getAdminSnapshot() {
  if (typeof window.IMTSBStore.getAdminSnapshot === 'function') return window.IMTSBStore.getAdminSnapshot();
  const snapshot = window.IMTSBStore.getSnapshot();
  return { ...snapshot, fullHistory: snapshot.history || [], attendanceLogs: snapshot.attendanceLogs || [] };
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('pt-BR');
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

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function renderSummary(workerName, workerHistory, workerLogs) {
  const summaryGrid = document.getElementById('summaryGrid');
  if (!summaryGrid) return;

  const avgRating = average(workerHistory.filter((item) => item.rating).map((item) => Number(item.rating.score) || 0));
  const totalWorkedSeconds = workerLogs.reduce((acc, item) => acc + (Number(item.workedSeconds) || 0), 0);
  const avgServiceSec = average(workerHistory.map((item) => Number(item.serviceDurationSec) || 0).filter((value) => value > 0));
  const firstRecord = [...workerHistory.map((item) => item.completedAt || item.createdAt), ...workerLogs.map((item) => item.checkInAt)]
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  const lastRecord = [...workerHistory.map((item) => item.completedAt || item.createdAt), ...workerLogs.map((item) => item.checkOutAt || item.checkInAt)]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

  const items = [
    ['Atendimentos', workerHistory.length],
    ['Horas trabalhadas', formatDuration(totalWorkedSeconds)],
    ['Tempo medio', formatDuration(avgServiceSec)],
    ['Nota media', avgRating ? avgRating.toFixed(1) : '0.0'],
    ['Primeiro registo', firstRecord ? formatDate(firstRecord) : '-'],
    ['Ultimo registo', lastRecord ? formatDate(lastRecord) : '-']
  ];

  summaryGrid.innerHTML = items.map(([label, value]) => `
    <article class="summary-item">
      <div class="summary-label">${label}</div>
      <div class="summary-value">${value}</div>
    </article>
  `).join('');

  document.getElementById('detailWorkerName').textContent = workerName;
  document.getElementById('detailWorkerMeta').textContent = `${workerLogs.length} jornadas registadas e ${workerHistory.length} atendimentos concluidos.`;
}

function renderShiftTable(workerLogs) {
  const body = document.getElementById('shiftTableBody');
  if (!body) return;

  body.innerHTML = '';
  workerLogs.forEach((log) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(log.checkInAt)}</td>
      <td>${formatHour(log.checkInAt)}</td>
      <td>${formatHour(log.checkOutAt)}</td>
      <td>${formatDuration(log.workedSeconds || 0)}</td>
    `;
    body.appendChild(tr);
  });

  if (!workerLogs.length) {
    body.innerHTML = '<tr><td colspan="4">Sem registo de chegada e saida para este funcionario.</td></tr>';
  }
}

function renderHistoryTable(workerHistory) {
  const body = document.getElementById('historyTableBody');
  if (!body) return;

  body.innerHTML = '';
  workerHistory.forEach((item) => {
    const docs = (item.attachments || []).map((entry) => entry.name).join(', ') || '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatDate(item.completedAt || item.createdAt)}</td>
      <td>${formatHour(item.completedAt || item.createdAt)}</td>
      <td>${item.code}</td>
      <td>${item.service}</td>
      <td>${formatDuration(item.serviceDurationSec || 0)}</td>
      <td>${item.rating ? `${item.rating.score}/5` : '-'}</td>
      <td>${item.rating ? (item.rating.comment || '-') : '-'}</td>
      <td>${docs}</td>
    `;
    body.appendChild(tr);
  });

  if (!workerHistory.length) {
    body.innerHTML = '<tr><td colspan="8">Sem atendimentos concluidos para este funcionario.</td></tr>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const session = window.IMTSBStore.requireRole(['admin']);
  if (!session) return;

  const params = new URLSearchParams(window.location.search);
  const workerName = params.get('worker') || '';
  const snapshot = getAdminSnapshot();
  const history = snapshot.fullHistory || [];
  const workerHistory = history.filter((item) => item.attendedBy === workerName);
  const workerLogs = (snapshot.attendanceLogs || []).filter((item) => item.workerName === workerName);

  renderSummary(workerName || 'Funcionario', workerHistory, workerLogs);
  renderShiftTable(workerLogs);
  renderHistoryTable(workerHistory);
});
