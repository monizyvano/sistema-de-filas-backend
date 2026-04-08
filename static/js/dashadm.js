/**
 * dashadm.js — Dashboard do Administrador
 * Sistema de Filas IMTSB
 * Liga o painel ao backend Flask em tempo real.
 */

"use strict";

var lineChart   = null;
var barChart    = null;
var pieChart    = null;
var chartPeriod = "week";

/* ── Utilitários ── */

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT");
}

function initials(name) {
  return String(name || "AD").split(" ").filter(Boolean).slice(0, 2)
    .map(function (p) { return p[0].toUpperCase(); }).join("");
}

function avg(arr) {
  return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0;
}

/* ── Obter snapshot via API ── */

async function getSnapshotData() {
  if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
    var res = await window.IMTSBApiClient.getSnapshot();
    if (res && res.ok && res.data) return res.data;
  }
  if (window.IMTSBStore) return window.IMTSBStore.getSnapshot();
  return { queue: [], history: [], users: [], stats: {}, lastCalled: null };
}

/* ── KPIs ── */

function renderKPIs(snapshot) {
  var stats = snapshot.stats || {};

  var kpiAttend = document.getElementById("kpiAttend");
  var kpiWait   = document.getElementById("kpiWait");
  var kpiOcc    = document.getElementById("kpiOcc");
  var kpiSat    = document.getElementById("kpiSat");
  var trendAt   = document.getElementById("trendAttend");

  if (kpiAttend) kpiAttend.textContent = stats.concluidas || 0;
  if (kpiWait)   kpiWait.textContent   = (stats.tempo_medio_espera || 0) + "min";
  if (kpiOcc)    kpiOcc.textContent    = (stats.em_atendimento || 0) + " activos";
  if (kpiSat)    kpiSat.textContent    = (stats.satisfacao_pct || 0) + "%";
  if (trendAt)   trendAt.textContent   = stats.total_emitidas || 0;
}

/* ── Fila em tempo real ── */

function renderFila(snapshot) {
  var lista = document.getElementById("queueList");
  if (!lista) return;
  lista.innerHTML = "";

  var agrupado = {};
  (snapshot.queue || []).forEach(function (t) {
    var k = t.service || "Outros";
    agrupado[k] = (agrupado[k] || 0) + 1;
  });

  if (!Object.keys(agrupado).length) {
    lista.innerHTML = "<p>Sem fila no momento.</p>"; return;
  }

  Object.keys(agrupado).forEach(function (srv) {
    var c   = agrupado[srv];
    var div = document.createElement("div");
    div.className = "queue-item";
    div.innerHTML = "<div><div class='queue-service'>" + srv + "</div>"
      + "<div class='queue-count'>" + c + " pessoa(s) a aguardar</div></div>"
      + "<div class='queue-number'>" + String(c).padStart(2, "0") + "</div>";
    lista.appendChild(div);
  });
}

/* ── Histórico ── */

function renderHistorico(snapshot) {
  var body = document.getElementById("historyBody");
  if (!body) return;
  body.innerHTML = "";

  if (!(snapshot.history || []).length) {
    body.innerHTML = "<tr><td colspan='6'>Sem histórico hoje.</td></tr>"; return;
  }

  snapshot.history.forEach(function (h) {
    var dur  = Math.floor((h.serviceDurationSec || 0) / 60) + "min "
             + String((h.serviceDurationSec || 0) % 60).padStart(2, "0") + "s";
    var nota = h.rating ? h.rating.score + "/5" : "—";
    var tr   = document.createElement("tr");
    tr.innerHTML = "<td>" + (h.code || "—") + "</td>"
      + "<td>" + (h.service || "—") + "</td>"
      + "<td>" + (h.attendedBy || "—") + "</td>"
      + "<td>" + dur + "</td>"
      + "<td>" + nota + "</td>"
      + "<td>Concluído</td>";
    body.appendChild(tr);
  });
}

/* ── Produtividade por atendente ── */

function renderProdutividade(snapshot) {
  var body = document.getElementById("performanceBody");
  if (!body) return;
  body.innerHTML = "";

  var porAtendente = {};
  (snapshot.history || []).forEach(function (h) {
    var k = h.attendedBy || "Não definido";
    if (!porAtendente[k]) porAtendente[k] = { count: 0, durs: [], ratings: 0 };
    porAtendente[k].count++;
    if (h.serviceDurationSec) porAtendente[k].durs.push(h.serviceDurationSec);
    if (h.rating) porAtendente[k].ratings++;
  });

  if (!Object.keys(porAtendente).length) {
    body.innerHTML = "<tr><td colspan='5'>Sem dados de produtividade.</td></tr>"; return;
  }

  Object.keys(porAtendente).forEach(function (nome) {
    var d      = porAtendente[nome];
    var avgSec = Math.round(avg(d.durs));
    var taxa   = d.count ? Math.round((d.ratings / d.count) * 100) : 0;
    var badge  = taxa >= 80 ? "badge-excellent" : "badge-good";
    var label  = taxa >= 80 ? "Excelente" : "Bom";
    var tr     = document.createElement("tr");
    tr.innerHTML = "<td><div class='employee-info'>"
      + "<div class='employee-avatar'>" + initials(nome) + "</div>"
      + "<div><div class='employee-name'>" + nome + "</div>"
      + "<div class='employee-role'>Atendente</div></div></div></td>"
      + "<td><strong>" + d.count + "</strong></td>"
      + "<td>" + Math.floor(avgSec / 60) + "min " + String(avgSec % 60).padStart(2, "0") + "s</td>"
      + "<td><strong>" + taxa + "%</strong></td>"
      + "<td><span class='performance-badge " + badge + "'>" + label + "</span></td>";
    body.appendChild(tr);
  });
}

/* ── Lista de atendentes ── */

function renderAtendentes(snapshot) {
  var body = document.getElementById("workersBody");
  if (!body) return;
  body.innerHTML = "";

  var workers = (snapshot.users || []).filter(function (u) { return u.role === "trabalhador"; });
  if (!workers.length) {
    body.innerHTML = "<tr><td colspan='4'>Sem atendentes.</td></tr>"; return;
  }

  workers.forEach(function (w) {
    var tr = document.createElement("tr");
    tr.innerHTML = "<td>" + (w.name || "—") + "</td>"
      + "<td>" + (w.email || "—") + "</td>"
      + "<td>" + (w.department || "—") + "</td>"
      + "<td><button type='button' class='remove-worker-btn' data-id='" + w.id + "'>Remover</button></td>";
    body.appendChild(tr);
  });

  body.querySelectorAll(".remove-worker-btn").forEach(function (btn) {
    btn.addEventListener("click", async function () {
      var id = btn.getAttribute("data-id");
      if (!confirm("Remover este atendente?")) return;
      if (window.IMTSBStore) window.IMTSBStore.removeWorker(id);
      await render();
    });
  });
}

/* ── Gráficos ── */

function initCharts() {
  if (lineChart || !window.Chart) return;
  var lEl = document.getElementById("lineChart");
  var bEl = document.getElementById("barChart");
  var pEl = document.getElementById("pieChart");
  if (!lEl || !bEl || !pEl) return;

  lineChart = new Chart(lEl.getContext("2d"), {
    type: "line",
    data: { labels: [], datasets: [{ label: "Atendimentos", data: [],
      borderColor: "#8C6746", backgroundColor: "rgba(140,103,70,.1)",
      borderWidth: 3, tension: .35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } } }
  });

  barChart = new Chart(bEl.getContext("2d"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "Pico", data: [],
      backgroundColor: "rgba(191,167,153,.85)", borderRadius: 8 }] },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } } }
  });

  pieChart = new Chart(pEl.getContext("2d"), {
    type: "doughnut",
    data: { labels: ["Aguardando","Em Atendimento","Concluído"],
      datasets: [{ data: [0,0,0],
        backgroundColor: ["rgba(140,103,70,.8)","rgba(191,167,153,.8)","rgba(38,5,5,.8)"] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function updateCharts(snapshot) {
  if (!lineChart) return;
  var waiting = (snapshot.queue || []).filter(function (q) { return q.status === "aguardando"; }).length;
  var running = (snapshot.queue || []).filter(function (q) { return q.status === "em_atendimento"; }).length;
  var done    = (snapshot.history || []).length;

  pieChart.data.datasets[0].data = [waiting, running, done];
  pieChart.update();

  var labels = ["D-6","D-5","D-4","D-3","D-2","D-1","Hoje"];
  var vals   = [0, 0, 0, 0, 0, 0, done];
  lineChart.data.labels = labels;
  lineChart.data.datasets[0].data = vals;
  lineChart.update();

  var horas  = ["08h","09h","10h","11h","12h","13h","14h","15h","16h"];
  var counts = horas.map(function () { return 0; });
  (snapshot.history || []).forEach(function (h) {
    if (!h.completedAt) return;
    var hr  = new Date(h.completedAt).getHours();
    var idx = hr - 8;
    if (idx >= 0 && idx < counts.length) counts[idx]++;
  });
  barChart.data.labels = horas;
  barChart.data.datasets[0].data = counts;
  barChart.update();
}

/* ── Render completo ── */

async function render() {
  var snapshot = await getSnapshotData();
  renderKPIs(snapshot);
  renderFila(snapshot);
  renderHistorico(snapshot);
  renderProdutividade(snapshot);
  renderAtendentes(snapshot);
  updateCharts(snapshot);
}

/* ── Formulário adicionar atendente ── */

function setupWorkerForm() {
  var btn = document.getElementById("btnAddWorker");
  if (!btn) return;
  btn.addEventListener("click", async function () {
    var nome  = (document.getElementById("newWorkerName")  || {}).value || "";
    var email = (document.getElementById("newWorkerEmail") || {}).value || "";
    var pass  = (document.getElementById("newWorkerPass")  || {}).value || "";
    var dept  = (document.getElementById("newWorkerDept")  || {}).value || "";
    var msg   = document.getElementById("workerFormMsg");

    var result = { ok: false, message: "Funcionalidade pendente." };

    if (msg) { msg.textContent = result.message; msg.style.color = result.ok ? "#0f766e" : "#b91c1c"; }
    if (result && result.ok) await render();
  });
}

/* ── Exportar ── */

window.exportData = async function () {
  var snapshot = await getSnapshotData();
  var rows = (snapshot.history || []).map(function (h) {
    return [h.code, h.service, h.userName, h.userEmail, h.attendedBy,
            fmtData(h.createdAt), fmtData(h.completedAt), h.serviceDurationSec || 0,
            h.rating ? h.rating.score : "", h.rating ? (h.rating.comment || "") : ""];
  });
  var head = ["Senha","Serviço","Visitante","Email","Atendido Por","Emissão","Conclusão","Duração(seg)","Nota","Comentário"];
  var html = "<table><tr>" + head.map(function (h) { return "<th>" + h + "</th>"; }).join("") + "</tr>";
  rows.forEach(function (r) {
    html += "<tr>" + r.map(function (c) { return "<td>" + String(c == null ? "" : c) + "</td>"; }).join("") + "</tr>";
  });
  html += "</table>";
  var blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  a.href = url; a.download = "historico_imtsb_" + new Date().toISOString().slice(0, 10) + ".xls";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.changeChartPeriod = function (period) {
  chartPeriod = period;
  document.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
  if (window.event && window.event.target) window.event.target.classList.add("active");
  render();
};

window.sair = function () {
  localStorage.removeItem("imtsb_session_v1");
  localStorage.removeItem("imtsb_user");
  localStorage.removeItem("imtsb_access_token");
  localStorage.removeItem("imtsb_refresh_token");
  if (window.IMTSBStore) window.IMTSBStore.logout();
  else window.location.href = "/";
};

/* ── Init ── */

document.addEventListener("DOMContentLoaded", async function () {
  var sessaoRaw = localStorage.getItem("imtsb_session_v1");
  if (!sessaoRaw) { window.location.href = "/"; return; }
  var session;
  try { session = JSON.parse(sessaoRaw); } catch (_) { window.location.href = "/"; return; }
  if (!session || session.role !== "admin") { window.location.href = "/"; return; }

  var nameEl = document.getElementById("adminProfileName");
  var initEl = document.getElementById("adminInitials");
  var dateEl = document.getElementById("currentDate");
  if (nameEl) nameEl.textContent = session.name || "Administrador";
  if (initEl) initEl.textContent = initials(session.name);
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });

  initCharts();
  setupWorkerForm();
  await render();

  /* Polling a cada 5 segundos */
  setInterval(render, 5000);

  var btnSair  = document.getElementById("btnSairAdmin");
  var btnReset = document.getElementById("btnResetDayAdmin");
  if (btnSair)  btnSair.addEventListener("click", window.sair);
  if (btnReset) btnReset.addEventListener("click", function () {
    alert("Funcionalidade pendente.");
  });
});
