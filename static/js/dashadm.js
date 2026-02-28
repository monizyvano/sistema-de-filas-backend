let lineChart;
let barChart;
let pieChart;
let chartPeriod = 'week';

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR');
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

function buildDailyCounts(history, daysBack) {
  const labels = [];
  const values = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
    const c = history.filter((h) => (h.completedAt || '').slice(0, 10) === key).length;
    values.push(c);
  }
  return { labels, values };
}

function buildHourlyCounts(history) {
  const labels = ['08h','09h','10h','11h','12h','13h','14h','15h','16h'];
  const values = labels.map(() => 0);
  history.forEach((h) => {
    if (!h.completedAt) return;
    const hour = new Date(h.completedAt).getHours();
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
    data: { labels: ['Aguardando','Em Atendimento','Concluido'], datasets: [{ data: [0,0,0], backgroundColor: ['rgba(140,103,70,.8)','rgba(191,167,153,.8)','rgba(38,5,5,.8)'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function updateCharts(snapshot) {
  if (!lineChart || !barChart || !pieChart) return;

  const days = chartPeriod === 'day' ? 1 : (chartPeriod === 'month' ? 30 : 7);
  const series = buildDailyCounts(snapshot.history, days);
  lineChart.data.labels = series.labels;
  lineChart.data.datasets[0].data = series.values;
  lineChart.update();

  const hourly = buildHourlyCounts(snapshot.history);
  barChart.data.labels = hourly.labels;
  barChart.data.datasets[0].data = hourly.values;
  barChart.update();

  const waiting = snapshot.queue.filter((q) => q.status === 'aguardando').length;
  const running = snapshot.queue.filter((q) => q.status === 'em_atendimento').length;
  const done = snapshot.history.length;
  pieChart.data.datasets[0].data = [waiting, running, done];
  pieChart.update();
}

function renderKPIs(snapshot) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayDone = snapshot.history.filter((h) => (h.completedAt || '').slice(0, 10) === todayKey).length;
  const waitingMins = snapshot.queue
    .filter((q) => q.status === 'aguardando')
    .map((q) => Math.max(0, Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 60000)));
  const avgWait = Math.round(average(waitingMins) || 0);

  const durSec = snapshot.history.map((h) => Number(h.serviceDurationSec) || 0).filter((v) => v > 0);
  const avgDurSec = Math.round(average(durSec) || 0);

  const scores = snapshot.history
    .filter((h) => h.rating && Number.isFinite(Number(h.rating.score)))
    .map((h) => Number(h.rating.score));
  const sat = Math.round(((average(scores) || 0) / 5) * 100);

  const occ = snapshot.queue.length + snapshot.history.length > 0
    ? Math.round((snapshot.queue.filter((q) => q.status === 'em_atendimento').length / 1) * 100)
    : 0;

  document.getElementById('kpiAttend').textContent = String(todayDone);
  document.getElementById('kpiWait').textContent = `${avgWait}min`;
  document.getElementById('kpiOcc').textContent = `${occ}%`;
  document.getElementById('kpiSat').textContent = `${sat}%`;
  document.getElementById('kpiOccTrend').textContent = `${occ}%`;
  document.getElementById('trendAttend').textContent = `${todayDone}`;

  const perf = document.getElementById('performanceBody');
  perf.innerHTML = '';

  const byWorker = {};
  snapshot.history.forEach((h) => {
    const key = h.attendedBy || 'Nao definido';
    if (!byWorker[key]) byWorker[key] = { count: 0, dur: [], ratingCount: 0 };
    byWorker[key].count += 1;
    if (h.serviceDurationSec) byWorker[key].dur.push(Number(h.serviceDurationSec));
    if (h.rating) byWorker[key].ratingCount += 1;
  });

  Object.keys(byWorker).forEach((name) => {
    const data = byWorker[name];
    const avg = Math.round(average(data.dur) || 0);
    const rate = data.count ? Math.round((data.ratingCount / data.count) * 100) : 0;
    const badge = rate >= 90 ? 'Excelente' : (rate >= 70 ? 'Bom' : 'Regular');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="employee-info"><div class="employee-avatar">${initials(name)}</div><div><div class="employee-name">${name}</div><div class="employee-role">Atendente</div></div></div></td>
      <td><strong>${data.count}</strong></td>
      <td>${Math.floor(avg / 60)}min ${String(avg % 60).padStart(2, '0')}s</td>
      <td><strong>${rate}%</strong></td>
      <td><span class="performance-badge ${badge === 'Excelente' ? 'badge-excellent' : 'badge-good'}">${badge}</span></td>
    `;
    perf.appendChild(tr);
  });

  if (!Object.keys(byWorker).length) {
    perf.innerHTML = '<tr><td colspan="5">Sem produtividade disponivel.</td></tr>';
  }

  document.getElementById('avgTime') && (document.getElementById('avgTime').textContent = `~${Math.max(1, Math.floor(avgDurSec / 60))}min`);
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

function renderHistory(snapshot) {
  const body = document.getElementById('historyBody');
  body.innerHTML = '';

  snapshot.history.forEach((h) => {
    const docs = (h.attachments || []).map((a) => a.name).join(', ') || '-';
    const rate = h.rating ? `${h.rating.score}/5` : '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${h.code}</td>
      <td>${h.service}</td>
      <td>${h.attendedBy || '-'}</td>
      <td>${Math.floor((h.serviceDurationSec || 0) / 60)}min ${String((h.serviceDurationSec || 0) % 60).padStart(2, '0')}s</td>
      <td>${rate}</td>
      <td>${docs}</td>
    `;
    body.appendChild(tr);
  });

  if (!snapshot.history.length) {
    body.innerHTML = '<tr><td colspan="6">Sem historico.</td></tr>';
  }
}

function render(snapshot) {
  renderKPIs(snapshot);
  renderQueue(snapshot);
  renderHistory(snapshot);
  renderWorkers(snapshot);
  updateCharts(snapshot);
}

function changeChartPeriod(period) {
  chartPeriod = period;
  document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
  const ev = window.event;
  if (ev && ev.target) ev.target.classList.add('active');
  render(window.IMTSBStore.getSnapshot());
}

function exportData() {
  const snapshot = window.IMTSBStore.getSnapshot();
  const rows = snapshot.history.map((h) => [
    h.code,
    h.service,
    h.userName,
    h.userEmail,
    h.attendedBy || '',
    formatDate(h.createdAt),
    formatDate(h.completedAt),
    h.serviceDurationSec || 0,
    h.rating ? h.rating.score : '',
    h.rating ? (h.rating.comment || '') : '',
    (h.attachments || []).map((a) => a.name).join(', ')
  ]);

  const head = ['Senha','Servico','Usuario','Email','Atendido Por','Emissao','Conclusao','Duracao (seg)','Nota','Comentario','Documentos'];
  let format = document.getElementById('exportFormat')?.value;
  if (!format) {
    const picked = (prompt('Escolha o formato: pdf ou excel', 'excel') || 'excel').toLowerCase();
    format = picked === 'pdf' ? 'pdf' : 'excel';
  }

  if (format === 'pdf') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('Biblioteca de PDF nao carregada. Tente novamente.');
      return;
    }

    const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
    doc.setFontSize(12);
    doc.text('Historico de Atendimentos - IMTSB', 14, 12);

    doc.autoTable({
      head: [head],
      body: rows,
      startY: 18,
      styles: { fontSize: 8 }
    });

    doc.save(`historico_imtsb_${new Date().toISOString().split('T')[0]}.pdf`);
    return;
  }

  let html = '<table><tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr>';
  rows.forEach((r) => {
    html += '<tr>' + r.map((c) => `<td>${String(c ?? '').replace(/</g,'&lt;')}</td>`).join('') + '</tr>';
  });
  html += '</table>';

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico_imtsb_${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
      department: deptEl.value
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
    render(window.IMTSBStore.getSnapshot());
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
      const result = window.IMTSBStore.removeWorker(workerId);
      const msgEl = document.getElementById('workerFormMsg');
      if (msgEl) {
        msgEl.textContent = result.message;
        msgEl.style.color = result.ok ? '#0f766e' : '#b91c1c';
      }
      if (result.ok) render(window.IMTSBStore.getSnapshot());
    });
  });
}

function sair() {
  window.IMTSBStore.logout();
}

function refreshDashboard() {
  render(window.IMTSBStore.getSnapshot());
}

function saveAndResetDay() {
  const shouldContinue = confirm('Deseja guardar o historico do dia e reiniciar os contadores para 0?');
  if (!shouldContinue) return;

  const label = prompt('Etiqueta do dia (opcional):', new Date().toLocaleDateString('pt-BR')) || '';
  const result = window.IMTSBStore.archiveAndResetDay(label);
  alert(result.ok ? result.message : 'Falha ao reiniciar o dia.');
  render(window.IMTSBStore.getSnapshot());
}

document.addEventListener('DOMContentLoaded', () => {
  const session = window.IMTSBStore.requireRole(['admin']);
  if (!session) return;

  updateDate();
  const p = document.getElementById('adminProfileName');
  const i = document.getElementById('adminInitials');
  if (p) p.textContent = session.name;
  if (i) i.textContent = initials(session.name);

  initCharts();
  setupWorkerForm();
  render(window.IMTSBStore.getSnapshot());

  window.IMTSBStore.onChange(() => {
    render(window.IMTSBStore.getSnapshot());
  });

  const btn = document.getElementById('btnSairAdmin');
  if (btn) btn.addEventListener('click', sair);
  const btnResetDay = document.getElementById('btnResetDayAdmin');
  if (btnResetDay) btnResetDay.addEventListener('click', saveAndResetDay);
});

