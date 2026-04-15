/**
 * static/js/dash.js — v4 COMPLETO
 * Controlos: chamar, concluir, negar, observações, ver pedido, recibo, fila ao vivo
 */
(function () {
  "use strict";

  const store = window.IMTSBStore;
  let senhaAtual = null, timerInterval = null, pollingInterval = null, queueInterval = null;
  let reciboData = null; // guardado para download

  // ── Init ─────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    if (!store.isLoggedIn()) { window.location.href = "/login-staff.html"; return; }
    const user = store.getUser();
    if (user.role !== "trabalhador" && user.role !== "admin") {
      alert("Acesso negado."); window.location.href = "/"; return;
    }
    await carregarHeader();
    await injectSelectorServico();
    await atualizarEstatisticas();
    await atualizarHistorico();
    await atualizarFilaAoVivo();
    iniciarPollings();
    actualizarBotoes();
  });

  // ── Header ───────────────────────────────────────────────
  async function carregarHeader() {
    const u = store.getUser();
    const g = id => document.getElementById(id);
    if (g("workerName"))   g("workerName").textContent   = u.name || "Trabalhador";
    if (g("workerDept"))   g("workerDept").textContent   = u.departamento || "Atendimento";
    if (g("workerAvatar")) g("workerAvatar").textContent =
      (u.name || "T").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
    if (g("counterBadge")) {
      const b = parseInt(u.balcao || u.numero_balcao) || null;
      g("counterBadge").textContent = b ? `Balcão ${b}` : "Sem balcão";
    }
  }

  // ── Selector de serviço ──────────────────────────────────
  async function injectSelectorServico() {
    if (document.getElementById("servicoSelectorWrapper")) return;
    let servicos = [];
    try { const r = await fetch("/api/servicos/"); if (r.ok) servicos = await r.json(); } catch (_) {}
    if (!servicos.length) return;
    const container = document.querySelector(".action-buttons");
    if (!container) return;
    const u       = store.getUser();
    const wrapper = document.createElement("div");
    wrapper.id    = "servicoSelectorWrapper";
    wrapper.innerHTML = `
      <label>Serviço a atender</label>
      <select id="servicoSelector">
        <option value="">— Seleccione o serviço —</option>
        ${servicos.map(s => `<option value="${s.id}" ${s.id == (u.servico_id||"") ? "selected" : ""}>${s.icone||"📋"} ${s.nome}</option>`).join("")}
      </select>`;
    container.parentNode.insertBefore(wrapper, container);
  }

  function getServicoId() {
    const u = store.getUser();
    const sel = document.getElementById("servicoSelector");
    return u.servico_id || (sel ? parseInt(sel.value) || null : null);
  }

  function getBalcao() {
    const u = store.getUser();
    return parseInt(u.balcao || u.numero_balcao) || null;
  }

  // ── CHAMAR ───────────────────────────────────────────────
  window.callNextCustomer = async function () {
    const svcId  = getServicoId();
    const balcao = getBalcao();
    const btn    = document.querySelector(".btn-next");
    if (!svcId)  { alert("Seleccione um serviço."); return; }
    if (!balcao) { alert("Sem balcão configurado. Contacte o administrador."); return; }
    if (btn) { btn.disabled = true; btn.querySelector(".btn-icon").textContent = "⏳"; }
    try {
      const result = await store.callNext(svcId, balcao);
      if (result.ok && result.senha) {
        senhaAtual = result.senha;
        const c = document.getElementById("currentSenhaId");
        if (c) c.value = senhaAtual.id || "";
        atualizarDisplayAtual(senhaAtual);
        actualizarBotoes();
        pararTimer(); iniciarTimer();
        await atualizarHistorico();
        await atualizarEstatisticas();
        await atualizarFilaAoVivo();
      } else {
        alert(result.message || "Não há senhas a aguardar para este serviço.");
      }
    } catch (e) { alert("Erro ao chamar senha."); }
    finally {
      if (btn) { btn.disabled = false; btn.querySelector(".btn-icon").textContent = "🔔"; }
    }
  };

  // ── CONCLUIR ─────────────────────────────────────────────
  window.concludeAttendance = async function () {
    const c   = document.getElementById("currentSenhaId");
    const sid = c ? c.value : null;
    const btn = document.getElementById("btnConcluir");
    if (!sid) { alert("Nenhuma senha em atendimento."); return; }
    if (!confirm(`Confirmar conclusão da senha ${senhaAtual?.numero || sid}?`)) return;
    if (btn) { btn.disabled = true; btn.querySelector(".btn-icon").textContent = "⏳"; }
    try {
      const resp = await fetch(`/api/filas/concluir/${sid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${store.getToken()}` }
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        // Gerar recibo antes de limpar
        gerarRecibo(senhaAtual);
        senhaAtual = null;
        if (c) c.value = "";
        limparDisplay(); pararTimer(); actualizarBotoes();
        await atualizarHistorico(); await atualizarEstatisticas(); await atualizarFilaAoVivo();
      } else {
        alert(`Erro: ${data.erro || data.message || "Não foi possível concluir"}`);
      }
    } catch (e) { alert("Erro de ligação."); }
    finally {
      if (btn) { btn.disabled = false; btn.querySelector(".btn-icon").textContent = "✅"; }
    }
  };

  // ── NEGAR SENHA ──────────────────────────────────────────
  window.openDenyModal = function () {
    if (!senhaAtual) { alert("Nenhuma senha em atendimento."); return; }
    const inp = document.getElementById("denyReason");
    if (inp) inp.value = "";
    openModal("modalNegar");
  };

  window.confirmDeny = async function () {
    const motivo = (document.getElementById("denyReason")?.value || "").trim();
    if (!motivo) { alert("Explique o motivo da negação."); return; }
    const sid = document.getElementById("currentSenhaId")?.value;
    if (!sid) { closeModal("modalNegar"); return; }
    try {
      const resp = await fetch(`/api/senhas/${sid}/cancelar`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${store.getToken()}` },
        body: JSON.stringify({ motivo: `NEGADO: ${motivo}` })
      });
      if (resp.ok) {
        closeModal("modalNegar");
        senhaAtual = null;
        document.getElementById("currentSenhaId").value = "";
        limparDisplay(); pararTimer(); actualizarBotoes();
        await atualizarHistorico(); await atualizarEstatisticas(); await atualizarFilaAoVivo();
      } else {
        const d = await resp.json().catch(() => ({}));
        alert(d.erro || "Erro ao negar senha.");
      }
    } catch (e) { alert("Erro de ligação."); }
  };

  // ── OBSERVAÇÕES ──────────────────────────────────────────
  window.openObsModal = function () {
    if (!senhaAtual) { alert("Nenhuma senha em atendimento."); return; }
    const inp = document.getElementById("obsInput");
    if (inp) inp.value = senhaAtual.observacoes || "";
    openModal("modalObs");
  };

  window.saveObs = async function () {
    const obs = (document.getElementById("obsInput")?.value || "").trim();
    const sid = document.getElementById("currentSenhaId")?.value;
    if (!sid) { closeModal("modalObs"); return; }
    try {
      const resp = await fetch(`/api/senhas/${sid}/finalizar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${store.getToken()}` },
        body: JSON.stringify({ observacoes: obs })
      });
      if (resp.ok && senhaAtual) {
        senhaAtual.observacoes = obs;
        atualizarDisplayAtual(senhaAtual);
      }
    } catch (_) {}
    closeModal("modalObs");
  };

  // ── VER PEDIDO / DOCUMENTOS ──────────────────────────────
  window.openDocsModal = function () {
    const content = document.getElementById("docsContent");
    if (!content) return;

    if (!senhaAtual) {
      content.textContent = "Nenhuma senha em atendimento.";
      openModal("modalDocs"); return;
    }

    // Formatar observações do formulário para leitura
    const obs = senhaAtual.observacoes || "";
    const linhas = obs.split(" | ");
    const formatted = linhas.length > 1
      ? linhas.map(l => {
          const [k, ...v] = l.split(": ");
          return v.length ? `${k}\n  → ${v.join(": ")}` : l;
        }).join("\n\n")
      : (obs || "Sem informações registadas pelo cliente.");

    content.textContent = formatted;

    // Info extra
    if (senhaAtual.usuario_contato) {
      content.textContent += `\n\nContacto: ${senhaAtual.usuario_contato}`;
    }
    openModal("modalDocs");
  };

  // ── RECIBO ───────────────────────────────────────────────
  function gerarRecibo(s) {
    if (!s) return;
    const u = store.getUser();
    const agora = new Date().toLocaleString("pt-PT");
    const linhas = [
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "  INSTITUTO MÉDIO TÉCNICO SÃO BENEDITO",
      "       Recibo de Atendimento",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      `Senha         : ${s.numero}`,
      `Serviço       : ${s.servico?.nome || "—"}`,
      `Tipo          : ${s.tipo === "prioritaria" ? "Prioritária" : "Normal"}`,
      `Atendido por  : ${u.name} (Balcão ${getBalcao() || "—"})`,
      `Emitida em    : ${s.emitida_em ? new Date(s.emitida_em).toLocaleString("pt-PT") : "—"}`,
      `Concluída em  : ${agora}`,
      `Espera        : ${s.tempo_espera_minutos || 0} minutos`,
      "─────────────────────────────────────",
    ];
    if (s.observacoes) {
      linhas.push(`Notas         : ${s.observacoes}`);
      linhas.push("─────────────────────────────────────");
    }
    linhas.push("  Obrigado pela sua visita ao IMTSB!");
    linhas.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    reciboData = { texto: linhas.join("\n"), numero: s.numero };
  }

  window.sendReceipt = function () {
    if (!senhaAtual) { alert("Nenhuma senha em atendimento."); return; }
    gerarRecibo(senhaAtual);
    const content = document.getElementById("reciboContent");
    if (content && reciboData) content.textContent = reciboData.texto;
    openModal("modalRecibo");
  };

  window.downloadRecibo = function () {
    if (!reciboData) return;
    const blob = new Blob([reciboData.texto], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `recibo_${reciboData.numero}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    closeModal("modalRecibo");
  };

  // ── FILA AO VIVO ─────────────────────────────────────────
  async function atualizarFilaAoVivo() {
    const svcId = getServicoId();
    if (!svcId) return;
    try {
      const resp = await fetch(`/api/senhas?status=aguardando&servico_id=${svcId}&per_page=20`,
        { headers: { "Authorization": `Bearer ${store.getToken()}` } });
      if (!resp.ok) return;
      const { senhas = [] } = await resp.json();
      const list = document.getElementById("queueLiveList");
      if (!list) return;
      if (!senhas.length) {
        list.innerHTML = `<p style="font-size:.8rem;color:var(--text-muted);text-align:center;padding:.5rem 0">Fila vazia</p>`;
        return;
      }
      list.innerHTML = senhas.map((s, i) => `
        <div class="q-item ${i===0 ? "minha" : s.tipo === "prioritaria" ? "prior" : "normal"}">
          <div>
            <div class="q-num">${s.numero}</div>
            <div class="q-info">${s.servico?.nome || ""} · pos. ${i+1}</div>
          </div>
          <span class="q-badge ${s.tipo === "prioritaria" ? "p" : "n"}">
            ${s.tipo === "prioritaria" ? "PRIOR" : "NORMAL"}
          </span>
        </div>`).join("");
    } catch (e) { console.error("❌ fila ao vivo:", e); }
  }

  // ── Estatísticas ─────────────────────────────────────────
  async function atualizarEstatisticas() {
    try {
      const resp = await fetch("/api/dashboard/trabalhador/estatisticas",
        { headers: { "Authorization": `Bearer ${store.getToken()}` } });
      if (resp.status === 401) { store.logout(); return; }
      if (!resp.ok) return;
      const s = await resp.json();
      const g = id => document.getElementById(id);
      if (g("waitingCount")) g("waitingCount").textContent = s.aguardando || "0";
      if (g("servedToday"))  g("servedToday").textContent  = s.atendidos_hoje || "0";
      if (g("avgTime"))      g("avgTime").textContent      = `~${s.tempo_medio_atendimento || 0}min`;
    } catch (e) { console.error("❌ stats:", e); }
  }

  // ── Histórico ─────────────────────────────────────────────
  async function atualizarHistorico() {
    try {
      const u = store.getUser();
      const resp = await fetch(
        `/api/senhas?atendente_id=${u.id}&status=concluida&page=1&per_page=8`,
        { headers: { "Authorization": `Bearer ${store.getToken()}` } });
      if (!resp.ok) return;
      const { senhas = [] } = await resp.json();
      const log = document.getElementById("activityLog");
      if (!log) return;
      if (!senhas.length) {
        log.innerHTML = `<div class="log-item"><div class="log-password">Sem atendimentos hoje</div></div>`;
        return;
      }
      log.innerHTML = senhas.map(s => {
        const ts = s.atendimento_concluido_em || s.created_at;
        const h  = ts ? new Date(ts).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"}) : "--:--";
        const negado = (s.observacoes || "").startsWith("NEGADO:");
        return `<div class="log-item ${negado ? "" : "completed"}" style="${negado ? "border-left-color:#ef4444" : ""}">
          <div class="log-password">${s.numero}${negado ? " ❌" : " ✓"}${s.servico ? " · "+s.servico.nome : ""}</div>
          <div class="log-time">${h} · ${s.tempo_atendimento_minutos||0}min</div>
        </div>`;
      }).join("");
    } catch (e) { console.error("❌ histórico:", e); }
  }

  // ── Display ───────────────────────────────────────────────
  function atualizarDisplayAtual(s) {
    const g = id => document.getElementById(id);
    if (g("currentPassword")) g("currentPassword").textContent = s.numero;
    if (g("passwordType"))    g("passwordType").textContent    = s.tipo === "prioritaria" ? "⭐ Prioritário" : "Normal";
    if (g("serviceValue"))    g("serviceValue").textContent    = s.servico?.nome || "Geral";
    if (g("waitTime"))        g("waitTime").textContent        = `${s.tempo_espera_minutos || 0} min`;
    if (g("issuedAt") && s.emitida_em)
      g("issuedAt").textContent = new Date(s.emitida_em).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"});
    if (g("contactoValue"))   g("contactoValue").textContent   = s.usuario_contato || "—";
    if (g("statusText"))      g("statusText").textContent      = "Em Atendimento";

    // Mostrar info do pedido se existir
    const obsRow = g("obsRow");
    const obsEl  = g("obsValue");
    if (s.observacoes && obsRow && obsEl) {
      // Pegar só a primeira linha resumida
      const resumo = s.observacoes.split("|").slice(0,2).join(" | ");
      obsEl.textContent = resumo;
      obsRow.style.display = "flex";
    }
  }

  function limparDisplay() {
    [["currentPassword","---"],["passwordType","Aguardando chamada"],
     ["serviceValue","—"],["waitTime","—"],["issuedAt","—"],
     ["contactoValue","—"],["statusText","Disponível"]
    ].forEach(([id,v]) => { const e = document.getElementById(id); if (e) e.textContent = v; });
    const ob = document.getElementById("obsRow");
    if (ob) ob.style.display = "none";
    const t = document.getElementById("timer");
    if (t) t.textContent = "00:00";
  }

  function actualizarBotoes() {
    const temSenha = senhaAtual !== null;
    ["btnConcluir","btnNegar"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.disabled = !temSenha;
    });
  }

  // ── Timer ────────────────────────────────────────────────
  function iniciarTimer() {
    pararTimer(); let s = 0;
    timerInterval = setInterval(() => {
      s++;
      const el = document.getElementById("timer");
      if (el) el.textContent = `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
    }, 1000);
  }
  function pararTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

  // ── Pollings ─────────────────────────────────────────────
  function iniciarPollings() {
    pararPollings();
    pollingInterval = setInterval(atualizarEstatisticas, 10000);
    queueInterval   = setInterval(atualizarFilaAoVivo,   8000);
  }
  function pararPollings() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    if (queueInterval)   { clearInterval(queueInterval);   queueInterval = null; }
  }

  // ── Modal helpers ────────────────────────────────────────
  window.openModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.classList.add("open");
  };
  window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove("open");
  };

  // Fechar modal ao clicar fora
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("modal-overlay")) {
      e.target.classList.remove("open");
    }
  });

  // ── Funções globais ──────────────────────────────────────
  window.togglePause = function () {
    const btn = document.getElementById("pauseBtn");
    if (!btn) return;
    if (btn.textContent.trim() === "Retomar") { iniciarPollings(); btn.textContent = "Pausar"; }
    else { pararPollings(); btn.textContent = "Retomar"; }
  };

  window.showStatistics = function () { window.location.href = "/dashadm.html"; };

  window.sair = function () {
    if (confirm("Sair do sistema?")) { pararPollings(); pararTimer(); store.logout(); }
  };

})();