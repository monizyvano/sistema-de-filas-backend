/**
 * static/js/dashusuario.js — v3
 * Notificação ao vivo: "Dirija-se ao Balcão X com Atendente X"
 * quando a senha do cliente passa para "atendendo".
 */
(function () {
  "use strict";

  const store = window.IMTSBStore;

  const PAGINAS = {
    1: "/matricula.html",
    2: "/tesouraria.html",
    3: "/declaracao.html",
    4: "/matricula.html",
    5: "/apoio-cliente.html"
  };

  const STORAGE_KEY = "imtsb_minha_senha";
  let pollingGeral = null, pollingAcomp = null;
  let estadoAnterior = null; // para detectar transição → atendendo

  document.addEventListener("DOMContentLoaded", () => {
    configurarHeader();
    configurarBotoes();
    carregarServicos();
    atualizarEstatisticas();
    atualizarUltimaChamada();
    restaurarSenha();
    mostrarFlash();
    iniciarPollingGeral();
  });

  // ── Flash ─────────────────────────────────────────────────
  function mostrarFlash() {
    const f = localStorage.getItem("imtsb_flash");
    if (!f) return;
    localStorage.removeItem("imtsb_flash");
    mostrarMsg(f, "ok");
  }

  // ── Header ────────────────────────────────────────────────
  function configurarHeader() {
    const u = store.getUser();
    const g = id => document.getElementById(id);
    if (u) {
      if (g("userProfileName")) g("userProfileName").textContent = `Bem-vindo, ${u.name}`;
      if (g("dadoNome"))        g("dadoNome").textContent        = u.name  || "—";
      if (g("dadoEmail"))       g("dadoEmail").textContent       = u.email || "—";
      if (g("dadoPerfil"))      g("dadoPerfil").textContent      = u.role  || "—";
    }
  }

  // ── Botões ────────────────────────────────────────────────
  function configurarBotoes() {
    const btnSair  = document.getElementById("btnSair");
    const painel   = document.getElementById("meusDadosPanel");
    const btnDados = document.getElementById("btnMeusDados");
    const btnFech  = document.getElementById("btnFecharDados");

    if (btnSair) {
      const u = store.getUser();
      btnSair.textContent = u ? "Sair" : "Entrar";
      btnSair.addEventListener("click", () => {
        if (u) { pararPollings(); localStorage.removeItem(STORAGE_KEY); store.logout(); }
        else   { window.location.href = "/logintcc.html"; }
      });
    }
    if (btnDados && painel) btnDados.addEventListener("click",  () => painel.classList.add("aberto"));
    if (btnFech  && painel) btnFech.addEventListener("click",   () => painel.classList.remove("aberto"));

    const btnEmitir = document.getElementById("btnEmitirSenha");
    if (btnEmitir) {
      btnEmitir.addEventListener("click", () => {
        mostrarMsg("👇 Seleccione um serviço abaixo para emitir a sua senha.", "warn");
        const svc = document.getElementById("servicesList");
        if (svc) svc.scrollIntoView({ behavior: "smooth" });
      });
    }
  }

  // ── Serviços ──────────────────────────────────────────────
  async function carregarServicos() {
    const container = document.getElementById("servicesList");
    if (!container) return;
    try {
      const resp = await fetch("/api/servicos/");
      if (!resp.ok) throw new Error();
      const lista = await resp.json();
      if (!lista.length) { container.innerHTML = "<p style='color:var(--text-muted)'>Sem serviços disponíveis.</p>"; return; }
      container.innerHTML = "";
      lista.forEach(s => {
        const pagina = PAGINAS[s.id] || "/index.html";
        const card   = document.createElement("article");
        card.className = "service-card";
        card.innerHTML = `
          <div class="service-icon">${s.icone || "📋"}</div>
          <div class="service-info">
            <div class="service-name">${s.nome}</div>
            <div class="service-status"><span class="status-dot"></span>${s.descricao || "Disponível"}</div>
          </div>
          <span class="arrow-icon">→</span>`;
        card.addEventListener("click", () => { window.location.href = pagina; });
        container.appendChild(card);
      });
    } catch (e) {
      document.getElementById("servicesList").innerHTML = "<p style='color:var(--text-muted)'>Erro ao carregar.</p>";
    }
  }

  // ── Estatísticas ─────────────────────────────────────────
  async function atualizarEstatisticas() {
    try {
      const resp = await fetch("/api/senhas/estatisticas");
      if (!resp.ok) return;
      const s = await resp.json();
      const g = id => document.getElementById(id);
      if (g("statFila"))  g("statFila").textContent  = s.aguardando || 0;
      if (g("statTempo")) g("statTempo").textContent = `~${s.tempo_medio_espera || 0}min`;
      if (g("statDone"))  g("statDone").textContent  = s.concluidas || 0;
      if (g("statSat")) {
        const t = s.total_emitidas || 0, c = s.concluidas || 0;
        g("statSat").textContent = t > 0 ? `${Math.round((c/t)*100)}%` : "—";
      }
    } catch (e) {}
  }

  // ── Última chamada geral ──────────────────────────────────
  async function atualizarUltimaChamada() {
    try {
      const resp = await fetch("/api/senhas?status=atendendo&per_page=1&page=1");
      if (!resp.ok) return;
      const { senhas = [] } = await resp.json();
      const g = id => document.getElementById(id);
      if (senhas.length) {
        const s = senhas[0];
        if (g("ultimaChamada")) g("ultimaChamada").textContent = s.numero;
        if (g("ultimoBalcao"))  g("ultimoBalcao").textContent  = s.numero_balcao ? `Balcão ${s.numero_balcao}` : "—";
      } else {
        if (g("ultimaChamada")) g("ultimaChamada").textContent = "---";
        if (g("ultimoBalcao"))  g("ultimoBalcao").textContent  = "—";
      }
    } catch (e) {}
  }

  // ── Acompanhamento interactivo ────────────────────────────
  function restaurarSenha() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const senha = JSON.parse(raw);
      const hoje  = new Date().toISOString().split("T")[0];
      if ((senha.data_emissao || "") !== hoje) { localStorage.removeItem(STORAGE_KEY); return; }
      mostrarSenhaActual(senha);
      if (!["concluida","cancelada"].includes(senha.status)) {
        iniciarAcompanhamento(senha.numero);
      }
    } catch (_) { localStorage.removeItem(STORAGE_KEY); }
  }

  function mostrarSenhaActual(s) {
    const g = id => document.getElementById(id);
    if (g("currentTicket"))   g("currentTicket").textContent   = s.numero;
    if (g("currentStatus"))   g("currentStatus").textContent   = traduzirStatus(s.status);
    if (g("ticketTracker"))   g("ticketTracker").style.display = "block";
  }

  function iniciarAcompanhamento(numero) {
    if (pollingAcomp) clearInterval(pollingAcomp);
    actualizarPosicao(numero);
    pollingAcomp = setInterval(() => actualizarPosicao(numero), 8000);
  }

  async function actualizarPosicao(numero) {
    try {
      const resp = await fetch(`/api/dashboard/public/senha/${encodeURIComponent(numero)}`);
      if (resp.status === 404) {
        localStorage.removeItem(STORAGE_KEY);
        if (pollingAcomp) clearInterval(pollingAcomp);
        return;
      }
      if (!resp.ok) return;
      const d = await resp.json();
      const g = id => document.getElementById(id);

      // Detectar transição para "atendendo"
      if (d.status === "atendendo" && estadoAnterior !== "atendendo") {
        mostrarNotificacaoAtendimento(d, numero);
      }
      estadoAnterior = d.status;

      // Actualizar trackers
      if (g("currentStatus")) g("currentStatus").textContent = traduzirStatus(d.status);

      if (d.status === "aguardando") {
        if (g("trackerPosicao")) g("trackerPosicao").textContent = d.posicao || "—";
        if (g("trackerTempo"))   g("trackerTempo").textContent   = d.tempo_espera_estimado > 0 ? `~${d.tempo_espera_estimado}min` : "—";
        if (g("trackerEstado"))  g("trackerEstado").textContent  = "A aguardar";

      } else if (d.status === "atendendo") {
        if (g("trackerPosicao")) g("trackerPosicao").textContent = "🔔";
        if (g("trackerTempo"))   g("trackerTempo").textContent   = "É a sua vez!";
        if (g("trackerEstado"))  g("trackerEstado").textContent  = `Balcão ${d.balcao || "—"}`;
        if (pollingAcomp) clearInterval(pollingAcomp);

      } else if (["concluida","cancelada"].includes(d.status)) {
        const negado = d.status === "cancelada";
        if (g("trackerEstado")) {
          g("trackerEstado").textContent = negado ? "❌ Negada" : "✅ Concluída";
        }
        // Mostrar motivo de negação se existir
        if (negado && d.observacoes) {
          const motivo = d.observacoes.replace(/^CANCELADA:\s*/i,"").replace(/^NEGADO:\s*/i,"");
          mostrarMsg(`Senha ${numero} foi negada: ${motivo}`, "warn");
        }
        if (pollingAcomp) clearInterval(pollingAcomp);
        setTimeout(() => { localStorage.removeItem(STORAGE_KEY); }, 8000);
      }

    } catch (e) {}
  }

  // ── Notificação ao vivo ───────────────────────────────────
  function mostrarNotificacaoAtendimento(d, numero) {
    // Criar banner de notificação
    const balcao   = d.balcao    ? `Balcão ${d.balcao}` : "Balcão";
    const atendente = d.atendente || "atendente";

    // Remover banner anterior se existir
    const old = document.getElementById("notifBanner");
    if (old) old.remove();

    const banner = document.createElement("div");
    banner.id    = "notifBanner";
    banner.style.cssText = `
      position:fixed; top:0; left:0; right:0; z-index:9999;
      background:linear-gradient(135deg,#065f46,#047857);
      color:#fff; padding:1.1rem 1.5rem;
      display:flex; align-items:center; justify-content:space-between; gap:1rem;
      box-shadow:0 4px 20px rgba(0,0,0,.3);
      animation: slideDown .4s ease-out;
    `;

    const style = document.createElement("style");
    style.textContent = `@keyframes slideDown{from{transform:translateY(-100%)}to{transform:translateY(0)}}
      @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}`;
    document.head.appendChild(style);

    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:.85rem">
        <span style="font-size:1.8rem;animation:pulse 1s ease-in-out infinite">🔔</span>
        <div>
          <div style="font-weight:700;font-size:1.05rem">Senha ${numero} — É A SUA VEZ!</div>
          <div style="font-size:.88rem;opacity:.9;margin-top:.15rem">
            Dirija-se ao <strong>${balcao}</strong> com o atendente <strong>${atendente}</strong>
          </div>
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:.4rem .85rem;cursor:pointer;font-weight:700;font-size:.9rem">OK</button>
    `;

    document.body.prepend(banner);

    // Vibração mobile se suportado
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);

    // Auto-remover após 30s
    setTimeout(() => banner.remove(), 30000);
  }

  // ── Polling geral ─────────────────────────────────────────
  function iniciarPollingGeral() {
    pararPollings();
    pollingGeral = setInterval(() => {
      atualizarEstatisticas();
      atualizarUltimaChamada();
    }, 5000);
  }

  function pararPollings() {
    if (pollingGeral) { clearInterval(pollingGeral); pollingGeral = null; }
    if (pollingAcomp) { clearInterval(pollingAcomp); pollingAcomp = null; }
  }

  function mostrarMsg(t, tipo) {
    const el = document.getElementById("ticketMessage");
    if (!el) return;
    el.textContent = t; el.className = "ticket-message";
    if (tipo) el.classList.add(tipo);
    if (tipo === "ok") setTimeout(() => { if (el.textContent === t) el.textContent = ""; }, 7000);
  }

  function traduzirStatus(s) {
    return { aguardando:"🕐 A aguardar", chamada:"📣 Chamada", atendendo:"🟢 Em atendimento", concluida:"✅ Concluída", cancelada:"❌ Cancelada" }[s] || s;
  }

})();