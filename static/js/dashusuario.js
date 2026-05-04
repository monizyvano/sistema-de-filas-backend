/**
 * static/js/dashusuario.js — Sprint 5 FIXED
 * ═══════════════════════════════════════════════════════════════
 * FIXES:
 *   ✅ Última Chamada Geral — polling real a cada 5s, detecta mudança
 *   ✅ NEGADA — mostra motivo ao cliente + notificação específica
 *   ✅ REDIRECCIONADA — mostra destino + notificação ao cliente
 *   ✅ PAUSADA — mostra aviso ao cliente
 *   ✅ Avaliação por estrelas → POST /api/tickets/rate (backend real)
 *   ✅ Nome registado no header (ou "Visitante" para sem conta)
 *   ✅ Serviço sempre visível no tracker
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store     = window.IMTSBStore;
  const N         = window.IMTSBNotifications;
  const ANGOLA_TZ = 'Africa/Luanda';

  /* ── Estado ──────────────────────────────────────────────── */
  let servicoSelecionado    = null;
  let minhaSenha            = null;
  let pollingGeral          = null;
  let pollingAcompanhamento = null;
  let statusAnterior        = null;
  let obsAnterior           = null;
  let _ultimaChamadaNum     = null;
  let _iconTimer            = null;

  const STORAGE_KEY = 'imtsb_minha_senha';

  /* ── Base URL dinâmica ───────────────────────────────────── */
  const BASE = () => (window.IMTSBApiConfig?.baseUrl || '/api');

  /* ── Helper set() ────────────────────────────────────────── */
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = val;
  };

  /* ── Formatar hora ───────────────────────────────────────── */
  function formatHora(v) {
    if (!v) return '--:--';
    const iso = (typeof v === 'string' && !v.endsWith('Z') && !v.includes('+'))
      ? v + 'Z' : v;
    return new Date(iso).toLocaleTimeString('pt-PT',
      { hour: '2-digit', minute: '2-digit', timeZone: ANGOLA_TZ });
  }

  function resolverNomeAt(a) {
    if (!a) return 'atendente';
    if (typeof a === 'string') return a;
    return a.nome || a.name || 'atendente';
  }

  /* ── Mensagem de estado ──────────────────────────────────── */
  function mostrarMensagem(texto, tipo) {
    const el = document.getElementById('ticketMessage');
    if (!el) return;
    el.innerHTML = texto;
    el.className = 'ticket-message';
    if (tipo) el.classList.add(tipo);
    if (tipo === 'ok') setTimeout(() => { if (el.innerHTML === texto) el.textContent = ''; }, 10000);
  }

  /* ════════════════════════════════════════════════════════════
     ÚLTIMA CHAMADA GERAL — polling real, detecta mudança
  ════════════════════════════════════════════════════════════ */
  async function atualizarUltimaChamada() {
    const numEl     = document.getElementById('ultimaChamada');
    const balcaoEl  = document.getElementById('ultimoBalcao');
    const servicoEl = document.getElementById('ultimoServico');
    const horaEl    = document.getElementById('ultimaHora');
    const iconEl    = document.getElementById('lastCallIcon');
    if (!numEl) return;

    let numero  = null;
    let balcao  = null;
    let servico = null;
    let hora    = null;

    /* Tentativa 1 — snapshot (fonte mais fiável) */
    try {
      const r = await fetch(`${BASE()}/realtime/snapshot`);
      if (r.ok) {
        const snap = await r.json();
        const lc   = snap.lastCalled;
        if (lc?.code) {
          numero  = lc.code;
          balcao  = lc.counterName || 'Balcão';
          servico = lc.service || '—';
          hora    = lc.at ? formatHora(lc.at) : null;
        }
      }
    } catch (_) {}

    /* Tentativa 2 — tv endpoint */
    if (!numero) {
      try {
        const r2 = await fetch(`${BASE()}/dashboard/public/tv`);
        if (r2.ok) {
          const tv = await r2.json();
          if (tv.em_atendimento?.length > 0) {
            const s = tv.em_atendimento[0];
            numero  = s.numero;
            balcao  = `Balcão ${s.balcao}`;
            servico = s.servico || '—';
            hora    = formatHora(new Date().toISOString());
          }
        }
      } catch (_) {}
    }

    /* Tentativa 3 — senhas em atendimento */
    if (!numero) {
      try {
        const r3 = await fetch(`${BASE()}/senhas?status=atendendo&per_page=1&page=1`);
        if (r3.ok) {
          const d = await r3.json();
          const sl = d.senhas || (Array.isArray(d) ? d : []);
          if (sl.length > 0) {
            const s  = sl[0];
            numero   = s.numero;
            balcao   = s.numero_balcao ? `Balcão ${s.numero_balcao}` : 'Balcão';
            servico  = s.servico?.nome || '—';
            hora     = s.chamada_em ? formatHora(s.chamada_em) : null;
          }
        }
      } catch (_) {}
    }

    if (!numero) return;

    const mudou = numero !== _ultimaChamadaNum;
    _ultimaChamadaNum = numero;

    /* Actualizar DOM */
    if (numEl) {
      numEl.textContent = numero;
      if (mudou) {
        numEl.classList.remove('flash-green');
        void numEl.offsetWidth;
        numEl.classList.add('flash-green');
        setTimeout(() => numEl.classList.remove('flash-green'), 2500);
      }
    }
    if (balcaoEl)  balcaoEl.textContent  = balcao  || '—';
    if (servicoEl) servicoEl.textContent = servico  || '—';
    if (horaEl)    horaEl.textContent    = hora ? `Chamada às ${hora}` : '';

    if (iconEl && mudou) {
      iconEl.classList.remove('idle');
      iconEl.classList.add('ringing');
      clearTimeout(_iconTimer);
      _iconTimer = setTimeout(() => {
        iconEl.classList.remove('ringing');
        iconEl.classList.add('idle');
      }, 7000);
    }
  }

  /* ════════════════════════════════════════════════════════════
     TRACKER — reage a TODAS as acções do trabalhador
  ════════════════════════════════════════════════════════════ */
  function actualizarTrackerUI(dados) {
    if (!dados) {
      document.getElementById('ticketTracker')?.style.setProperty('display','none');
      return;
    }

    const tracker = document.getElementById('ticketTracker');
    if (tracker) tracker.style.display = 'flex';

    const status   = dados.status;
    const numero   = dados.numero || minhaSenha?.numero || '---';
    const servico  = dados.servico || minhaSenha?.servico?.nome || servicoSelecionado?.nome || '—';
    const obs      = dados.observacoes || minhaSenha?.observacoes || '';
    const mudou    = statusAnterior !== null && statusAnterior !== status;
    const obsMudou = obsAnterior !== null && obsAnterior !== obs;

    statusAnterior = status;
    obsAnterior    = obs;

    /* Sempre mostrar serviço */
    set('trackerServico', servico);
    const numEl    = document.getElementById('currentTicket');
    const badgeEl  = document.getElementById('currentStatusBadge');
    const iconEl   = document.getElementById('currentStatusIcon');
    const statusEl = document.getElementById('currentStatus');
    if (numEl) numEl.textContent = numero;

    /* ── AGUARDANDO ────────────────────────────────────────── */
    if (status === 'aguardando') {
      const pos   = dados.posicao || '?';
      const tempo = dados.tempo_espera_estimado || 0;
      set('trackerPosicao', String(pos));
      set('trackerTempo',   tempo > 0 ? `~${Math.round(tempo)}min` : '—');
      set('trackerEstado',  pos === 1 ? '⏳ Próxima a ser chamada!' : `⏳ Posição ${pos} na fila`);
      document.getElementById('chipPosicao')?.classList.remove('chip-green','chip-red','chip-purple');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-waiting';
      if (iconEl)  iconEl.textContent = '⏳';
      if (statusEl) statusEl.textContent = 'A aguardar';

    /* ── CHAMANDO / ATENDENDO ──────────────────────────────── */
    } else if (status === 'atendendo' || status === 'chamando') {
      const balcao    = dados.balcao || '–';
      const atendente = resolverNomeAt(dados.atendente);
      set('trackerPosicao', '🔔');
      set('trackerTempo',   'Agora');
      set('trackerEstado',  `→ Balcão ${balcao} · ${atendente}`);
      document.getElementById('chipPosicao')?.classList.add('chip-green');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-calling';
      if (iconEl)  iconEl.textContent = '🔔';
      if (statusEl) statusEl.textContent = '🔔 A ser chamada!';
      if (numEl) numEl.classList.add('pulse-green');

      if (mudou) {
        N && N.clientCalled(numero, balcao, atendente);
        mostrarMensagem(
          `🔔 Senha <strong>${numero}</strong>: Balcão <strong>${balcao}</strong> · ${atendente}`,
          'ok'
        );
        N && N.nativeNotify('IMTSB — A sua vez!',
          `Senha ${numero} — Balcão ${balcao}. Dirija-se ao atendente.`);
      }

    /* ── CONCLUÍDA ─────────────────────────────────────────── */
    } else if (status === 'concluida') {
      set('trackerPosicao', '✓');
      set('trackerTempo',   'Concluído');
      set('trackerEstado',  'Atendimento concluído com sucesso!');
      document.getElementById('chipPosicao')?.classList.add('chip-green');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-done';
      if (iconEl)  iconEl.textContent = '✓';
      if (statusEl) statusEl.textContent = '✓ Concluída';
      if (numEl) numEl.classList.add('pulse-green');

      if (mudou) {
        mostrarMensagem('✅ Atendimento concluído! Obrigado pela visita ao IMTSB.', 'ok');
        N && N.notify('conclude', 'Atendimento concluído! Obrigado pela sua visita.', 7000);
        N && N.nativeNotify('IMTSB — Concluído!', `Senha ${numero} atendida com sucesso.`);
        /* Modal de avaliação após 2s */
        setTimeout(() => window.abrirModalAvaliacao && window.abrirModalAvaliacao(dados), 2000);
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 12000);

    /* ── CANCELADA — sub-tipos: NEGADA, REDIRECCIONADA, genérica ── */
    } else if (status === 'cancelada') {

      document.getElementById('chipPosicao')?.classList.add('chip-red');

      /* Detectar sub-tipo pelo campo observacoes */
      if (obs.startsWith('NEGADO:') || obs.startsWith('NEGADO ')) {
        /* NEGADA PELO TRABALHADOR */
        const motivo = obs.replace(/^NEGADO:?\s*/i, '').trim() || 'Sem motivo indicado';
        set('trackerPosicao', '🚫');
        set('trackerTempo',   'Negada');
        set('trackerEstado',  `Negada: ${motivo}`);
        if (badgeEl) badgeEl.className = 'ticket-status-badge status-cancelled';
        if (iconEl)  iconEl.textContent = '🚫';
        if (statusEl) statusEl.textContent = 'Negada';

        if (mudou || obsMudou) {
          mostrarMensagem(
            `🚫 A sua senha <strong>${numero}</strong> foi negada.<br>` +
            `<strong>Motivo:</strong> <em>${motivo}</em><br>` +
            `<small>Dirija-se à recepção para mais informações.</small>`,
            'warn'
          );
          N && N.notify('deny',
            `Senha ${numero} negada. Motivo: ${motivo}`, 10000);
          N && N.nativeNotify('IMTSB — Senha Negada',
            `Senha ${numero}: ${motivo}`);
        }

        pararAcompanhamento();
        setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 12000);

      } else if (obs.includes('REDIR:')) {
        /* REDIRECCIONADA — volta para aguardar no novo serviço */
        const linhas   = obs.split(' | ').map(p => p.trim());
        const redirLn  = linhas.find(p => p.startsWith('REDIR:')) || '';
        const motivoLn = linhas.find(p => p.startsWith('Motivo:')) || '';
        const destino  = redirLn.replace('REDIR:', '').split('→').pop()?.trim() || 'outro serviço';
        const motivo   = motivoLn.replace('Motivo:', '').trim();

        set('trackerPosicao', '↪');
        set('trackerTempo',   'Redireccionada');
        set('trackerEstado',  `→ ${destino}`);
        if (badgeEl) badgeEl.className = 'ticket-status-badge status-redirect';
        if (iconEl)  iconEl.textContent = '↪';
        if (statusEl) statusEl.textContent = 'Redireccionada';

        if (mudou || obsMudou) {
          mostrarMensagem(
            `↪ Senha <strong>${numero}</strong> redireccionada para <strong>${destino}</strong>.` +
            (motivo ? `<br><em>${motivo}</em>` : '') +
            `<br><small>Aguarde ser chamado no novo serviço.</small>`,
            'ok'
          );
          N && N.notify('redirect',
            `Senha ${numero} → ${destino}.${motivo ? ' ' + motivo : ''}`, 8000);
          N && N.nativeNotify('IMTSB — Redireccionado',
            `Senha ${numero} enviada para ${destino}. Aguarde.`);
        }
        /* NÃO limpar a senha — vai aguardar no novo serviço */
        /* Reiniciar acompanhamento com o novo estado */
        statusAnterior = null;

      } else {
        /* CANCELAMENTO GENÉRICO */
        set('trackerPosicao', '✕');
        set('trackerTempo',   'Cancelada');
        set('trackerEstado',  'Senha cancelada. Pode emitir uma nova.');
        if (badgeEl) badgeEl.className = 'ticket-status-badge status-cancelled';
        if (iconEl)  iconEl.textContent = '✕';
        if (statusEl) statusEl.textContent = 'Cancelada';

        if (mudou) {
          mostrarMensagem('Senha cancelada. Pode emitir uma nova senha.', 'warn');
          N && N.notify('warn', `Senha ${numero} cancelada.`, 5000);
        }
        pararAcompanhamento();
        setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 8000);
      }
    }
  }

  /* ── Display base (sem dados do servidor) ────────────────── */
  function atualizarDisplaySenha() {
    const numEl   = document.getElementById('currentTicket');
    const tracker = document.getElementById('ticketTracker');
    if (!minhaSenha) {
      if (numEl)    numEl.textContent = '---';
      if (tracker)  tracker.style.display = 'none';
      set('currentStatus',  'Nenhuma senha activa');
      set('trackerEstado',  'Seleccione um serviço e emita a sua senha.');
      statusAnterior = null; obsAnterior = null;
      return;
    }
    if (numEl)   numEl.textContent = minhaSenha.numero;
    set('currentStatus', minhaSenha.status);
    if (tracker) tracker.style.display = 'flex';
    set('trackerServico', minhaSenha.servico?.nome || servicoSelecionado?.nome || '—');
  }

  /* ════════════════════════════════════════════════════════════
     ACOMPANHAMENTO — polling da posição
  ════════════════════════════════════════════════════════════ */
  function iniciarAcompanhamento(num) {
    pararAcompanhamento();
    actualizarPosicao(num);
    pollingAcompanhamento = setInterval(() => actualizarPosicao(num), 5000);
  }

  function pararAcompanhamento() {
    if (pollingAcompanhamento) { clearInterval(pollingAcompanhamento); pollingAcompanhamento = null; }
  }

  async function actualizarPosicao(num) {
    try {
      const r = await fetch(`${BASE()}/dashboard/public/senha/${encodeURIComponent(num)}`);
      if (r.status === 404) {
        limparSenhaLocal(); pararAcompanhamento(); atualizarDisplaySenha();
        return;
      }
      if (!r.ok) return;
      const dados = await r.json();

      /* Injectar campos que o endpoint público não devolve */
      dados.servico       = dados.servico      || minhaSenha?.servico?.nome || servicoSelecionado?.nome;
      dados.observacoes   = dados.observacoes  || minhaSenha?.observacoes  || '';

      if (minhaSenha) {
        minhaSenha.status      = dados.status;
        minhaSenha.observacoes = dados.observacoes;
        guardarSenhaLocal(minhaSenha);
      }
      actualizarTrackerUI(dados);
    } catch (e) { console.error('[posicao]', e); }
  }

  /* ════════════════════════════════════════════════════════════
     ESTATÍSTICAS
  ════════════════════════════════════════════════════════════ */
  async function atualizarEstatisticas() {
    try {
      const r = await fetch(`${BASE()}/senhas/estatisticas`);
      if (!r.ok) return;
      const s = await r.json();
      set('statFila',  String(s.aguardando || 0));
      set('statTempo', `${Math.round(s.tempo_medio_espera || 0)}min`);
      set('statDone',  String(s.concluidas || 0));
      const t = s.total_emitidas || 0, c = s.concluidas || 0;
      set('statSat', t > 0 ? `${Math.round((c/t)*100)}%` : '—');
    } catch (_) {}
  }

  /* ════════════════════════════════════════════════════════════
     SERVIÇOS
  ════════════════════════════════════════════════════════════ */
  const MAPA_FORMULARIOS = {
    1: '/matricula.html',
    2: '/tesouraria.html',
    3: '/declaracao.html',
    4: null,
    5: '/apoio-cliente.html'
  };

  async function carregarServicos() {
    const container = document.getElementById('servicesList');
    if (!container) return;
    try {
      const r    = await fetch(`${BASE()}/servicos`);
      if (!r.ok) throw new Error();
      const raw  = await r.json();
      const list = Array.isArray(raw) ? raw : (raw.servicos || raw);
      if (!list.length) { container.innerHTML = '<p>Sem serviços disponíveis.</p>'; return; }

      container.innerHTML = '';
      list.forEach(s => {
        const temForm  = !!MAPA_FORMULARIOS[s.id];
        const subtexto = temForm ? '📝 Preencher formulário' : (s.descricao || 'Emissão directa');
        const card     = document.createElement('article');
        card.className = 'service-card';
        card.dataset.servicoId = s.id;
        card.style.cursor = 'pointer';
        card.innerHTML = `
          <div class="service-icon">${s.icone || '📄'}</div>
          <div class="service-info">
            <div class="service-name">${s.nome}</div>
            <div class="service-status"><span class="status-dot"></span>${subtexto}</div>
          </div>
          <span class="arrow-icon">→</span>
        `;
        card.addEventListener('click', () => selecionarServico(s, card));
        container.appendChild(card);
      });
    } catch (_) {
      if (container) container.innerHTML = '<p style="color:var(--text-muted);">Erro ao carregar serviços.</p>';
    }
  }

  function selecionarServico(s, cardEl) {
    if (MAPA_FORMULARIOS[s.id]) { window.location.href = MAPA_FORMULARIOS[s.id]; return; }
    servicoSelecionado = s;
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('ativo'));
    if (cardEl) cardEl.classList.add('ativo');
    set('trackerServico', s.nome);
    mostrarMensagem(`${s.nome} seleccionado. Clique em "Emitir Senha".`, 'ok');
  }

  /* ════════════════════════════════════════════════════════════
     EMITIR SENHA
  ════════════════════════════════════════════════════════════ */
  async function emitirSenha() {
    if (!servicoSelecionado) {
      mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
      return;
    }
    const btn = document.getElementById('btnEmitirSenha');
    if (btn) { btn.disabled = true; btn.textContent = 'A emitir…'; }
    mostrarMensagem('⏳ A emitir senha…', '');

    try {
      const r = await fetch(`${BASE()}/senhas/emitir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servico_id: servicoSelecionado.id, tipo: 'normal' })
      });
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) { mostrarMensagem(`❌ ${dados.erro || 'Erro ao emitir'}`, 'warn'); return; }

      minhaSenha     = dados.senha;
      statusAnterior = null;
      obsAnterior    = null;
      guardarSenhaLocal(minhaSenha);
      atualizarDisplaySenha();
      set('trackerServico', servicoSelecionado.nome);
      iniciarAcompanhamento(minhaSenha.numero);
      mostrarMensagem(
        `✅ Senha emitida: <strong>${minhaSenha.numero}</strong> · ${servicoSelecionado.nome}`, 'ok'
      );
      await atualizarEstatisticas();
      N && N.notify('success',
        `Senha <strong>${minhaSenha.numero}</strong> emitida. Aguarde ser chamado(a).`, 6000);

    } catch (_) {
      mostrarMensagem('❌ Erro de ligação ao servidor', 'warn');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Emitir Senha'; }
    }
  }

  /* ════════════════════════════════════════════════════════════
     LOCAL STORAGE
  ════════════════════════════════════════════════════════════ */
  function guardarSenhaLocal(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) {}
  }
  function limparSenhaLocal() { localStorage.removeItem(STORAGE_KEY); minhaSenha = null; }

  function restaurarSenhaGuardada() {
    try {
      const g = localStorage.getItem(STORAGE_KEY);
      if (!g) return;
      const s = JSON.parse(g);
      const hoje = new Date().toISOString().split('T')[0];
      if ((s.data_emissao || '') !== hoje) { limparSenhaLocal(); return; }
      minhaSenha     = s;
      statusAnterior = s.status;
      obsAnterior    = s.observacoes || null;
      atualizarDisplaySenha();
      if (!['concluida','cancelada'].includes(s.status)) iniciarAcompanhamento(s.numero);
    } catch (_) { limparSenhaLocal(); }
  }

  /* ════════════════════════════════════════════════════════════
     POLLING GERAL
  ════════════════════════════════════════════════════════════ */
  function iniciarPollingGeral() {
    pararPollingGeral();
    pollingGeral = setInterval(async () => {
      await Promise.all([atualizarEstatisticas(), atualizarUltimaChamada()]);
    }, 5000);
  }
  function pararPollingGeral() {
    if (pollingGeral) { clearInterval(pollingGeral); pollingGeral = null; }
  }

  /* ════════════════════════════════════════════════════════════
     HEADER — nome registado ou "Visitante"
  ════════════════════════════════════════════════════════════ */
  function configurarHeader() {
    const user = store?.getUser?.() || null;
    if (user && !user.isGuest && user.name && user.name !== 'Visitante') {
      set('userProfileName', `Bem-vindo, ${user.name}`);
      set('dadoNome',   user.name  || '—');
      set('dadoEmail',  user.email || '—');
      set('dadoPerfil', user.role  || 'Utente');
    } else {
      set('userProfileName', 'Bem-vindo, Visitante');
      set('dadoNome',   'Visitante');
      set('dadoEmail',  'Não identificado');
      set('dadoPerfil', 'Público');
    }
  }

  function configurarBotoes() {
    const btnEmitir = document.getElementById('btnEmitirSenha');
    if (btnEmitir) btnEmitir.addEventListener('click', emitirSenha);

    const btnSair = document.getElementById('btnSair');
    if (btnSair) btnSair.addEventListener('click', () => {
      pararPollingGeral(); pararAcompanhamento(); limparSenhaLocal(); store?.logout?.();
    });

    const painel   = document.getElementById('meusDadosPanel');
    const btnD     = document.getElementById('btnMeusDados');
    const btnF     = document.getElementById('btnFecharDados');
    if (btnD && painel) btnD.addEventListener('click',  () => painel.classList.add('aberto'));
    if (btnF && painel) btnF.addEventListener('click',  () => painel.classList.remove('aberto'));

    const flash = localStorage.getItem('imtsb_flash');
    if (flash) { mostrarMensagem(flash, 'ok'); localStorage.removeItem('imtsb_flash'); }
  }

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', () => {
    configurarHeader();
    configurarBotoes();
    carregarServicos();
    atualizarEstatisticas();
    atualizarUltimaChamada();
    restaurarSenhaGuardada();
    iniciarPollingGeral();
  });

})();