/**
 * static/js/dash.js — Sprint 4 COMPLETO + FIX BASE URL
 * ═══════════════════════════════════════════════════════════════
 * FIX CRÍTICO APLICADO:
 *   ANTES: fetch("/api/filas/chamar", ...) — URL relativa FIXA
 *          → funciona em :5000 (Flask)
 *          → quebra em :5500 (Live Server) → ERR_CONNECTION_REFUSED
 *
 *   DEPOIS: fetch(`${BASE()}/filas/chamar`, ...)
 *          → lê window.IMTSBApiConfig.baseUrl (já resolvido por api-config.js)
 *          → funciona em :5000 ("/api/filas/chamar")
 *          → funciona em :5500 ("http://localhost:5000/api/filas/chamar")
 *          → funciona em qualquer IP da rede local
 *
 * TODAS as chamadas fetch() neste ficheiro foram actualizadas.
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store     = window.IMTSBStore;
  const N         = window.IMTSBNotifications;
  const ANGOLA_TZ = "Africa/Luanda";

  /* ── BASE URL dinâmica ────────────────────────────────────
     FIX: lê api-config.js que já resolve a URL correcta
     para qualquer porta/dispositivo.
  ──────────────────────────────────────────────────────── */
  const BASE = () => {
    const url = (window.IMTSBApiConfig?.baseUrl || '/api').replace(/\/$/, '');
    // Se for caminho relativo e não estiver na porta Flask, converte para absoluto
    if (url.startsWith('/') && window.location.port && window.location.port !== '5000') {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:5000${url}`;
    }
    return url;
  };

  /* ── Estado ──────────────────────────────────────────────── */
  let senhaAtual       = null;
  let timerInterval    = null;
  let pollingInterval  = null;
  let timerSegundos    = 0;
  let _servicosCache   = [];
  let _refreshBusy = false;
  let _refreshQueued = false;

  /* ── Formatadores ────────────────────────────────────────── */
  function nowKeyLuanda() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: ANGOLA_TZ }).format(new Date());
  }
  function keyFromDate(value) {
    if (!value) return "";
    const iso = (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+'))
      ? value + 'Z' : value;
    return new Intl.DateTimeFormat("en-CA", { timeZone: ANGOLA_TZ }).format(new Date(iso));
  }
  function formatTimeLuanda(value) {
    if (!value) return "--:--";
    const iso = (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+'))
      ? value + 'Z' : value;
    return new Date(iso).toLocaleTimeString("pt-PT", {
      hour: "2-digit", minute: "2-digit", timeZone: ANGOLA_TZ
    });
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

  /* ── Timer ───────────────────────────────────────────────── */
  function iniciarTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerSegundos = 0;
    const el = document.getElementById("timer");
    if (el) el.textContent = "00:00";
    timerInterval = setInterval(() => {
      timerSegundos += 1;
      const el = document.getElementById("timer");
      if (el) el.textContent = formatDuracao(timerSegundos);
    }, 1000);
  }

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

  function pararPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  }
// PR-6: refresh imediato pós-acção crítica
async function _refreshPosAccao(label) {

  // evita overlap destrutivo
  if (_refreshBusy) {
    _refreshQueued = true;
    return;
  }

  _refreshBusy = true;

  try {

    // reutiliza loaders já existentes
    await atualizarTudo();

    // sinal cross-tab para dashboards/admin
    try {

      const payload = JSON.stringify({
        tipo: label,
        ts: Date.now()
      });

      // evita spam idêntico
      if (localStorage.getItem('imtsb_accao') !== payload) {
        localStorage.setItem('imtsb_accao', payload);
      }

    } catch (_) {}

  } finally {

    _refreshBusy = false;

    // se houve refresh perdido durante busy
    if (_refreshQueued) {

      _refreshQueued = false;

      setTimeout(() => {
        _refreshPosAccao('queued');
      }, 150);
    }
  }
}

  /* ── Actualizar tudo ─────────────────────────────────────── */
  async function atualizarTudo() {
    await Promise.all([atualizarEstatisticas(), atualizarHistorico(), atualizarFilaAoVivo()]);
  }

  /* ── Cabeçalho do trabalhador ────────────────────────────── */
  function carregarDadosTrabalhador() {
    const user = store.getUser();
    if (!user) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("workerName",   user.name || "Trabalhador");
    set("workerDept",   user.departamento || "Atendimento");
    const iniciais = (user.name || "T").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    set("workerAvatar", iniciais);
    const balcao = user.balcao || user.numero_balcao;
    set("counterBadge", balcao ? `Balcão ${balcao}` : "Sem balcão");
  }

  /* ── Estatísticas ────────────────────────────────────────── */
  async function atualizarEstatisticas() {
    try {
      // FIX: usar BASE() em vez de "/api/" fixo
      const resp = await fetch(`${BASE()}/dashboard/trabalhador/estatisticas`, {
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
      // FIX: usar BASE()
      const resp = await fetch(
        `${BASE()}/senhas?atendente_id=${user.id}&status=concluida&page=1&per_page=25`,
        { headers: { Authorization: `Bearer ${store.getToken()}` } }
      );
      if (!resp.ok) return;
      const data      = await resp.json();
      const today     = nowKeyLuanda();
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
      // FIX: usar BASE()
      const resp = await fetch(
        `${BASE()}/senhas?status=aguardando&hoje=1&page=1&per_page=20${serviceFilter}`,
        { headers: { Authorization: `Bearer ${store.getToken()}` } }
      );
      if (!resp.ok) return;
      const data   = await resp.json();
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

  /* ── Preview de Documentos ───────────────────────────────── */
  function preencherPreviewDocumentos(senha) {
    const pre = document.getElementById("docsPreviewContent");
    if (!pre) return;
    const obs = senha?.observacoes;
    if (!obs) {
      pre.innerHTML = '<span style="color:#9ca3af;font-size:.85rem;">Sem dados de formulário para esta senha.</span>';
      return;
    }
    const partes       = obs.split(' | ').map(p => p.trim()).filter(Boolean);
    const nomeFicheiro = partes.find(p => p.startsWith('FICHEIRO:'))?.replace('FICHEIRO:', '').trim();
    const dadosForm    = partes.filter(p => !p.startsWith('FICHEIRO:'));
    let html = '';
    if (dadosForm.length) {
      html += '<div style="white-space:pre-wrap;font-size:.82rem;color:#3e2510;line-height:1.7;">';
      html += dadosForm.join('\n');
      html += '</div>';
    }
    if (nomeFicheiro) {
      const senhaId = senha.id;
      // FIX: usar BASE() para URL do ficheiro
      const fileUrl = `${BASE()}/senhas/${senhaId}/ficheiro`.replace('/api/api/', '/api/');
      html += `
        <div style="margin-top:.75rem;padding:.75rem;background:#eff6ff;border:1px solid #bfdbfe;
             border-radius:10px;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
          <span style="font-size:.8rem;color:#1d4ed8;font-weight:600;">
            📎 ${nomeFicheiro.split('_').slice(2).join('_') || nomeFicheiro}
          </span>
          <a href="${fileUrl}" target="_blank" download
             style="background:#2563eb;color:white;padding:.35rem .9rem;border-radius:8px;
                    font-size:.78rem;font-weight:700;text-decoration:none;">⬇ Download</a>
          <a href="${fileUrl}" target="_blank"
             style="background:#e0f2fe;color:#0369a1;padding:.35rem .9rem;border-radius:8px;
                    font-size:.78rem;font-weight:700;text-decoration:none;">👁 Visualizar</a>
        </div>`;
    } else {
      html += '<div style="margin-top:.5rem;font-size:.78rem;color:#9ca3af;">Sem ficheiro anexado.</div>';
    }
    pre.innerHTML = html;
  }

  function actualizarBotoes() {
    const btnConcluir = document.getElementById("btnConcluir");
    const btnNegar    = document.getElementById("btnNegar");
    const btnRedir    = document.getElementById("btnRedirecionar");
    const temSenha    = !!senhaAtual;
    if (btnConcluir) btnConcluir.disabled = !temSenha;
    if (btnNegar)    btnNegar.disabled    = !temSenha;
    if (btnRedir)    btnRedir.disabled    = !temSenha;
  }

  /* ════════════════════════════════════════════════════════════
     ACÇÕES PRINCIPAIS
  ════════════════════════════════════════════════════════════ */

  /* ── CHAMAR PRÓXIMA ──────────────────────────────────────── */
  window.callNextCustomer = async function () {
    const user = store.getUser();
    if (!user) return;

    const servicoId = user.servico_id;
    const balcao    = parseInt(user.balcao || user.numero_balcao);

    if (!servicoId || !balcao) {
      N && N.notify('error', 'Perfil incompleto: falta serviço ou balcão. Contacte o administrador.');
      return;
    }

    const btn = document.querySelector(".btn-next");
    if (btn) { btn.disabled = true; btn.textContent = "A chamar..."; }

    try {
      // FIX: usar BASE()
      const resp = await fetch(`${BASE()}/filas/chamar`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
        body:    JSON.stringify({ servico_id: servicoId, numero_balcao: balcao })
      });
      const data = await resp.json().catch(() => ({}));

      if (resp.status === 404 || (resp.ok && !data.senha)) {
        N && N.notify('info', 'Não há senhas na fila de momento.', 3500);
        return;
      }
      if (!resp.ok) {
        N && N.notify('error', data.erro || "Erro ao chamar senha.");
        return;
      }

      senhaAtual = data.senha;
      const hiddenEl = document.getElementById("currentSenhaId");
      if (hiddenEl) hiddenEl.value = senhaAtual.id || "";

      atualizarDisplayAtual(senhaAtual);
      actualizarBotoes();
      iniciarTimer();

      await _refreshPosAccao('chamada');

      N && N.onCall(senhaAtual.numero, balcao);

    } catch (err) {
      console.error("[chamar]", err);
      N && N.notify('error', 'Erro de ligação ao servidor. Verifique se o backend está activo.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Chamar"; }
    }
  };

  /* ── CONCLUIR ATENDIMENTO ────────────────────────────────── */
  window.concludeAttendance = async function () {
    const senhaId = document.getElementById("currentSenhaId")?.value;
    if (!senhaId) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }

    const btn = document.getElementById("btnConcluir");
    if (btn) { btn.disabled = true; btn.textContent = "A concluir..."; }

    try {
      // FIX: usar BASE()
      const resp = await fetch(`${BASE()}/filas/concluir/${senhaId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` }
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.erro || "Falha ao concluir.");
      }
      const numSenha = senhaAtual?.numero || senhaId;
      limparAtendimentoAtual();
      await _refreshPosAccao('conclusao');

      N && N.onConclude(numSenha);

    } catch (err) {
      N && N.notify('error', err.message || "Erro ao concluir atendimento.");
    } finally {
      if (btn) { btn.disabled = !senhaAtual; btn.textContent = "Concluir"; }
    }
  };

  /* ── NEGAR ATENDIMENTO ───────────────────────────────────── */
  window.denyCurrentTicket = async function () {
    const senhaId = document.getElementById("currentSenhaId")?.value;
    if (!senhaId || !senhaAtual) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }

    const motivo = prompt(`Motivo da negação da senha ${senhaAtual.numero}:`, "");
    if (motivo === null) return;
    if (!motivo.trim()) { N && N.notify('warn', 'É necessário indicar o motivo.'); return; }

    const btn = document.getElementById("btnNegar");
    if (btn) { btn.disabled = true; btn.textContent = "A negar..."; }

    try {
      // FIX: usar BASE()
      const resp = await fetch(`${BASE()}/senhas/${senhaId}/finalizar`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
        body:    JSON.stringify({ observacoes: `NEGADO: ${motivo}` })
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.erro || "Falha ao negar.");
      }
      const numSenha = senhaAtual?.numero || senhaId;
      limparAtendimentoAtual();
      await _refreshPosAccao('negacao');

      N && N.onDeny(numSenha);

    } catch (err) {
      N && N.notify('error', err.message || "Erro ao negar senha.");
    } finally {
      if (btn) { btn.disabled = !senhaAtual; btn.textContent = "Negar"; }
    }
  };

  /* ── REDIRECIONAR — MODAL + API REAL ─────────────────────── */

  window.redirectCustomer = async function () {
    if (!senhaAtual) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }

    const modal = document.getElementById("modalRedirecionar");
    if (!modal) {
      N && N.notify('error', 'Modal de redirecionamento não encontrado no HTML.');
      return;
    }

    const titleEl = document.getElementById("redirSenhaNum");
    const servicoEl = document.getElementById("redirServicoBadge");
    if (titleEl)   titleEl.textContent  = senhaAtual.numero;
    if (servicoEl) servicoEl.textContent = senhaAtual.servico?.nome || "–";

    await _carregarServicosNoModal();

    const motivoInput = document.getElementById("redirMotivo");
    if (motivoInput) motivoInput.value = "";

    modal.style.display = "flex";
    modal.onclick = (e) => { if (e.target === modal) fecharModalRedir(); };
  };

  async function _carregarServicosNoModal() {
    const select = document.getElementById("redirServicoSelect");
    if (!select) return;

    if (_servicosCache.length) {
      _renderSelectServicos(select);
      return;
    }

    try {
      // FIX: usar BASE()
      const resp = await fetch(`${BASE()}/servicos`);
      if (!resp.ok) return;
      const data = await resp.json();
      _servicosCache = Array.isArray(data) ? data : (data.servicos || data);
      _renderSelectServicos(select);
    } catch (err) {
      console.error("[redir] serviços:", err);
    }
  }

  function _renderSelectServicos(select) {
    const servicoActual = senhaAtual?.servico_id;
    select.innerHTML = '<option value="">— Seleccione o serviço de destino —</option>';
    _servicosCache
      .filter(s => s.ativo !== false && s.id !== servicoActual)
      .forEach(s => {
        const opt = document.createElement('option');
        opt.value       = s.id;
        opt.textContent = `${s.icone || '📋'} ${s.nome}`;
        select.appendChild(opt);
      });
  }

  window.confirmarRedirecionamento = async function () {
    const senhaId   = document.getElementById("currentSenhaId")?.value;
    const select    = document.getElementById("redirServicoSelect");
    const motivoEl  = document.getElementById("redirMotivo");
    const msgEl     = document.getElementById("redirMsg");

    if (!senhaId || !senhaAtual) {
      if (msgEl) { msgEl.textContent = 'Nenhuma senha activa.'; msgEl.style.color = '#dc2626'; }
      return;
    }

    const servicoId = parseInt(select?.value || '0');
    if (!servicoId) {
      if (msgEl) { msgEl.textContent = 'Seleccione um serviço de destino.'; msgEl.style.color = '#dc2626'; }
      return;
    }

    const motivo = (motivoEl?.value || '').trim() || 'Sem motivo indicado';
    const servicoDestino = _servicosCache.find(s => s.id === servicoId);
    const nomeDestino    = servicoDestino?.nome || `Serviço #${servicoId}`;

    const btnConfirmar = document.getElementById("btnConfirmarRedir");
    if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = "A redirecionar..."; }
    if (msgEl) msgEl.textContent = '';

    try {
      // FIX: usar BASE()
      const resp = await fetch(`${BASE()}/filas/redirecionar/${senhaId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${store.getToken()}` },
        body:    JSON.stringify({ servico_id: servicoId, motivo })
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        if (msgEl) { msgEl.textContent = data.erro || 'Erro ao redirecionar.'; msgEl.style.color = '#dc2626'; }
        return;
      }

      const numSenha = senhaAtual?.numero || senhaId;
      fecharModalRedir();
      limparAtendimentoAtual();
      await _refreshPosAccao('redirecionamento');

      N && N.onRedirect(numSenha, nomeDestino);

    } catch (err) {
      console.error("[redir] confirmar:", err);
      if (msgEl) { msgEl.textContent = 'Erro de ligação ao servidor.'; msgEl.style.color = '#dc2626'; }
    } finally {
      if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = "Confirmar Redirecionamento"; }
    }
  };

  window.fecharModalRedir = function () {
    const modal = document.getElementById("modalRedirecionar");
    if (modal) { modal.style.display = "none"; modal.onclick = null; }
  };

  /* ── PAUSA ───────────────────────────────────────────────── */
  window.togglePause = async function () {
    const btn = document.getElementById("pauseBtn");
    if (!btn) return;
    const estaPausado = btn.dataset.pausado === "1";

    if (!estaPausado) {
      btn.dataset.pausado = "1";
      btn.textContent = "▶ Retomar";
      btn.style.cssText += "background:#fff8ed;color:#d97706;border-color:#fde68a;";
      pararPolling();
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      setStatus("Pausado", "#d97706");

      N && N.notify('pause', 'Atendimento pausado. Clique em "Retomar" para continuar.', 4000);
      await _refreshPosAccao('pausa');
    } else {
      btn.dataset.pausado = "";
      btn.textContent = "⏸ Pausar";
      btn.style.cssText = "";
      iniciarPolling();
      if (senhaAtual) {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
          timerSegundos += 1;
          const el = document.getElementById("timer");
          if (el) el.textContent = formatDuracao(timerSegundos);
        }, 1000);
      }
      setStatus(senhaAtual ? "Em Atendimento" : "Disponível", senhaAtual ? "#d97706" : "#10b981");

      N && N.notify('resume', 'Atendimento retomado.', 2500);

      await _refreshPosAccao('retoma');
    }
  };

  /* ── ADICIONAR OBSERVAÇÃO ───────────────────────────────── */
  window.addObservation = function () {
    if (!senhaAtual) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }
    const obs = prompt("Adicionar observação:", senhaAtual.observacoes?.replace(/FICHEIRO:[^|]+\|?/g, "").trim() || "");
    if (obs === null) return;
    senhaAtual.observacoes = obs;
    const obsEl = document.getElementById("obsValue");
    if (obsEl) obsEl.textContent = obs || "Sem observações";
    preencherPreviewDocumentos(senhaAtual);
    N && N.notify('info', 'Observação adicionada.', 2500);
  };

  /* ── VER DOCUMENTOS ─────────────────────────────────────── */
  window.requestDocuments = function () {
    if (!senhaAtual) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }
    window.abrirDocumentoAtendimento();
  };

  /* ── IMPRIMIR RECIBO ─────────────────────────────────────── */
  window.sendReceipt = function () {
    if (!senhaAtual) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }
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
      <div class="header"><h2>IMTSB</h2><p>Instituto Médio Técnico São Benedito</p></div>
      <div class="row"><span class="label">Senha</span><span class="value">${senhaAtual.numero}</span></div>
      <div class="row"><span class="label">Serviço</span><span class="value">${senhaAtual.servico?.nome || "–"}</span></div>
      <div class="row"><span class="label">Balcão</span><span class="value">${balcao}</span></div>
      <div class="row"><span class="label">Emitida às</span><span class="value">${formatTimeLuanda(senhaAtual.emitida_em || senhaAtual.created_at)}</span></div>
      <div class="row"><span class="label">Duração</span><span class="value">${Math.round(timerSegundos / 60)} min</span></div>
      ${senhaAtual.observacoes ? `<div class="row"><span class="label">Observações</span><span class="value">${senhaAtual.observacoes}</span></div>` : ''}
      <div class="footer"><p>Impresso em ${agora}</p><p style="margin-top:8px">Obrigado pela sua visita ao IMTSB!</p></div>
      <script>window.onload=()=>window.print();<\/script>
      </body></html>`;

    const w = window.open("", "_blank", "width=500,height=620");
    if (!w) { N && N.notify('warn', 'Permita popups para imprimir o recibo.'); return; }
    w.document.write(html);
    w.document.close();
    N && N.notify('info', 'Recibo enviado para impressão.', 2500);
  };

  window.showStatistics = function () { window.location.href = "/dashadm.html"; };

  /* ── Modal Documentos do Atendimento ────────────────────── */
  let _urlFicheiroAtual = null;

  window.abrirDocumentoAtendimento = function () {
    if (!senhaAtual) { N && N.notify('warn', 'Nenhuma senha em atendimento.'); return; }
    const modal    = document.getElementById("modalDocumentos");
    const titulo   = document.getElementById("modalSenhaTitulo");
    const dadosEl  = document.getElementById("modalDadosForm");
    const ficBloco = document.getElementById("modalFicheiroBloco");
    const ficNome  = document.getElementById("modalFicheiroNome");
    const btnDl    = document.getElementById("modalBtnDownload");
    const semFich  = document.getElementById("modalSemFicheiro");
    if (!modal) return;

    if (titulo) titulo.textContent = `Senha ${senhaAtual.numero} · ${senhaAtual.servico?.nome || "Serviço"}`;

    const obs        = senhaAtual.observacoes || "";
    const partes     = obs.split(" | ").map(p => p.trim()).filter(Boolean);
    const nomeFich   = partes.find(p => p.startsWith("FICHEIRO:"))?.replace("FICHEIRO:", "").trim() || null;
    const linhasForm = partes.filter(p => !p.startsWith("FICHEIRO:")).join("\n");

    if (dadosEl) dadosEl.textContent = linhasForm || "Sem dados de formulário.";

    if (nomeFich && ficBloco && semFich) {
      ficBloco.style.display = "block";
      semFich.style.display  = "none";
      const nomeDisplay = nomeFich.split("_").slice(2).join("_") || nomeFich;
      if (ficNome) ficNome.textContent = `📎 ${nomeDisplay}`;
      // FIX: usar BASE() — mas a rota /api/senhas/:id/ficheiro precisa de /api/
      _urlFicheiroAtual = `${BASE()}/senhas/${senhaAtual.id}/ficheiro`;
      if (btnDl) btnDl.href = _urlFicheiroAtual;
    } else {
      if (ficBloco) ficBloco.style.display = "none";
      if (semFich)  semFich.style.display  = "block";
      _urlFicheiroAtual = null;
    }

    modal.style.display = "flex";
    modal.onclick = (e) => { if (e.target === modal) window.fecharModalDocumentos(); };
  };

  window.visualizarFicheiroModal = function () {
    if (!_urlFicheiroAtual) { N && N.notify('warn', 'Sem documento neste pedido.'); return; }
    window.open(_urlFicheiroAtual, "_blank", "noopener,noreferrer");
  };

  window.fecharModalDocumentos = function () {
    const modal = document.getElementById("modalDocumentos");
    if (modal) { modal.style.display = "none"; modal.onclick = null; }
  };

  window.imprimirDocumentoAtendimento = function () {
    if (!senhaAtual) return;
    const user       = store.getUser();
    const agora      = new Date().toLocaleString("pt-PT", { timeZone: ANGOLA_TZ });
    const obs        = senhaAtual.observacoes || "";
    const partes     = obs.split(" | ").map(p => p.trim()).filter(Boolean);
    const nomeFich   = partes.find(p => p.startsWith("FICHEIRO:"))?.replace("FICHEIRO:", "").trim() || null;
    const linhasForm = partes.filter(p => !p.startsWith("FICHEIRO:")).join("\n");

    const ficheiroHtml = nomeFich
      ? `<div class="row"><span class="label">Documento</span>
           <span class="value"><a href="${BASE()}/senhas/${senhaAtual.id}/ficheiro" target="_blank">
           ${nomeFich.split("_").slice(2).join("_") || nomeFich}</a></span></div>`
      : "";

    const html = `<html><head><title>Pedido ${senhaAtual.numero}</title>
      <style>
        body{font-family:'Segoe UI',sans-serif;padding:32px;color:#2a1a0a;max-width:560px;margin:0 auto}
        .header{background:linear-gradient(135deg,#3e2510,#6b4226);color:white;padding:20px;border-radius:12px;text-align:center;margin-bottom:20px}
        .header h2{margin:0 0 4px;font-size:1.4rem}
        .header p{margin:0;opacity:.8;font-size:.85rem}
        .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0e8dc;gap:12px}
        .label{color:#8a7060;font-size:.85rem;min-width:120px}
        .value{font-weight:600;font-size:.9rem;text-align:right;word-break:break-word}
        .dados{background:#fdf8f5;border:1px solid #e8d5c4;border-radius:8px;padding:12px;white-space:pre-wrap;font-size:.88rem;line-height:1.7;margin:12px 0}
        .footer{margin-top:20px;text-align:center;color:#8a7060;font-size:.8rem}
        a{color:#2563eb}
      </style></head><body>
      <div class="header"><h2>IMTSB · Pedido de Atendimento</h2><p>Instituto Médio Técnico São Benedito</p></div>
      <div class="row"><span class="label">Senha</span><span class="value">${senhaAtual.numero}</span></div>
      <div class="row"><span class="label">Serviço</span><span class="value">${senhaAtual.servico?.nome || "–"}</span></div>
      <div class="row"><span class="label">Balcão</span><span class="value">${user?.balcao || "–"}</span></div>
      <div class="row"><span class="label">Emitida às</span><span class="value">${formatTimeLuanda(senhaAtual.emitida_em || senhaAtual.created_at)}</span></div>
      ${ficheiroHtml}
      <div style="margin-top:16px;font-size:.8rem;font-weight:700;color:#8a7060;text-transform:uppercase;letter-spacing:.06em;">Dados do Pedido</div>
      <div class="dados">${linhasForm || "Sem dados registados."}</div>
      <div class="footer"><p>Impresso em ${agora} · Atendente: ${user?.name || "–"}</p></div>
      <script>window.onload=()=>{window.print();}<\/script>
      </body></html>`;

    const w = window.open("", "_blank", "width=620,height=720");
    if (!w) { N && N.notify('warn', 'Permita popups para imprimir.'); return; }
    w.document.write(html);
    w.document.close();
  };

  /* ── SAIR ────────────────────────────────────────────────── */
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
    actualizarBotoes();
    setStatus("Disponível", "#10b981");

    await _carregarServicosNoModal().catch(() => {});
    await atualizarTudo();
    iniciarPolling();

    setTimeout(() => N && N.play('info'), 800);
  });

})();