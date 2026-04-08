/**
 * dash.js — Dashboard do Atendente
 * Sistema de Filas IMTSB
 * Liga o painel ao backend Flask em tempo real.
 */

"use strict";

/* ── Estado local ── */
var timerInterval  = null;
var timerSegundos  = 0;
var isPaused       = false;
var currentTicket  = null;
var currentSession = null;

/* ── Utilitários ── */

function fmtDuracao(seg) {
  var s = Math.max(0, Number(seg) || 0);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT");
}

function fmtEspera(criadoEm) {
  if (!criadoEm) return "—";
  var min = Math.max(0, Math.floor((Date.now() - new Date(criadoEm).getTime()) / 60000));
  return min + " minutos";
}

function notificar(msg) {
  var el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText = [
    "position:fixed", "top:20px", "right:20px",
    "background:#10B981", "color:#fff",
    "padding:1rem 1.5rem", "border-radius:12px",
    "box-shadow:0 4px 16px rgba(0,0,0,.15)",
    "z-index:9999", "font-weight:600"
  ].join(";");
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 3000);
}

/* ── Timer ── */

function iniciarTimer() {
  clearInterval(timerInterval);
  timerSegundos = 0;
  timerInterval = setInterval(function () {
    if (isPaused) return;
    timerSegundos++;
    var el = document.getElementById("timer");
    if (el) el.textContent = fmtDuracao(timerSegundos);
  }, 1000);
}

function pararTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  var el = document.getElementById("timer");
  if (el) el.textContent = "00:00";
}

/* ── Render do ticket actual ── */

function renderTicketActual(ticket) {
  currentTicket = ticket || null;

  var passEl  = document.getElementById("currentPassword");
  var typeEl  = document.getElementById("passwordType");
  var servEl  = document.getElementById("serviceValue");
  var waitEl  = document.getElementById("waitTime");
  var issEl   = document.getElementById("issuedAt");
  var obsEl   = document.getElementById("obsValue");
  var btnConcluir = document.getElementById("btnConcluir");

  if (!ticket) {
    if (passEl) passEl.textContent = "---";
    if (typeEl) typeEl.textContent = "Aguardando atendimento";
    if (servEl) servEl.textContent = "—";
    if (waitEl) waitEl.textContent = "—";
    if (issEl)  issEl.textContent  = "—";
    if (obsEl)  obsEl.textContent  = "Sem observações";
    if (btnConcluir) btnConcluir.disabled = true;
    var statusText = document.getElementById("statusText");
    var statusDt   = document.getElementById("statusDot");
    if (statusText) statusText.textContent = "Disponível";
    if (statusDt)   statusDt.style.background = "#10B981";
    pararTimer();
    return;
  }

  if (passEl) passEl.textContent = ticket.code;
  if (typeEl) typeEl.textContent = ticket.type === "prioritaria"
    ? "Atendimento Prioritário" : "Atendimento Normal";
  if (servEl) servEl.textContent = ticket.service || "—";
  if (waitEl) waitEl.textContent = fmtEspera(ticket.createdAt);
  if (issEl)  issEl.textContent  = fmtData(ticket.createdAt);
  if (obsEl)  obsEl.textContent  = ticket.notes || "Sem observações";
  if (btnConcluir) btnConcluir.disabled = false;

  var statusText = document.getElementById("statusText");
  if (statusText) statusText.textContent = "Em Atendimento";
  if (!timerInterval) iniciarTimer();
}

/* ── Render do resumo da fila e log ── */

function renderResumo(snapshot) {
  var waiting = (snapshot.queue || []).filter(function (t) {
    return t.status === "aguardando";
  }).length;
  var hist = snapshot.history || [];

  var meuNome = currentSession && currentSession.name;
  var servidos = meuNome ? hist.filter(function (t) {
    return t.attendedBy === meuNome;
  }).length : 0;
  var durs = meuNome ? hist
    .filter(function (t) { return t.attendedBy === meuNome; })
    .map(function (t) { return Number(t.serviceDurationSec) || 0; })
    .filter(function (v) { return v > 0; }) : [];
  var avgSec = durs.length
    ? Math.round(durs.reduce(function (a, b) { return a + b; }, 0) / durs.length)
    : 0;

  var wEl = document.getElementById("waitingCount");
  var sEl = document.getElementById("servedToday");
  var aEl = document.getElementById("avgTime");
  if (wEl) wEl.textContent = String(waiting).padStart(2, "0");
  if (sEl) sEl.textContent = String(servidos).padStart(2, "0");
  if (aEl) aEl.textContent = "~" + Math.max(1, Math.floor(avgSec / 60)) + "min";

  var log = document.getElementById("activityLog");
  if (!log) return;
  log.innerHTML = "";
  hist
    .filter(function (t) { return t.attendedBy === meuNome; })
    .slice(0, 6)
    .forEach(function (t) {
      var item = document.createElement("article");
      item.className = "log-item";
      item.innerHTML = "<div class='log-password'>" + t.code + " — Concluído</div>"
        + "<div class='log-time'>" + fmtData(t.completedAt)
        + " · " + fmtDuracao(t.serviceDurationSec || 0) + "</div>";
      log.appendChild(item);
    });
  if (!log.children.length) {
    log.innerHTML = "<p class='log-item'>Sem histórico ainda.</p>";
  }
}

/* ── Actualizar snapshot via API ── */

async function actualizarSnapshot() {
  var snapshot;

  if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
    try {
      var res = await window.IMTSBApiClient.getSnapshot();
      if (res && res.ok && res.data) {
        snapshot = res.data;
      }
    } catch (e) {
      console.error("Erro ao buscar snapshot:", e);
    }
  }

  if (!snapshot && window.IMTSBStore) {
    snapshot = window.IMTSBStore.getSnapshot();
  }

  if (!snapshot) return;

  /* Encontrar ticket actual deste atendente */
  var meuTicket = null;
  if (currentSession) {
    meuTicket = (snapshot.queue || []).find(function (t) {
      return t.status === "em_atendimento" &&
             t.attendedBy === currentSession.name;
    }) || null;
  }

  renderTicketActual(meuTicket);
  renderResumo(snapshot);
}

/* ── Ações do atendente ── */

window.callNextCustomer = async function () {
  if (!currentSession) return;

  var balcao     = currentSession.balcao || 1;
  var servicoId  = currentSession.servico_id || 1;

  var result;

  if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
    try {
      var res = await window.IMTSBApiClient.callNext({
        servico_id:    servicoId,
        numero_balcao: balcao,
        attendant_id:  currentSession.id,
      });
      if (res && res.ok) {
        var ticket = (res.data && res.data.ticket) || res.ticket;
        result = { ok: true, ticket: ticket };
      } else {
        result = { ok: false, message: (res && (res.message || (res.data && res.data.message))) || "Sem senhas disponíveis" };
      }
    } catch (e) {
      result = { ok: false, message: "Erro de conexão" };
    }
  } else if (window.IMTSBStore) {
    result = await window.IMTSBStore.callNext(servicoId, balcao);
  } else {
    result = { ok: false, message: "API não disponível" };
  }

  if (!result || !result.ok) {
    notificar(result && result.message ? result.message : "Sem senhas disponíveis");
    return;
  }

  timerSegundos = 0;
  isPaused      = false;
  await actualizarSnapshot();
  var ticket = result.ticket || currentTicket;
  notificar("Próximo cliente: " + (ticket && ticket.code ? ticket.code : "—"));
};

window.concludeAttendance = async function () {
  if (!currentTicket) { alert("Nenhum atendimento em curso."); return; }

  var observacoes = prompt("Observação final (opcional):") || "";
  var duracaoSeg  = timerSegundos;

  var resultado;

  if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
    try {
      var res = await window.IMTSBApiClient.finishAttendance(currentTicket.id, observacoes);
      resultado = res && res.ok ? { ok: true, ticket: res.data, receipt: null } : null;
    } catch (e) {
      resultado = null;
    }
  } else if (window.IMTSBStore) {
    resultado = await window.IMTSBStore.finishAttendance(currentTicket.id, observacoes);
  }

  if (!resultado || !resultado.ok) { alert("Erro ao concluir atendimento."); return; }

  pararTimer();
  currentTicket = null;
  timerSegundos = 0;
  isPaused      = false;
  await actualizarSnapshot();
  notificar("Atendimento concluído.");
};

window.togglePause = function () {
  isPaused = !isPaused;
  var btn  = document.getElementById("pauseBtn");
  var dot  = document.getElementById("statusDot");
  var txt  = document.getElementById("statusText");
  if (btn) btn.textContent = isPaused ? "Continuar" : "Pausar";
  if (dot) dot.style.background = isPaused ? "#F59E0B" : "#10B981";
  if (txt) { txt.textContent = isPaused ? "Pausado" : "Em Atendimento";
             txt.style.color  = isPaused ? "#F59E0B" : "#10B981"; }
};

window.redirectCustomer = async function () {
  if (!currentTicket) { alert("Nenhum atendimento em curso."); return; }
  var motivo = prompt("Motivo do reencaminhamento:", "Reencaminhado para outro sector") || "Reencaminhado";

  if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
    try {
      await window.IMTSBApiClient.finishAttendance(currentTicket.id, "Reencaminhado: " + motivo);
    } catch (e) {
      console.error("[redirectCustomer] Erro ao cancelar:", e);
    }
  }

  pararTimer(); currentTicket = null;
  await actualizarSnapshot();
  notificar("Cliente reencaminhado.");
};

window.addObservation = function () {
  if (!currentTicket) { alert("Nenhum atendimento em curso."); return; }
  var obs = prompt("Observação:");
  if (!obs) return;
  var el = document.getElementById("obsValue");
  if (el) el.textContent = obs;
  notificar("Observação adicionada.");
};

window.requestDocuments = function () {
  if (!currentTicket) { alert("Nenhum atendimento em curso."); return; }
  var docs  = (currentTicket.attachments || []).map(function (d) { return d.name; }).join("\n") || "Nenhum documento.";
  var email = currentTicket.notificationEmail || currentTicket.userEmail || "—";
  alert("Email de notificação: " + email + "\n\nDocumentos:\n" + docs);
};

window.sendReceipt = async function () {
  if (!currentTicket) { alert("Nenhum atendimento em curso."); return; }

  /* Concluir atendimento */
  var observacoes = prompt("Observação final (opcional):") || "";
  var duracaoSeg  = timerSegundos;

  var resultado;

  if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
    try {
      var res = await window.IMTSBApiClient.finishAttendance(currentTicket.id, observacoes);
      resultado = res && res.ok ? { ok: true, data: res.data } : null;
    } catch (e) {
      resultado = null;
    }
  } else if (window.IMTSBStore) {
    resultado = await window.IMTSBStore.finishAttendance(currentTicket.id, observacoes);
  }

  if (!resultado || !resultado.ok) { alert("Erro ao concluir atendimento."); return; }

  /* Gerar recibo .txt */
  var dataStr = new Date().toLocaleString("pt-PT");
  var texto =
    "================================================\n" +
    "     IMTSB — Recibo de Atendimento\n" +
    "================================================\n\n" +
    "Senha:      " + (currentTicket.code || currentTicket.numero || "—") + "\n" +
    "Serviço:    " + (currentTicket.service || "—") + "\n" +
    "Atendente:  " + (currentSession && currentSession.name || "—") + "\n" +
    "Balcão:     " + (currentSession && currentSession.balcao || "—") + "\n" +
    "Data:       " + dataStr + "\n" +
    "Duração:    " + fmtDuracao(duracaoSeg) + "\n" +
    "\n" +
    "================================================\n" +
    " Obrigado por utilizar o Sistema de Filas IMTSB!\n" +
    "================================================\n";

  var blob = new Blob([texto], { type: "text/plain;charset=utf-8;" });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement("a");
  var nomeFicheiro = "recibo_" + (currentTicket.code || currentTicket.numero || "atendimento") + ".txt";
  a.href = url; a.download = nomeFicheiro;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);

  pararTimer(); currentTicket = null; timerSegundos = 0; isPaused = false;
  await actualizarSnapshot();
  notificar("Recibo descarregado: " + nomeFicheiro);
};

window.showStatistics = function () {
  alert("Atendimentos hoje: " + document.getElementById("servedToday").textContent
    + "\nEm espera: " + document.getElementById("waitingCount").textContent
    + "\nTempo actual: " + fmtDuracao(timerSegundos));
};

window.sair = function () {
  if (window.IMTSBStore) { window.IMTSBStore.logout(); return; }
  localStorage.removeItem("imtsb_session_v1");
  localStorage.removeItem("imtsb_user");
  localStorage.removeItem("imtsb_access_token");
  localStorage.removeItem("imtsb_refresh_token");
  window.location.href = "/";
};

/* ── Init ── */

document.addEventListener("DOMContentLoaded", async function () {
  /* Verificar sessão */
  var sessaoRaw = localStorage.getItem("imtsb_session_v1");
  if (!sessaoRaw) { window.location.href = "/"; return; }
  try { currentSession = JSON.parse(sessaoRaw); } catch (_) { window.location.href = "/"; return; }
  if (!currentSession || !["trabalhador", "admin"].includes(currentSession.role)) {
    window.location.href = "/"; return;
  }

  /* Preencher cabeçalho */
  var wn = document.getElementById("workerName");
  var wa = document.getElementById("workerAvatar");
  var wd = document.getElementById("workerDept");
  var cb = document.getElementById("counterBadge");
  if (wn) wn.textContent = currentSession.name || "Atendente";
  if (wd) wd.textContent = currentSession.department || "—";
  if (cb) cb.textContent = "Balcão " + (currentSession.balcao || "?");
  if (wa) {
    wa.textContent = (currentSession.name || "AT").split(" ")
      .slice(0, 2).map(function (p) { return p[0].toUpperCase(); }).join("");
  }

  /* Snapshot inicial */
  await actualizarSnapshot();

  /* Polling a cada 4 segundos */
  setInterval(actualizarSnapshot, 4000);
});
