/**
 * static/js/dashusuario.js — Sprint 3 COMPLETO
 * ═══════════════════════════════════════════════════════════════
 * MELHORIAS:
 *   ✅ Live display reage a TODOS os estados: aguardando, atendendo,
 *      concluída, cancelada, redirecionada
 *   ✅ Notificação proeminente quando senha é chamada ("Dirija-se ao Balcão X")
 *   ✅ Banner de chamada com animação e som visual
 *   ✅ Posição na fila em tempo real
 *   ✅ Polling correcto sem 404 de senhas de dias anteriores
 *   ✅ Formulários de serviço redireccionam correctamente
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store     = window.IMTSBStore;
  const ANGOLA_TZ = 'Africa/Luanda';

  /* ── Estado ──────────────────────────────────────────────── */
  let servicoSelecionado    = null;
  let minhaSenha            = null;
  let pollingGeral          = null;
  let pollingAcompanhamento = null;
  let statusAnterior        = null; /* para detectar mudança de estado */

  const STORAGE_KEY = 'imtsb_minha_senha';

  /* ── Utilitários ─────────────────────────────────────────── */
  function formatHora(value) {
    if (!value) return '--:--';
    return new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: ANGOLA_TZ });
  }

  function resolverNomeAtendente(atendente) {
    if (!atendente) return 'atendente';
    if (typeof atendente === 'string') return atendente;
    return atendente.nome || atendente.name || 'atendente';
  }

  function traduzirStatus(status) {
    const mapa = {
      'aguardando': 'A aguardar',
      'chamando':   'A ser chamada',
      'atendendo':  'Em atendimento',
      'concluida':  'Concluída ✓',
      'cancelada':  'Cancelada'
    };
    return mapa[status] || status;
  }

  function mostrarMensagem(texto, tipo) {
    const el = document.getElementById('ticketMessage');
    if (!el) return;
    el.textContent = texto;
    el.className   = 'ticket-message';
    if (tipo) el.classList.add(tipo);
    if (tipo === 'ok') setTimeout(() => { if (el.textContent === texto) el.textContent = ''; }, 8000);
  }

  /* ── Banner de Chamada (notificação proeminente) ─────────── */
  function mostrarBannerChamada(numero, balcao, atendente, servico) {
    /* Remover banner anterior se existir */
    const existing = document.getElementById('callBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id    = 'callBanner';
    banner.innerHTML = `
      <div class="call-banner-inner">
        <div class="call-banner-icon">🔔</div>
        <div class="call-banner-text">
          <div class="call-banner-senha">Senha <strong>${numero}</strong></div>
          <div class="call-banner-instrucao">Dirija-se ao <strong>Balcão ${balcao}</strong></div>
          <div class="call-banner-atendente">Atendente: ${atendente} · ${servico || ''}</div>
        </div>
        <button class="call-banner-close" onclick="document.getElementById('callBanner')?.remove()">✕</button>
      </div>
    `;

    const style = document.getElementById('callBannerStyle') || document.createElement('style');
    style.id = 'callBannerStyle';
    style.textContent = `
      #callBanner {
        position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
        background: linear-gradient(135deg, #3e2510, #6b4226);
        color: white; padding: 0; animation: slideDown .4s cubic-bezier(.16,1,.3,1);
        box-shadow: 0 8px 32px rgba(0,0,0,.35);
      }
      @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
      .call-banner-inner {
        max-width: 700px; margin: 0 auto; display: flex;
        align-items: center; gap: 1rem; padding: 1.25rem 1.5rem;
      }
      .call-banner-icon { font-size: 2.2rem; animation: ring .5s ease-in-out infinite alternate; }
      @keyframes ring { from { transform: rotate(-15deg); } to { transform: rotate(15deg); } }
      .call-banner-text { flex: 1; }
      .call-banner-senha { font-size: .85rem; opacity: .85; margin-bottom: .15rem; }
      .call-banner-instrucao { font-size: 1.5rem; font-weight: 800; line-height: 1.1; }
      .call-banner-atendente { font-size: .85rem; opacity: .8; margin-top: .25rem; }
      .call-banner-close {
        background: rgba(255,255,255,.15); border: none; color: white;
        width: 36px; height: 36px; border-radius: 50%; cursor: pointer;
        font-size: 1rem; display: flex; align-items: center; justify-content: center;
        transition: background .2s;
      }
      .call-banner-close:hover { background: rgba(255,255,255,.3); }
      @media (max-width: 600px) { .call-banner-instrucao { font-size: 1.2rem; } }
    `;
    if (!document.getElementById('callBannerStyle')) document.head.appendChild(style);

    document.body.prepend(banner);

    /* Remover automaticamente após 30s */
    setTimeout(() => banner.remove(), 30000);
  }

  /* ── Tracker — bloco de posição/estado da minha senha ────── */
  function actualizarTrackerUI(dados) {
    const posEl    = document.getElementById('trackerPosicao');
    const tempoEl  = document.getElementById('trackerTempo');
    const estadoEl = document.getElementById('trackerEstado');
    const tracker  = document.getElementById('ticketTracker');

    if (!dados) {
      if (tracker) tracker.style.display = 'none';
      return;
    }
    if (tracker) tracker.style.display = 'block';

    const status = dados.status;

    /* Detectar mudança de estado */
    const mudou = statusAnterior !== null && statusAnterior !== status;
    statusAnterior = status;

    if (status === 'aguardando') {
      const pos    = dados.posicao || '?';
      const tempo  = dados.tempo_espera_estimado;
      if (posEl)    { posEl.textContent = pos; posEl.style.color = '#6b4226'; }
      if (tempoEl)  tempoEl.textContent = tempo > 0 ? `~${Math.round(tempo)}min` : '–';
      if (estadoEl) estadoEl.textContent = pos === 1 ? '⏳ Próxima a ser chamada!' : `⏳ A aguardar...`;

      const num = document.getElementById('currentTicket');
      if (num) num.textContent = dados.numero || '---';
      const statusEl = document.getElementById('currentStatus');
      if (statusEl) { statusEl.textContent = traduzirStatus(status); statusEl.style.color = '#6b4226'; }

    } else if (status === 'atendendo' || status === 'chamando') {
      const balcao    = dados.balcao || '–';
      const atendente = resolverNomeAtendente(dados.atendente);
      const servico   = dados.servico || '';

      if (posEl)    { posEl.textContent = '🔔'; posEl.style.color = '#10b981'; posEl.style.fontSize = '1.8rem'; }
      if (tempoEl)  tempoEl.textContent = 'A ser atendido';
      if (estadoEl) { estadoEl.textContent = `→ Balcão ${balcao} · ${atendente}`; estadoEl.style.color = '#10b981'; estadoEl.style.fontWeight = '700'; }

      const num = document.getElementById('currentTicket');
      if (num) num.textContent = dados.numero || '---';
      const statusEl = document.getElementById('currentStatus');
      if (statusEl) { statusEl.textContent = '🔔 A ser chamada!'; statusEl.style.color = '#10b981'; }

      /* Banner apenas quando muda de aguardando → atendendo */
      if (mudou) {
        mostrarBannerChamada(dados.numero, balcao, atendente, servico);
        mostrarMensagem(`🔔 Senha ${dados.numero}: dirija-se ao Balcão ${balcao} com ${atendente}`, 'ok');
      }

    } else if (status === 'concluida') {
      if (posEl)    { posEl.textContent = '✓'; posEl.style.color = '#22c55e'; posEl.style.fontSize = '2rem'; }
      if (tempoEl)  tempoEl.textContent = 'Concluído';
      if (estadoEl) estadoEl.textContent = 'Atendimento concluído com sucesso';

      /* Display principal */
      const numEl = document.getElementById('currentTicket');
      if (numEl) { numEl.style.color = '#22c55e'; }
      const statusEl = document.getElementById('currentStatus');
      if (statusEl) { statusEl.textContent = '✓ Concluída'; statusEl.style.color = '#22c55e'; }

      /* Banner de conclusão (só na primeira detecção) */
      if (mudou) {
        mostrarMensagem('✅ Atendimento concluído! Obrigado pela sua visita ao IMTSB.', 'ok');

        /* Banner verde (mesmo sistema do banner de chamada) */
        const existing = document.getElementById('callBanner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.id = 'callBanner';
        banner.innerHTML = `
          <div class="call-banner-inner" style="background:linear-gradient(135deg,#065f46,#059669);">
            <div class="call-banner-icon">✅</div>
            <div class="call-banner-text">
              <div class="call-banner-senha">Senha <strong>${dados.numero}</strong></div>
              <div class="call-banner-instrucao">Atendimento concluído!</div>
              <div class="call-banner-atendente">Obrigado pela sua visita ao IMTSB</div>
            </div>
            <button class="call-banner-close" onclick="document.getElementById('callBanner')?.remove()">✕</button>
          </div>`;
        /* Reutilizar o mesmo estilo do banner de chamada */
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10000;background:linear-gradient(135deg,#065f46,#059669);color:white;box-shadow:0 8px 32px rgba(0,0,0,.35);animation:slideDown .4s cubic-bezier(.16,1,.3,1);';
        document.body.prepend(banner);
        setTimeout(() => banner.remove(), 8000);
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 8000);

    } else if (status === 'cancelada') {
      if (posEl)    { posEl.textContent = '✕'; posEl.style.color = '#ef4444'; posEl.style.fontSize = '1.8rem'; }
      if (tempoEl)  tempoEl.textContent = 'Cancelada';
      if (estadoEl) estadoEl.textContent = 'Senha cancelada';

      const statusEl = document.getElementById('currentStatus');
      if (statusEl) { statusEl.textContent = 'Cancelada'; statusEl.style.color = '#ef4444'; }

      if (mudou) mostrarMensagem('Senha cancelada. Pode emitir uma nova senha.', 'warn');

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 5000);
    }
  }

  function atualizarDisplaySenha() {
    const numEl    = document.getElementById('currentTicket');
    const statusEl = document.getElementById('currentStatus');
    const tracker  = document.getElementById('ticketTracker');

    if (!minhaSenha) {
      if (numEl)    numEl.textContent    = '---';
      if (statusEl) statusEl.textContent = 'Nenhuma senha activa';
      if (tracker)  tracker.style.display = 'none';
      statusAnterior = null;
      return;
    }
    if (numEl)    numEl.textContent    = minhaSenha.numero;
    if (statusEl) statusEl.textContent = traduzirStatus(minhaSenha.status);
    if (tracker)  tracker.style.display = 'block';
  }

  /* ── Acompanhamento de posição ───────────────────────────── */
  function iniciarAcompanhamento(numeroSenha) {
    pararAcompanhamento();
    actualizarPosicao(numeroSenha);
    pollingAcompanhamento = setInterval(() => actualizarPosicao(numeroSenha), 5000);
  }

  function pararAcompanhamento() {
    if (pollingAcompanhamento) { clearInterval(pollingAcompanhamento); pollingAcompanhamento = null; }
  }

  async function actualizarPosicao(numeroSenha) {
    try {
      const resp = await fetch(`/api/dashboard/public/senha/${encodeURIComponent(numeroSenha)}`);

      if (resp.status === 404) {
        console.info(`[acompanhamento] Senha ${numeroSenha} não encontrada hoje → a limpar`);
        limparSenhaLocal();
        pararAcompanhamento();
        atualizarDisplaySenha();
        return;
      }
      if (!resp.ok) return;

      const dados = await resp.json();
      actualizarTrackerUI(dados);

      /* Actualizar a senha guardada com o estado mais recente */
      if (minhaSenha) {
        minhaSenha.status = dados.status;
        guardarSenhaLocal(minhaSenha);
      }

    } catch (err) {
      console.error('[actualizarPosicao]', err);
    }
  }

  /* ── Estatísticas gerais ─────────────────────────────────── */
  async function atualizarEstatisticas() {
    try {
      const resp = await fetch('/api/senhas/estatisticas');
      if (!resp.ok) return;
      const stats = await resp.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      set('statFila',  stats.aguardando || 0);
      set('statTempo', `${Math.round(stats.tempo_medio_espera || 0)}m`);
      set('statDone',  stats.concluidas || 0);

      const total   = stats.total_emitidas || 0;
      const conclui = stats.concluidas     || 0;
      set('statSat', total > 0 ? `${Math.round((conclui / total) * 100)}%` : '—');

    } catch (err) {
      console.error('❌ Estatísticas:', err);
    }
  }

  /* ── Última chamada geral ────────────────────────────────── */
  async function atualizarUltimaChamada() {
    try {
      const resp = await fetch('/api/senhas?status=atendendo&per_page=1&page=1');
      if (!resp.ok) return;
      const dados  = await resp.json();
      const senhas = dados.senhas || [];
      const numEl    = document.getElementById('ultimaChamada');
      const balcaoEl = document.getElementById('ultimoBalcao');

      if (senhas.length > 0) {
        const s       = senhas[0];
        const nomeAt  = resolverNomeAtendente(s.atendente);
        if (numEl)    numEl.textContent    = s.numero;
        if (balcaoEl) balcaoEl.textContent = s.numero_balcao ? `Balcão ${s.numero_balcao} · ${nomeAt}` : nomeAt;
      } else {
        if (numEl)    numEl.textContent    = '—';
        if (balcaoEl) balcaoEl.textContent = 'Nenhum em atendimento';
      }
    } catch (err) {
      console.error('❌ Última chamada:', err);
    }
  }

  /* ── Serviços ────────────────────────────────────────────── */
  async function carregarServicos() {
    const container = document.getElementById('servicesList');
    if (!container) return;

    try {
      const resp = await fetch('/api/servicos');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw     = await resp.json();
      const servicos = Array.isArray(raw) ? raw : (raw.servicos || raw);

      if (!servicos.length) {
        container.innerHTML = '<p style="color:var(--text-muted);">Sem serviços disponíveis.</p>';
        return;
      }

      container.innerHTML = '';
      servicos.forEach(servico => {
        const temForm  = !!MAPA_FORMULARIOS[servico.id];
        const subtexto = temForm
          ? '📝 Preencher formulário'
          : (servico.descricao || 'Emissão directa');

        const card = document.createElement('article');
        card.className         = 'service-card';
        card.dataset.servicoId = servico.id;
        card.style.cursor      = 'pointer';
        card.innerHTML = `
          <div class="service-icon">${servico.icone || '📄'}</div>
          <div class="service-info">
            <div class="service-name">${servico.nome}</div>
            <div class="service-status">
              <span class="status-dot"></span>${subtexto}
            </div>
          </div>
          <span class="arrow-icon">→</span>
        `;
        card.addEventListener('click', () => selecionarServico(servico, card));
        container.appendChild(card);
      });
    } catch (err) {
      console.error('❌ Serviços:', err);
      container.innerHTML = '<p style="color:var(--text-muted);">Erro ao carregar serviços.</p>';
    }
  }

  /* ── Mapa serviço → URL do formulário ───────────────────────
     Serviços com formulário: redirecciona imediatamente.
     Serviços sem formulário (Biblioteca): emite directo.
     Nota: os IDs são os da tabela `servicos` na base de dados.
  ──────────────────────────────────────────────────────────── */
  const MAPA_FORMULARIOS = {
    1: '/matricula.html',       // Secretaria Académica
    2: '/tesouraria.html',      // Tesouraria
    3: '/declaracao.html',      // Direcção Pedagógica
    4: null,                    // Biblioteca (sem formulário — emite directo)
    5: '/apoio-cliente.html'    // Apoio ao Cliente
  };

  function selecionarServico(servico, cardEl) {
    const urlForm = MAPA_FORMULARIOS[servico.id];

    if (urlForm) {
      /* ── Tem formulário → redirecionar ─────────────────── */
      window.location.href = urlForm;
      return;
    }

    /* ── Sem formulário (ex: Biblioteca) → seleccionar inline */
    servicoSelecionado = servico;
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('ativo'));
    if (cardEl) cardEl.classList.add('ativo');
    mostrarMensagem(`${servico.nome} seleccionado. Clique em "Emitir Senha".`, 'ok');
  }

  /* ── Emitir senha ────────────────────────────────────────── */
  async function emitirSenha() {
    if (!servicoSelecionado) {
      mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
      return;
    }

    const btn = document.getElementById('btnEmitirSenha');
    if (btn) { btn.disabled = true; btn.textContent = 'A emitir...'; }
    mostrarMensagem('⏳ A emitir senha...', '');

    try {
      const resp = await fetch('/api/senhas/emitir', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ servico_id: servicoSelecionado.id, tipo: 'normal' })
      });
      const dados = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        mostrarMensagem(`❌ ${dados.erro || 'Erro ao emitir senha'}`, 'warn');
        return;
      }

      minhaSenha     = dados.senha;
      statusAnterior = null;
      guardarSenhaLocal(minhaSenha);
      atualizarDisplaySenha();
      iniciarAcompanhamento(minhaSenha.numero);
      mostrarMensagem(`✅ Senha emitida: ${minhaSenha.numero} · ${servicoSelecionado.nome}`, 'ok');
      await atualizarEstatisticas();

    } catch (err) {
      console.error('❌ Emitir:', err);
      mostrarMensagem('❌ Erro de ligação ao servidor', 'warn');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Emitir Senha'; }
    }
  }

  /* ── localStorage ────────────────────────────────────────── */
  function guardarSenhaLocal(senha) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(senha)); } catch (_) {}
  }

  function limparSenhaLocal() {
    localStorage.removeItem(STORAGE_KEY);
    minhaSenha = null;
  }

  function restaurarSenhaGuardada() {
    try {
      const guardada = localStorage.getItem(STORAGE_KEY);
      if (!guardada) return;
      const senha = JSON.parse(guardada);

      /* Validar que é de hoje */
      const hoje        = new Date().toISOString().split('T')[0];
      const dataEmissao = senha.data_emissao || '';
      if (dataEmissao !== hoje) {
        console.info(`[restaurar] Senha ${senha.numero} é de ${dataEmissao}, hoje ${hoje} — descartada`);
        limparSenhaLocal();
        return;
      }

      minhaSenha     = senha;
      statusAnterior = senha.status;
      atualizarDisplaySenha();

      if (!['concluida', 'cancelada'].includes(senha.status)) {
        iniciarAcompanhamento(senha.numero);
      }
      console.info(`[restaurar] Senha ${senha.numero} restaurada (${senha.status})`);
    } catch (err) {
      console.warn('[restaurar] Erro:', err);
      limparSenhaLocal();
    }
  }

  /* ── Polling geral ───────────────────────────────────────── */
  function iniciarPollingGeral() {
    pararPollingGeral();
    pollingGeral = setInterval(async () => {
      await atualizarEstatisticas();
      await atualizarUltimaChamada();
    }, 5000);
  }

  function pararPollingGeral() {
    if (pollingGeral) { clearInterval(pollingGeral); pollingGeral = null; }
  }

  /* ── Header ──────────────────────────────────────────────── */
  function configurarHeader() {
    const user = store.getUser();
    const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    if (user) {
      set('userProfileName', `Bem-vindo, ${user.name}`);
      set('dadoNome',   user.name  || '—');
      set('dadoEmail',  user.email || '—');
      set('dadoPerfil', user.role  || '—');
    } else {
      set('userProfileName', 'Bem-vindo');
      set('dadoNome',   'Visitante');
      set('dadoEmail',  'Não identificado');
      set('dadoPerfil', 'Público');
    }
  }

  function configurarBotoes() {
    const btnEmitir  = document.getElementById('btnEmitirSenha');
    if (btnEmitir) btnEmitir.addEventListener('click', emitirSenha);

    const btnSair = document.getElementById('btnSair');
    if (btnSair) btnSair.addEventListener('click', () => {
      pararPollingGeral(); pararAcompanhamento(); limparSenhaLocal(); store.logout();
    });

    const painel    = document.getElementById('meusDadosPanel');
    const btnDados  = document.getElementById('btnMeusDados');
    const btnFechar = document.getElementById('btnFecharDados');
    if (btnDados && painel)  btnDados.addEventListener('click',  () => painel.classList.add('aberto'));
    if (btnFechar && painel) btnFechar.addEventListener('click', () => painel.classList.remove('aberto'));

    /* Flash message de emissão (vinda de service-form.js) */
    const flash = localStorage.getItem('imtsb_flash');
    if (flash) { mostrarMensagem(flash, 'ok'); localStorage.removeItem('imtsb_flash'); }
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ dashusuario.js Sprint 3 carregado");
    configurarHeader();
    configurarBotoes();
    carregarServicos();
    atualizarEstatisticas();
    atualizarUltimaChamada();
    restaurarSenhaGuardada();
    iniciarPollingGeral();
  });

})();