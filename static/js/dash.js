(function () {
  "use strict";

  const store = window.IMTSBStore;
  const ANGOLA_TZ = "Africa/Luanda";

  let senhaAtual = null;
  let timerInterval = null;
  let pollingInterval = null;

  function nowKeyLuanda() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: ANGOLA_TZ }).format(new Date());
  }

  function keyFromDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-CA", { timeZone: ANGOLA_TZ }).format(new Date(value));
  }

  function formatTimeLuanda(value) {
    if (!value) return "--:--";
    return new Date(value).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ANGOLA_TZ,
    });
  }

  function setStatus(text, emAtendimento) {
    const statusText = document.getElementById("statusText");
    if (statusText) statusText.textContent = text;
    const statusDot = document.getElementById("statusDot");
    if (statusDot) statusDot.style.background = emAtendimento ? "#f59e0b" : "#10b981";
  }

  function renderTabs() {
    const btns = document.querySelectorAll(".tab-switch-btn");
    btns.forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-switch-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if (!store?.isLoggedIn()) {
      window.location.href = "/login";
      return;
    }

    const user = store.getUser();
    if (!["trabalhador", "admin"].includes(user.role)) {
      window.location.href = "/";
      return;
    }

    carregarDadosTrabalhador();
    renderTabs();
    await atualizarTudo();
    iniciarPolling();
    actualizarBotaoConcluir();
  });

  async function atualizarTudo() {
    await Promise.all([atualizarEstatisticas(), atualizarHistorico(), atualizarFilaAoVivo()]);
  }

  function carregarDadosTrabalhador() {
    const user = store.getUser();
    document.getElementById("workerName").textContent = user.name || "Trabalhador";
    document.getElementById("workerDept").textContent = user.departamento || "Atendimento";
    const iniciais = (user.name || "T")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    document.getElementById("workerAvatar").textContent = iniciais;
    const balcao = user.balcao || user.numero_balcao;
    document.getElementById("counterBadge").textContent = balcao ? `Balcão ${balcao}` : "Sem balcão";
  }

  async function atualizarEstatisticas() {
    try {
      const response = await fetch("/api/dashboard/trabalhador/estatisticas", {
        headers: { Authorization: `Bearer ${store.getToken()}` },
      });
      if (!response.ok) return;
      const stats = await response.json();
      document.getElementById("waitingCount").textContent = stats.aguardando || 0;
      document.getElementById("servedToday").textContent = stats.atendidos_hoje || 0;
      document.getElementById("avgTime").textContent = `${Math.round(stats.tempo_medio_atendimento || 0)}m`;
    } catch (err) {
      console.error("[worker] estatísticas", err);
    }
  }

  async function atualizarHistorico() {
    try {
      const user = store.getUser();
      const response = await fetch(`/api/senhas?atendente_id=${user.id}&status=concluida&page=1&per_page=25`, {
        headers: { Authorization: `Bearer ${store.getToken()}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const today = nowKeyLuanda();
      const senhasHoje = (data.senhas || []).filter((s) => {
        const ts = s.atendimento_concluido_em || s.updated_at || s.emitida_em || s.created_at;
        return keyFromDate(ts) === today;
      });

      const activityLog = document.getElementById("activityLog");
      if (!activityLog) return;
      if (!senhasHoje.length) {
        activityLog.innerHTML = '<div class="log-item"><div class="log-password">Nenhum atendimento hoje</div></div>';
        return;
      }

      activityLog.innerHTML = senhasHoje
        .map((senha) => {
          const hora = formatTimeLuanda(senha.atendimento_concluido_em || senha.updated_at || senha.created_at);
          const duracao = Math.round(senha.tempo_atendimento_minutos || 0);
          const servico = senha.servico?.nome || "Serviço";
          return `<div class="log-item completed">
            <div class="log-password">${senha.numero} — ${servico}</div>
            <div class="log-time">${hora} · ${duracao}m</div>
          </div>`;
        })
        .join("");
    } catch (err) {
      console.error("[worker] histórico", err);
    }
  }

  async function atualizarFilaAoVivo() {
    const user = store.getUser();
    const list = document.getElementById("liveQueueList");
    if (!list) return;
    try {
      const serviceFilter = user.servico_id ? `&servico_id=${user.servico_id}` : "";
      const response = await fetch(`/api/senhas?status=aguardando&page=1&per_page=20${serviceFilter}`, {
        headers: { Authorization: `Bearer ${store.getToken()}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const senhas = Array.isArray(data) ? data : (data.senhas || []);

      if (!senhas.length) {
        list.innerHTML = '<div class="live-queue-empty">Sem senhas em fila.</div>';
        return;
      }

      list.innerHTML = senhas
        .slice(0, 8)
        .map((s, idx) => `<div class="live-queue-item ${idx === 0 ? "next" : ""}">
            <span class="live-num">${s.numero}</span>
            <span class="live-service">${s.servico?.nome || "Serviço"}</span>
            <span class="live-tag">${idx === 0 ? "PRÓXIMA" : `${idx + 1}º`}</span>
          </div>`)
        .join("");
    } catch (err) {
      console.error("[worker] fila ao vivo", err);
    }
  }

  window.callNextCustomer = async function () {
    const user = store.getUser();
    const servicoId = user.servico_id;
    const balcao = user.balcao || user.numero_balcao;

    if (!servicoId || !balcao) {
      alert("Perfil incompleto: falta serviço ou balcão. Contacte o administrador.");
      return;
    }

    const btn = document.querySelector(".btn-next");
    if (btn) { btn.disabled = true; btn.textContent = "A chamar..."; }

    try {
      const result = await store.callNext(servicoId, balcao);
      if (!result.ok || !result.senha) {
        alert(result.message || "Nenhuma senha disponível.");
        return;
      }
      senhaAtual = result.senha;
      document.getElementById("currentSenhaId").value = senhaAtual.id || "";
      atualizarDisplayAtual(senhaAtual);
      actualizarBotaoConcluir();
      iniciarTimer();
      setStatus("Em Atendimento", true);
      await atualizarTudo();
    } catch (err) {
      console.error(err);
      alert("Erro ao chamar próxima senha.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Chamar"; }
    }
  };

  window.concludeAttendance = async function () {
    const senhaId = document.getElementById("currentSenhaId")?.value;
    if (!senhaId) return alert("Nenhuma senha em atendimento.");

    const btn = document.getElementById("btnConcluir");
    if (btn) { btn.disabled = true; btn.textContent = "A concluir..."; }

    try {
      const response = await fetch(`/api/filas/concluir/${senhaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
      });
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.erro || "Falha ao concluir.");
      }
      limparAtendimentoAtual();
      await atualizarTudo();
    } catch (err) {
      alert(err.message || "Erro ao concluir atendimento.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Concluir"; }
    }
  };

  window.denyCurrentTicket = async function () {
    const senhaId = document.getElementById("currentSenhaId")?.value;
    if (!senhaId || !senhaAtual) return alert("Nenhuma senha em atendimento.");
    const motivo = prompt("Motivo da negação (obrigatório):");
    if (!motivo) return;

    try {
      const response = await fetch(`/api/senhas/${senhaId}/finalizar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
        body: JSON.stringify({ observacoes: `NEGADO pelo trabalhador: ${motivo}` }),
      });
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d.erro || "Falha ao negar.");
      }
      limparAtendimentoAtual();
      await atualizarTudo();
      alert("Senha negada e finalizada com sucesso.");
    } catch (err) {
      alert(err.message || "Erro ao negar senha.");
    }
  };

  function atualizarDisplayAtual(senha) {
    document.getElementById("currentPassword").textContent = senha.numero || "---";
    document.getElementById("passwordType").textContent = senha.tipo === "prioritaria" ? "Atendimento Prioritário" : "Atendimento Normal";
    document.getElementById("serviceValue").textContent = senha.servico?.nome || "Serviço";
    document.getElementById("waitTime").textContent = `${Math.round(senha.tempo_espera_minutos || 0)} min`;
    document.getElementById("issuedAt").textContent = formatTimeLuanda(senha.emitida_em || senha.created_at);
    document.getElementById("obsValue").textContent = senha.observacoes || "Sem observações";
    preencherPreviewDocumentos(senha);
  }

  function preencherPreviewDocumentos(senha) {
    const pre = document.getElementById("docsPreviewContent");
    if (!pre) return;
    const dados = senha?.formulario_dados || senha?.dados_formulario || senha?.documentos || senha?.anexos || null;
    if (!dados) {
      pre.textContent = "Sem documentos/formulário para esta senha.";
      return;
    }
    if (typeof dados === "string") {
      pre.textContent = dados;
      return;
    }
    pre.textContent = JSON.stringify(dados, null, 2);
  }

  function limparDisplayAtual() {
    document.getElementById("currentPassword").textContent = "---";
    document.getElementById("passwordType").textContent = "Aguardando chamada";
    document.getElementById("serviceValue").textContent = "-";
    document.getElementById("waitTime").textContent = "-";
    document.getElementById("issuedAt").textContent = "-";
    document.getElementById("obsValue").textContent = "Sem observações";
    document.getElementById("docsPreviewContent").textContent = "Sem documentos/formulário para esta senha.";
    document.getElementById("timer").textContent = "00:00";
    setStatus("Disponível", false);
  }

  function limparAtendimentoAtual() {
    senhaAtual = null;
    document.getElementById("currentSenhaId").value = "";
    pararTimer();
    limparDisplayAtual();
    actualizarBotaoConcluir();
  }

  function actualizarBotaoConcluir() {
    const btn = document.getElementById("btnConcluir");
    if (!btn) return;
    btn.disabled = !senhaAtual;
  }

  function iniciarTimer() {
    pararTimer();
    let segundos = 0;
    timerInterval = setInterval(() => {
      segundos += 1;
      const m = String(Math.floor(segundos / 60)).padStart(2, "0");
      const s = String(segundos % 60).padStart(2, "0");
      document.getElementById("timer").textContent = `${m}:${s}`;
    }, 1000);
  }

  function pararTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function iniciarPolling() {
    pararPolling();
    pollingInterval = setInterval(async () => {
      await atualizarTudo();
    }, 7000);
  }

  function actualizarBotoes() {
    const temSenha = senhaAtual !== null;
    ["btnConcluir","btnNegar"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.disabled = !temSenha;
    });
  }

  window.togglePause = function () {
    const btn = document.getElementById("pauseBtn");
    if (!btn) return;
    const pausado = btn.textContent.trim() === "Retomar";
    if (pausado) {
      btn.textContent = "Pausar";
      iniciarPolling();
      if (senhaAtual) iniciarTimer();
    } else {
      btn.textContent = "Retomar";
      pararPolling();
      pararTimer();
    }
  };

  window.redirectCustomer = function () {
    if (!senhaAtual) return alert("Nenhuma senha em atendimento.");
    const novoBalcao = prompt(`Reencaminhar ${senhaAtual.numero} para qual balcão?`);
    if (novoBalcao) alert(`Reencaminhamento registado para balcão ${novoBalcao}.`);
  };

  window.addObservation = function () {
    if (!senhaAtual) return alert("Nenhuma senha em atendimento.");
    const obs = prompt("Adicionar observação ao atendimento:", senhaAtual.observacoes || "");
    if (!obs) return;
    senhaAtual.observacoes = obs;
    document.getElementById("obsValue").textContent = obs;
    preencherPreviewDocumentos(senhaAtual);
  };

  window.requestDocuments = function () {
    if (!senhaAtual) return alert("Nenhuma senha em atendimento.");
    document.querySelector('[data-tab="documentos"]')?.click();
    preencherPreviewDocumentos(senhaAtual);
  };

  window.sendReceipt = function () {
    if (!senhaAtual) return alert("Nenhuma senha em atendimento para recibo.");
    const html = `
      <html><head><title>Recibo ${senhaAtual.numero}</title>
      <style>body{font-family:Arial;padding:24px;color:#222} h2{margin:0 0 16px 0} .line{margin:8px 0}</style>
      </head><body>
      <h2>Recibo de Atendimento — IMTSB</h2>
      <div class="line"><strong>Senha:</strong> ${senhaAtual.numero}</div>
      <div class="line"><strong>Serviço:</strong> ${senhaAtual.servico?.nome || "Serviço"}</div>
      <div class="line"><strong>Balcão:</strong> ${store.getUser().balcao || store.getUser().numero_balcao || "-"}</div>
      <div class="line"><strong>Emitida às:</strong> ${formatTimeLuanda(senhaAtual.emitida_em || senhaAtual.created_at)}</div>
      <div class="line"><strong>Observações:</strong> ${senhaAtual.observacoes || "Sem observações"}</div>
      <hr /><small>Documento para entrega ao utente.</small>
      <script>window.onload=()=>window.print();</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=760,height=600");
    if (!w) return;
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
})();
