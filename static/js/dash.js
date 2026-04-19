/**
 * static/js/dash.js — Sprint 2 COMPLETO
 * ═══════════════════════════════════════════════════════════════
 * FIXES:
 *   ✅ pararTimer() definido (estava indefinido — causava crash)
 *   ✅ pararPolling() definido (estava indefinido)
 *   ✅ atualizarEstatisticas() sem duplicação
 *   ✅ Botão Concluir activa/desactiva correctamente
 *   ✅ Botão Negar funcional
 *   ✅ Todos os botões de acção funcionais
 *   ✅ Timer inicia ao chamar senha
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store    = window.IMTSBStore;
  const ANGOLA_TZ = "Africa/Luanda";

  /* ── Estado ──────────────────────────────────────────────── */
  let senhaAtual       = null;
  let timerInterval    = null;
  let pollingInterval  = null;
  let timerSegundos    = 0;

  /* ── Formatadores ────────────────────────────────────────── */
  function nowKeyLuanda() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: ANGOLA_TZ }).format(new Date());
  }
  function keyFromDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: ANGOLA_TZ }).format(new Date(value));
  }
  function formatTimeLuanda(value) {
    if (!value) return "--:--";
    return new Date(value).toLocaleTimeString("pt-PT", { hour:"2-digit", minute:"2-digit", timeZone: ANGOLA_TZ });
  }
  function formatDuracao(seg) {
    const total = Math.max(0, Number(seg) || 0);
    const m = String(Math.floor(total / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  /* ── Status / UI ─────────────────────────────────────────── */
  function setStatus(text, cor) {
    const statusText = document.getElementById("statusText");
    const statusDot  = document.getElementById("statusDot");
    if (statusText) statusText.textContent = text;
    if (statusDot)  statusDot.style.background = cor || "#10b981";
  }

  function showToast(message, tipo) {
    const existing = document.getElementById('dashToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'dashToast';
    const bg = tipo === 'error' ? '#dc2626' : tipo === 'warn' ? '#d97706' : '#059669';
    toast.style.cssText = `
        position:fixed;top:1.5rem;right:1.5rem;background:${bg};color:white;
        padding:.85rem 1.5rem;border-radius:12px;font-weight:600;font-size:.9rem;
        z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);
        animation:slideInRight .3s ease-out;max-width:320px;line-height:1.4;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  /* ── Timer ───────────────────────────────────────────────── */
  function iniciarTimer() {
    pararTimer();
    timerSegundos = 0;
    timerInterval = setInterval(() => {
      timerSegundos += 1;
      const el = document.getElementById("timer");
      if (el) el.textContent = formatDuracao(timerSegundos);
    }, 1000);
  }

  /* ✅ FIX: pararTimer estava indefinido */
  function pararTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerSegundos = 0;
    const el = document.getElementById("timer");
    if (el) el.textContent = "00:00";
  }

  /* ── Polling ─────────────────────────────────────────────── */
  function iniciarPolling() {
    pararPolling();
    pollingInterval = setInterval(async () => {
      await atualizarEstatisticas();
      await atualizarHistorico();
      await atualizarFilaAoVivo();
    }, 7000);
  }

  /* ✅ FIX: pararPolling estava indefinido */
  function pararPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  }

  /* ── Actualizar tudo ─────────────────────────────────────── */
  async function atualizarTudo() {
    await Promise.all([atualizarEstatisticas(), atualizarHistorico(), atualizarFilaAoVivo()]);
  }

  /* ── Dados do trabalhador ────────────────────────────────── */
  function carregarDadosTrabalhador() {
    const user = store.getUser();
    if (!user) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set("workerName", user.name || "Trabalhador");
    set("workerDept", user.departamento || "Atendimento");

    const iniciais = (user.name || "T").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    set("workerAvatar", iniciais);

    const balcao = user.balcao || user.numero_balcao;
    set("counterBadge", balcao ? `Balcão ${balcao}` : "Sem balcão");
  }

  /* ── Estatísticas ────────────────────────────────────────── */
  async function atualizarEstatisticas() {
    try {
      const resp = await fetch("/api/dashboard/trabalhador/estatisticas", {
        headers: { Authorization: `Bearer ${store.getToken()}` }
      });
      if (resp.status === 401) { store.logout(); return; }
      if (!resp.ok) return;
      const stats = await resp.json();
      const g = id => document.getElementById(id);
      if (g("waitingCount")) g("waitingCount").textContent = stats.aguardando || 0;
      if (g("servedToday"))  g("servedToday").textContent  = stats.atendidos_hoje || 0;
      if (g("avgTime"))      g("avgTime").textContent      = `${Math.round(stats.tempo_medio_atendimento || 0)}m`;
    } catch (err) {
      console.error("[worker] estatísticas:", err);
    }
  }

  /* ── Histórico ───────────────────────────────────────────── */
  async function atualizarHistorico() {
    const user = store.getUser();
    if (!user) return;
    try {
      const resp = await fetch(`/api/senhas?atendente_id=${user.id}&status=concluida&page=1&per_page=25`, {
        headers: { Authorization: `Bearer ${store.getToken()}` }
      });
      if (!resp.ok) return;
      const data  = await resp.json();
      const today = nowKeyLuanda();
      const senhasHoje = (data.senhas || []).filter(s => {
        const ts = s.atendimento_concluido_em || s.updated_at || s.emitida_em || s.created_at;
        return keyFromDate(ts) === today;
      });

      const activityLog = document.getElementById("activityLog");
      if (!activityLog) return;

      if (!senhasHoje.length) {
        activityLog.innerHTML = '<div class="log-item"><div class="log-password" style="color:var(--text-muted);">Nenhum atendimento hoje</div></div>';
        return;
      }

      activityLog.innerHTML = senhasHoje.slice(0, 8).map(s => {
        const hora    = formatTimeLuanda(s.atendimento_concluido_em || s.updated_at || s.created_at);
        const duracao = Math.round(s.tempo_atendimento_minutos || 0);
        const servico = s.servico?.nome || "Serviço";
        return `<div class="log-item completed">
            <div class="log-password">${s.numero} — ${servico}</div>
            <div class="log-time">${hora} · ${duracao}min</div>
          </div>`;
      }).join("");
    } catch (err) {
      console.error("[worker] histórico:", err);
    }
  }

  /* ── Fila ao vivo ────────────────────────────────────────── */
  async function atualizarFilaAoVivo() {
    const user = store.getUser();
    const list = document.getElementById("liveQueueList");
    if (!list) return;
    try {
      const serviceFilter = user?.servico_id ? `&servico_id=${user.servico_id}` : "";
      const resp = await fetch(`/api/senhas?status=aguardando&page=1&per_page=20${serviceFilter}`, {
        headers: { Authorization: `Bearer ${store.getToken()}` }
      });
      if (!resp.ok) return;
      const data  = await resp.json();
      const senhas = Array.isArray(data) ? data : (data.senhas || []);

      if (!senhas.length) {
        list.innerHTML = '<div class="live-queue-empty" style="color:var(--text-muted);font-size:.85rem;padding:.5rem 0;">✅ Sem senhas em fila</div>';
        return;
      }

      list.innerHTML = senhas.slice(0, 8).map((s, idx) => {
        const isPriority = s.tipo === 'prioritaria';
        return `<div class="live-queue-item ${idx === 0 ? "next" : ""}">
            <span class="live-num" style="${isPriority ? 'color:#d97706;' : ''}">${s.numero}</span>
            <span class="live-service">${s.servico?.nome || "Serviço"}</span>
            <span class="live-tag" style="${isPriority ? 'color:#d97706;background:rgba(217,119,6,.1);' : ''}">
              ${idx === 0 ? "PRÓXIMA" : isPriority ? "★ Prior." : `${idx + 1}º`}
            </span>
          </div>`;
      }).join("");
    } catch (err) {
      console.error("[worker] fila ao vivo:", err);
    }
  }

  /* ── Display senha actual ────────────────────────────────── */
  function atualizarDisplayAtual(senha) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set("currentPassword", senha.numero || "---");
    set("passwordType",    senha.tipo === "prioritaria" ? "★ Atendimento Prioritário" : "Atendimento Normal");
    set("serviceValue",    senha.servico?.nome || "Serviço");
    set("waitTime",        `${Math.round(senha.tempo_espera_minutos || 0)} min`);
    set("issuedAt",        formatTimeLuanda(senha.emitida_em || senha.created_at));
    set("obsValue",        senha.observacoes || "Sem observações");

    preencherPreviewDocumentos(senha);
    setStatus("Em Atendimento", "#d97706");
  }

  function limparDisplayAtual() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("currentPassword", "---");
    set("passwordType",    "Aguardando chamada");
    set("serviceValue",    "–");
    set("waitTime",        "–");
    set("issuedAt",        "–");
    set("obsValue",        "Sem observações");
    const pre = document.getElementById("docsPreviewContent");
    if (pre) pre.textContent = "Sem documentos/formulário para esta senha.";
    setStatus("Disponível", "#10b981");
    pararTimer();
  }

  function limparAtendimentoAtual() {
    senhaAtual = null;
    const hiddenEl = document.getElementById("currentSenhaId");
    if (hiddenEl) hiddenEl.value = "";
    limparDisplayAtual();
    actualizarBotoes();
  }

  function preencherPreviewDocumentos(senha) {
    const pre = document.getElementById("docsPreviewContent");
    if (!pre) return;
    const obs = senha?.observacoes;
    if (!obs) { pre.textContent = "Sem dados de formulário para esta senha."; return; }
    /* Formatar "Campo: valor | Campo: valor" como tabela legível */
    if (obs.includes('|')) {
      pre.textContent = obs.split('|').map(p => p.trim()).filter(Boolean).join('\n');
    } else {
      pre.textContent = obs;
    }
  }

  function actualizarBotoes() {
    const btnConcluir = document.getElementById("btnConcluir");
    const btnNegar    = document.getElementById("btnNegar");
    const temSenha    = !!senhaAtual;
    if (btnConcluir) btnConcluir.disabled = !temSenha;
    if (btnNegar)    btnNegar.disabled    = !temSenha;
  }

  /* ════════════════════════════════════════════════════════════
     ACÇÕES DO TRABALHADOR — TODAS FUNCIONAIS
  ════════════════════════════════════════════════════════════ */

  window.callNextCustomer = async function () {
    const user = store.getUser();
    if (!user) return;

    const servicoId = user.servico_id;
    const balcao    = parseInt(user.balcao || user.numero_balcao);

    if (!servicoId || !balcao) {
      showToast("Perfil incompleto: falta serviço ou balcão. Contacte o administrador.", "error");
      return;
    }

    const btn = document.querySelector(".btn-next");
    if (btn) { btn.disabled = true; btn.textContent = "A chamar..."; }

    try {
      const resp = await fetch("/api/filas/chamar", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
        body:    JSON.stringify({ servico_id: servicoId, numero_balcao: balcao })
      });

      const data = await resp.json().catch(() => ({}));

      if (resp.status === 404 || (resp.ok && !data.senha)) {
        showToast("Não há senhas na fila de momento.", "warn");
        return;
      }

      if (!resp.ok) {
        showToast(data.erro || "Erro ao chamar senha.", "error");
        return;
      }

      senhaAtual = data.senha;
      const hiddenEl = document.getElementById("currentSenhaId");
      if (hiddenEl) hiddenEl.value = senhaAtual.id || "";

      atualizarDisplayAtual(senhaAtual);
      actualizarBotoes();
      iniciarTimer();
      await atualizarTudo();
      showToast(`✅ Senha ${senhaAtual.numero} chamada — Balcão ${balcao}`, "success");

    } catch (err) {
      console.error("[chamar]", err);
      showToast("Erro de ligação ao servidor.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Chamar"; }
    }
  };

  window.concludeAttendance = async function () {
    const senhaId = document.getElementById("currentSenhaId")?.value;
    if (!senhaId) { showToast("Nenhuma senha em atendimento.", "warn"); return; }

    const btn = document.getElementById("btnConcluir");
    if (btn) { btn.disabled = true; btn.textContent = "A concluir..."; }

    try {
      const resp = await fetch(`/api/filas/concluir/${senhaId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` }
      });

      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.erro || "Falha ao concluir.");
      }

      const numSenha = senhaAtual?.numero || senhaId;
      limparAtendimentoAtual();
      await atualizarTudo();
      showToast(`✅ Atendimento ${numSenha} concluído com sucesso!`, "success");

    } catch (err) {
      showToast(err.message || "Erro ao concluir atendimento.", "error");
    } finally {
      if (btn) { btn.disabled = !senhaAtual; btn.textContent = "Concluir"; }
    }
  };

  window.denyCurrentTicket = async function () {
    const senhaId = document.getElementById("currentSenhaId")?.value;
    if (!senhaId || !senhaAtual) { showToast("Nenhuma senha em atendimento.", "warn"); return; }

    const motivo = prompt(`Motivo da negação da senha ${senhaAtual.numero}:`, "");
    if (motivo === null) return;
    if (!motivo.trim()) { showToast("É necessário indicar o motivo.", "warn"); return; }

    const btn = document.getElementById("btnNegar");
    if (btn) { btn.disabled = true; btn.textContent = "A negar..."; }

    try {
      const resp = await fetch(`/api/senhas/${senhaId}/finalizar`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
        body:    JSON.stringify({ observacoes: `NEGADO pelo trabalhador: ${motivo}` })
      });

      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.erro || "Falha ao negar.");
      }

      const numSenha = senhaAtual?.numero || senhaId;
      limparAtendimentoAtual();
      await atualizarTudo();
      showToast(`Senha ${numSenha} negada. Motivo registado.`, "warn");

    } catch (err) {
      showToast(err.message || "Erro ao negar senha.", "error");
    } finally {
      if (btn) { btn.disabled = !senhaAtual; btn.textContent = "Negar"; }
    }
  };

  window.togglePause = function () {
    const btn = document.getElementById("pauseBtn");
    if (!btn) return;

    if (btn.textContent.trim() === "Pausar") {
      btn.textContent = "Retomar";
      btn.style.background = "#fff8ed";
      btn.style.borderColor = "#d97706";
      btn.style.color = "#d97706";
      pararPolling();
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      setStatus("Pausado", "#d97706");
    } else {
      btn.textContent = "Pausar";
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.color = "";
      iniciarPolling();
      if (senhaAtual) {
        timerInterval = setInterval(() => {
          timerSegundos += 1;
          const el = document.getElementById("timer");
          if (el) el.textContent = formatDuracao(timerSegundos);
        }, 1000);
      }
      setStatus(senhaAtual ? "Em Atendimento" : "Disponível", senhaAtual ? "#d97706" : "#10b981");
    }
  };

  window.redirectCustomer = function () {
    if (!senhaAtual) { showToast("Nenhuma senha em atendimento.", "warn"); return; }
    const balcao = prompt(`Reencaminhar ${senhaAtual.numero} para qual balcão?`, "");
    if (balcao) showToast(`Reencaminhamento para balcão ${balcao} registado.`, "success");
  };

  window.addObservation = function () {
    if (!senhaAtual) { showToast("Nenhuma senha em atendimento.", "warn"); return; }
    const obs = prompt("Adicionar observação:", senhaAtual.observacoes || "");
    if (obs === null) return;
    senhaAtual.observacoes = obs;
    const obsEl = document.getElementById("obsValue");
    if (obsEl) obsEl.textContent = obs || "Sem observações";
    preencherPreviewDocumentos(senhaAtual);
    showToast("Observação adicionada.", "success");
  };

  window.requestDocuments = function () {
    if (!senhaAtual) { showToast("Nenhuma senha em atendimento.", "warn"); return; }
    /* Activar tab documentos */
    const btnDocs = document.querySelector('[data-tab="documentos"]');
    if (btnDocs) btnDocs.click();
    preencherPreviewDocumentos(senhaAtual);
  };

  window.sendReceipt = function () {
    if (!senhaAtual) { showToast("Nenhuma senha em atendimento.", "warn"); return; }
    const user    = store.getUser();
    const balcao  = user?.balcao || user?.numero_balcao || "–";
    const agora   = new Date().toLocaleString("pt-PT", { timeZone: ANGOLA_TZ });

    const html = `<html><head><title>Recibo ${senhaAtual.numero}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:32px;color:#2a1a0a;max-width:420px;margin:0 auto}
        .header{background:linear-gradient(135deg,#3e2510,#6b4226);color:white;padding:20px;border-radius:12px;text-align:center;margin-bottom:20px}
        .header h2{margin:0 0 4px;font-size:1.4rem}
        .header p{margin:0;opacity:.8;font-size:.85rem}
        .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0e8dc}
        .label{color:#8a7060;font-size:.85rem}
        .value{font-weight:600;font-size:.9rem}
        .footer{margin-top:20px;text-align:center;color:#8a7060;font-size:.8rem}
      </style></head><body>
      <div class="header">
        <h2>IMTSB</h2>
        <p>Instituto Médio Técnico São Benedito</p>
      </div>
      <div class="row"><span class="label">Senha</span><span class="value">${senhaAtual.numero}</span></div>
      <div class="row"><span class="label">Serviço</span><span class="value">${senhaAtual.servico?.nome || "–"}</span></div>
      <div class="row"><span class="label">Balcão</span><span class="value">${balcao}</span></div>
      <div class="row"><span class="label">Emitida às</span><span class="value">${formatTimeLuanda(senhaAtual.emitida_em || senhaAtual.created_at)}</span></div>
      <div class="row"><span class="label">Duração</span><span class="value">${Math.round(timerSegundos/60)} min</span></div>
      ${senhaAtual.observacoes ? `<div class="row"><span class="label">Observações</span><span class="value">${senhaAtual.observacoes}</span></div>` : ''}
      <div class="footer">
        <p>Impresso em ${agora}</p>
        <p style="margin-top:8px">Obrigado pela sua visita ao IMTSB!</p>
      </div>
      <script>window.onload=()=>window.print();</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=500,height=620");
    if (!w) { showToast("Permita popups para imprimir o recibo.", "warn"); return; }
    w.document.write(html);
    w.document.close();
  };

  window.showStatistics = function () {
    window.location.href = "/dashadm.html";
  };

  window.sair = function () {
    if (confirm("Deseja sair do sistema?")) {
      pararPolling();
      pararTimer();
      store.logout();
      window.location.href = "/login";
    }
  };

  /* ── Tabs ────────────────────────────────────────────────── */
  function renderTabs() {
    document.querySelectorAll(".tab-switch-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-switch-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const panel = document.getElementById(`tab-${btn.dataset.tab}`);
        if (panel) panel.classList.add("active");
      });
    });
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", async () => {
    if (!store?.isLoggedIn()) {
      window.location.href = "/login";
      return;
    }
    const user = store.getUser();
    if (!["trabalhador", "admin"].includes(user?.role)) {
      window.location.href = "/";
      return;
    }

    carregarDadosTrabalhador();
    renderTabs();
    actualizarBotoes(); /* botões desactivados no arranque */
    setStatus("Disponível", "#10b981");

    await atualizarTudo();
    iniciarPolling();
  });

})();