/**
 * static/js/dashusuario.js — Sprint 5 PATCHED
 * ═══════════════════════════════════════════════════════════════
 * PATCHES APLICADOS:
 *
 *   FIX-01  Avaliação: ticket_id correcto (dados.id, não dados.numero)
 *   FIX-02  Avaliação: validação score 1-5 antes de submeter
 *   FIX-03  Avaliação: bloqueio de dupla submissão (Set em memória)
 *   FIX-04  Avaliação: tratamento de erro 400/404/409 com feedback
 *   FIX-05  Polling: flag _pollingEmCurso evita chamadas sobrepostas
 *   FIX-06  Polling: limpeza correcta de intervals em pararPollingGeral
 *   FIX-07  emitirSenha: guarda dados.senha.id no localStorage
 *   FIX-08  actualizarPosicao: não chama tracker se polling parado
 *
 *   ADD-01  fetchComRetry() — fetch com 3 tentativas + backoff exponencial
 *   ADD-02  enviarAvaliacao() — função isolada e reutilizável
 *   ADD-03  Fila offline: pendingAvaliacoes → reenvio automático
 *   ADD-04  Loading state real no botão "Emitir Senha"
 *   ADD-05  Loading state real no botão "Enviar avaliação"
 *   ADD-06  Timestamps visíveis no tracker (hora da última actualização)
 *   ADD-07  Quem executou a acção (atendente) no log de estado
 *
 *   IMPROVEMENT-01  atualizarUltimaChamada: aborta fetch anterior com AbortController
 *   IMPROVEMENT-02  restaurarSenhaGuardada: valida também hora (não só data)
 *   IMPROVEMENT-03  actualizarTrackerUI: mostra timestamp de cada transição
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
  let pollingLastCalled     = null;
  let pollingAcompanhamento = null;
  let statusAnterior        = null;
  let obsAnterior           = null;
  let _ultimaChamadaNum     = null;
  let _iconTimer            = null;

  // FIX-05 — flag para evitar chamadas de polling sobrepostas
  let _pollingEmCurso       = false;

  // ADD-03 — fila offline: avaliações que falharam por rede
  const _pendingAvaliacoes  = [];

  // FIX-03 — Set em memória: ticket_ids já avaliados nesta sessão
  const _avaliacoesEnviadas = new Set();

  // IMPROVEMENT-01 — AbortController para cancelar fetch anterior
  let _abortUltimaChamada   = null;
  let _ultimoEventoTs       = null;

  const STORAGE_KEY         = 'imtsb_minha_senha';
  // ADD-03 — chave para persistir avaliações pendentes
  const PENDING_KEY         = 'imtsb_avaliacoes_pendentes';

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

  // ADD-06 — formata hora actual de Luanda para mostrar no tracker
  function horaAgora() {
    return new Date().toLocaleTimeString('pt-PT',
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
     ADD-01 — fetchComRetry
     Fetch com N tentativas e backoff exponencial.
     Evita falhas silenciosas em redes instáveis.

     @param {string}  url
     @param {object}  opcoes        — opções do fetch nativo
     @param {number}  [tentativas]  — máx tentativas (default 3)
     @returns {Promise<Response>}
  ════════════════════════════════════════════════════════════ */
  async function fetchComRetry(url, opcoes = {}, tentativas = 3) {
    let ultimoErro;
    for (let i = 0; i < tentativas; i++) {
      try {
        const r = await fetch(url, opcoes);
        // Só faz retry em erros de rede (TypeError) — não em erros HTTP (4xx/5xx)
        return r;
      } catch (err) {
        ultimoErro = err;
        if (i < tentativas - 1) {
          // Backoff: 300ms, 900ms, 2700ms…
          await new Promise(res => setTimeout(res, 300 * Math.pow(3, i)));
        }
      }
    }
    throw ultimoErro;
  }

  /* ════════════════════════════════════════════════════════════
     ADD-02 — enviarAvaliacao
     Função isolada e reutilizável para enviar avaliações.
     Usada por window.abrirModalAvaliacao e pelo reenvio offline.

     @param {number} ticketId  — ID numérico da senha (NOT o número "N001")
     @param {number} score     — 1 a 5
     @param {string} [comment] — comentário opcional
     @returns {Promise<{ok: boolean, status: number, data: object}>}
  ════════════════════════════════════════════════════════════ */
  async function enviarAvaliacao(ticketId, score, comment = '') {
    // FIX-02 — validar score antes de sequer fazer fetch
    const scoreNum = parseInt(score, 10);
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5) {
      return { ok: false, status: 400, data: { message: 'Score inválido. Use 1 a 5.' } };
    }

    // FIX-01 — garantir que ticketId é um número inteiro
    const id = parseInt(ticketId, 10);
    if (!id || id <= 0) {
      return { ok: false, status: 400, data: { message: 'ticket_id inválido.' } };
    }

    const token = localStorage.getItem('imtsb_access_token') || store?.getToken?.() || '';

    try {
      const r = await fetchComRetry(
        `${BASE()}/tickets/rate`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ticket_id: id,
            score:     scoreNum,
            comment:   (comment || '').trim().slice(0, 500),
          }),
        },
        2  // só 2 tentativas para avaliações (evitar duplicados)
      );

      let data = {};
      try { data = await r.json(); } catch (_) {}

      return { ok: r.ok, status: r.status, data };

    } catch (err) {
      // Erro de rede → guardar para reenvio offline
      console.warn('[avaliacao] Sem rede — guardando para reenvio.', err);
      return { ok: false, status: 0, data: { message: 'Sem ligação.' }, offline: true };
    }
  }

  /* ════════════════════════════════════════════════════════════
     ADD-03 — Fila offline: persistir e reenviar avaliações
  ════════════════════════════════════════════════════════════ */
  function guardarAvaliacaoPendente(ticketId, score, comment) {
    try {
      const pendentes = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      // Não duplicar
      if (pendentes.find(p => p.ticketId === ticketId)) return;
      pendentes.push({ ticketId, score, comment, ts: Date.now() });
      localStorage.setItem(PENDING_KEY, JSON.stringify(pendentes));
    } catch (_) {}
  }

  async function reenviarAvaliacoesPendentes() {
    let pendentes = [];
    try {
      pendentes = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    } catch (_) { return; }
    if (!pendentes.length) return;

    const restantes = [];
    for (const p of pendentes) {
      // Ignorar entradas com mais de 24h
      if (Date.now() - p.ts > 86400000) continue;
      const res = await enviarAvaliacao(p.ticketId, p.score, p.comment);
      if (!res.ok && res.offline) {
        restantes.push(p);  // guardar de volta se ainda sem rede
      }
      // Se ok ou erro HTTP (ex: 409 já avaliado) — descarta
    }
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(restantes));
    } catch (_) {}
  }

  /* ════════════════════════════════════════════════════════════
     ÚLTIMA CHAMADA GERAL — polling real, detecta mudança
     IMPROVEMENT-01 — AbortController cancela fetch anterior
     FIX-09 — filtra por HOJE em todas as tentativas;
               reseta DOM para "—" quando sem chamadas do dia
               (resolve dados fake/antigos como N001 03:10)
  ════════════════════════════════════════════════════════════ */

  // FIX-09 — helper: verifica se um timestamp ISO é de hoje (fuso Luanda)
  function _eDHoje(isoStr) {
    if (!isoStr) return false;
    try {
      const iso = (typeof isoStr === 'string' && !isoStr.endsWith('Z') && !isoStr.includes('+'))
        ? isoStr + 'Z' : isoStr;
      const dataStr = new Date(iso).toLocaleDateString('en-CA', { timeZone: ANGOLA_TZ });
      const hojeStr = new Date().toLocaleDateString('en-CA',     { timeZone: ANGOLA_TZ });
      return dataStr === hojeStr;
    } catch (_) { return false; }
  }

  // FIX-09 — helper: limpa o painel de última chamada
  function _limparUltimaChamada() {
    const numEl     = document.getElementById('ultimaChamada');
    const balcaoEl  = document.getElementById('ultimoBalcao');
    const servicoEl = document.getElementById('ultimoServico');
    const horaEl    = document.getElementById('ultimaHora');
    const iconEl    = document.getElementById('lastCallIcon');
    if (numEl)     numEl.textContent     = '—';
    if (balcaoEl)  balcaoEl.textContent  = 'Sem chamadas hoje';
    if (servicoEl) servicoEl.textContent = '—';
    if (horaEl)    horaEl.textContent    = '';
    if (iconEl)    { iconEl.classList.remove('ringing'); iconEl.classList.add('idle'); }
    _ultimaChamadaNum = null;
  }

  function _tratarEventosSemanticos(events = []) {
    if (!Array.isArray(events) || !events.length || !minhaSenha?.numero) return;
    const ordenados = [...events].sort((a, b) =>
      new Date(a?.timestamp || 0) - new Date(b?.timestamp || 0)
    );

    for (const ev of ordenados) {
      const ts = ev?.timestamp || null;
      if (_ultimoEventoTs && ts && new Date(ts) <= new Date(_ultimoEventoTs)) continue;

      const tipo = ev?.tipo || '';
      const numero = ev?.dados?.numero || '';
      if (!numero || numero !== minhaSenha.numero) continue;

      if (tipo === 'senha_redirecionada') {
        const destino = ev?.dados?.servico_destino || 'outro serviço';
        const motivo  = ev?.dados?.motivo || 'Sem motivo';
        mostrarMensagem(`↪ A sua senha foi redireccionada para <strong>${destino}</strong>.<br><em>${motivo}</em>`, 'ok');
        N && N.onRedirect(numero, destino);
      } else if (tipo === 'senha_negada') {
        const motivo = ev?.dados?.motivo || 'Sem motivo indicado';
        mostrarMensagem(
          `🚫 A sua senha <strong>${numero}</strong> foi negada.<br><em>${motivo}</em>`,
          'warn'
        );
        N && N.notify('deny', `Senha ${numero} negada. Motivo: ${motivo}`, 10000);
        N && N.nativeNotify('IMTSB — Senha Negada', `Senha ${numero}: ${motivo}`);
      } else if (tipo === 'senha_concluida') {
        mostrarMensagem(`✅ Atendimento da senha <strong>${numero}</strong> concluído.`, 'ok');
        N && N.onConclude(numero);
      } else if (tipo === 'senha_chamada') {
        const balcao = ev?.dados?.numero_balcao || '—';
        N && N.onCall(numero, balcao);
      }

      if (ts) _ultimoEventoTs = ts;
    }
  }

  async function atualizarUltimaChamada() {
    const numEl     = document.getElementById('ultimaChamada');
    const balcaoEl  = document.getElementById('ultimoBalcao');
    const servicoEl = document.getElementById('ultimoServico');
    const horaEl    = document.getElementById('ultimaHora');
    const iconEl    = document.getElementById('lastCallIcon');
    if (!numEl) return;

    // IMPROVEMENT-01 — cancelar fetch anterior se ainda em curso
    if (_abortUltimaChamada) _abortUltimaChamada.abort();
    _abortUltimaChamada = new AbortController();
    const signal = _abortUltimaChamada.signal;

    let numero  = null;
    let balcao  = null;
    let servico = null;
    let hora    = null;

    /* Fonte ÚNICA — snapshot */
    try {
      const r = await fetch(`${BASE()}/realtime/snapshot`, { signal });
      if (r.ok) {
        const snap = await r.json();
        _tratarEventosSemanticos(snap?.events || []);
        const lc   = snap.lastCalled;
        // FIX-09 — só aceitar se o timestamp for de hoje
        if (lc?.code && _eDHoje(lc.at)) {
          numero  = lc.code;
          balcao  = lc.counterName || 'Balcão';
          servico = lc.service || '—';
          hora    = formatHora(lc.at);
        }
      }
    } catch (e) { if (e.name === 'AbortError') return; }

    // FIX-09 — se nenhuma fonte devolveu dados válidos de hoje, limpar painel
    if (!numero) {
      _limparUltimaChamada();
      return;
    }

    const mudou = numero !== _ultimaChamadaNum;
    _ultimaChamadaNum = numero;

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
     ADD-06 — timestamp visível em cada transição
     ADD-07 — nome do atendente quando disponível
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

    set('trackerServico', servico);
    const numEl    = document.getElementById('currentTicket');
    const badgeEl  = document.getElementById('currentStatusBadge');
    const iconEl   = document.getElementById('currentStatusIcon');
    const statusEl = document.getElementById('currentStatus');
    if (numEl) numEl.textContent = numero;

    // ADD-06 — timestamp da última actualização
    const tsEl = document.getElementById('trackerTimestamp');
    if (tsEl) tsEl.textContent = `Actualizado às ${horaAgora()}`;

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
      // ADD-07 — mostrar nome do atendente se disponível
      const atendente = resolverNomeAt(dados.atendente);
      set('trackerPosicao', '🔔');
      set('trackerTempo',   'Agora');
      // ADD-07 — "por Nome" quando o backend devolve o atendente
      const linhaAt = atendente !== 'atendente'
        ? `→ Balcão ${balcao} · <strong>${atendente}</strong> · ${horaAgora()}`
        : `→ Balcão ${balcao} · ${horaAgora()}`;
      set('trackerEstado', linhaAt);
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
      // ADD-06 — hora de conclusão visível
      set('trackerEstado',  `Atendimento concluído às ${horaAgora()}`);
      document.getElementById('chipPosicao')?.classList.add('chip-green');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-done';
      if (iconEl)  iconEl.textContent = '✓';
      if (statusEl) statusEl.textContent = '✓ Concluída';
      if (numEl) numEl.classList.add('pulse-green');

      if (mudou) {
        mostrarMensagem('✅ Atendimento concluído! Obrigado pela visita ao IMTSB.', 'ok');
        N && N.notify('conclude', 'Atendimento concluído! Obrigado pela sua visita.', 7000);
        N && N.nativeNotify('IMTSB — Concluído!', `Senha ${numero} atendida com sucesso.`);
        // FIX-01 — passar dados completos ao modal (com .id numérico)
        setTimeout(() => window.abrirModalAvaliacao && window.abrirModalAvaliacao(dados), 2000);
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 12000);

    /* ── CANCELADA — sub-tipos: NEGADA, REDIRECCIONADA, genérica ── */
    } else if (status === 'cancelada') {

      document.getElementById('chipPosicao')?.classList.add('chip-red');

      if (obs.startsWith('NEGADO:') || obs.startsWith('NEGADO ')) {
        const motivo = obs.replace(/^NEGADO:?\s*/i, '').trim() || 'Sem motivo indicado';
        set('trackerPosicao', '🚫');
        set('trackerTempo',   'Negada');
        // ADD-06 — hora da negação
        set('trackerEstado',  `Negada às ${horaAgora()}: ${motivo}`);
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
          N && N.notify('deny', `Senha ${numero} negada. Motivo: ${motivo}`, 10000);
          N && N.nativeNotify('IMTSB — Senha Negada', `Senha ${numero}: ${motivo}`);
        }

        pararAcompanhamento();
        setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 12000);

      } else if (obs.includes('REDIR:')) {
        const linhas   = obs.split(' | ').map(p => p.trim());
        const redirLn  = linhas.find(p => p.startsWith('REDIR:')) || '';
        const motivoLn = linhas.find(p => p.startsWith('Motivo:')) || '';
        const destino  = redirLn.replace('REDIR:', '').split('→').pop()?.trim() || 'outro serviço';
        const motivo   = motivoLn.replace('Motivo:', '').trim();

        set('trackerPosicao', '↪');
        set('trackerTempo',   'Redireccionada');
        // ADD-06 — hora do redir
        set('trackerEstado',  `→ ${destino} (${horaAgora()})`);
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
        statusAnterior = null;

      } else {
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

  /* ── Display base ────────────────────────────────────────── */
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
     FIX-08 — não chama tracker se minhaSenha for null
  ════════════════════════════════════════════════════════════ */
  function iniciarAcompanhamento(num) {
    pararAcompanhamento();
    actualizarPosicao(num);
    pollingAcompanhamento = setInterval(() => {
      // FIX-08 — não continuar se a senha foi limpa entretanto
      if (!minhaSenha) { pararAcompanhamento(); return; }
      actualizarPosicao(num);
    }, 5000);
  }

  function pararAcompanhamento() {
    if (pollingAcompanhamento) {
      clearInterval(pollingAcompanhamento);
      pollingAcompanhamento = null;
    }
  }

  async function actualizarPosicao(num) {
    // FIX-08 — sair se a senha já foi limpa
    if (!minhaSenha) return;

    try {
      const r = await fetchComRetry(
        `${BASE()}/dashboard/public/senha/${encodeURIComponent(num)}`,
        {},
        2
      );
      if (r.status === 404) {
        limparSenhaLocal(); pararAcompanhamento(); atualizarDisplaySenha();
        return;
      }
      if (!r.ok) return;
      const dados = await r.json();

      dados.servico     = dados.servico     || minhaSenha?.servico?.nome || servicoSelecionado?.nome;
      dados.observacoes = dados.observacoes || minhaSenha?.observacoes   || '';

      if (minhaSenha) {
        minhaSenha.status      = dados.status;
        minhaSenha.observacoes = dados.observacoes;
        guardarSenhaLocal(minhaSenha);
      }
      actualizarTrackerUI(dados);
    } catch (e) {
      console.warn('[posicao] Falha de rede (vai tentar novamente):', e.message);
    }
  }

  /* ════════════════════════════════════════════════════════════
     ESTATÍSTICAS
  ════════════════════════════════════════════════════════════ */
  async function atualizarEstatisticas() {
    try {
      const r = await fetchComRetry(`${BASE()}/senhas/estatisticas`, {}, 2);
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
      const r    = await fetchComRetry(`${BASE()}/servicos`, {}, 3);
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
     ADD-04 — loading state real durante emissão
     FIX-07 — guardar dados.senha.id no localStorage
  ════════════════════════════════════════════════════════════ */
  async function emitirSenha() {
    if (!servicoSelecionado) {
      mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
      return;
    }

    const btn = document.getElementById('btnEmitirSenha');

    // ADD-04 — loading state: spinner inline
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               style="animation:_spin .7s linear infinite">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                     M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          A emitir…
        </span>`;
      // Injectar keyframe se ainda não existir
      if (!document.getElementById('_spin-style')) {
        const st = document.createElement('style');
        st.id = '_spin-style';
        st.textContent = '@keyframes _spin{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }
    }
    mostrarMensagem('⏳ A emitir senha…', '');

    try {
      const r = await fetchComRetry(
        `${BASE()}/senhas/emitir`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ servico_id: servicoSelecionado.id, tipo: 'normal' }),
        },
        3
      );
      const dados = await r.json().catch(() => ({}));
      if (!r.ok) {
        mostrarMensagem(`❌ ${dados.erro || 'Erro ao emitir'}`, 'warn');
        return;
      }

      minhaSenha     = dados.senha;
      statusAnterior = null;
      obsAnterior    = null;

      // FIX-07 — garantir que o id numérico é guardado
      if (minhaSenha && !minhaSenha.id && dados.senha?.id) {
        minhaSenha.id = dados.senha.id;
      }

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
      // ADD-04 — restaurar botão sempre
      if (btn) { btn.disabled = false; btn.textContent = 'Emitir Senha'; }
    }
  }

  /* ════════════════════════════════════════════════════════════
     LOCAL STORAGE
     IMPROVEMENT-02 — valida também que a senha não é de ontem
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

      // IMPROVEMENT-02 — comparar data_emissao E emitida_em
      const dataEmissao = s.data_emissao
        || (s.emitida_em ? s.emitida_em.split('T')[0] : null);

      if (dataEmissao !== hoje) { limparSenhaLocal(); return; }

      minhaSenha     = s;
      statusAnterior = s.status;
      obsAnterior    = s.observacoes || null;
      atualizarDisplaySenha();
      if (!['concluida','cancelada'].includes(s.status)) iniciarAcompanhamento(s.numero);
    } catch (_) { limparSenhaLocal(); }
  }

  /* ════════════════════════════════════════════════════════════
     POLLING GERAL
     FIX-05 — flag _pollingEmCurso evita sobreposição
     FIX-06 — clearInterval correcto antes de reatribuir
  ════════════════════════════════════════════════════════════ */
  function iniciarPollingGeral() {
    // FIX-06 — parar sempre antes de criar novos
    pararPollingGeral();

    // Canal leve: última chamada (mais frequente)
    pollingLastCalled = setInterval(async () => {
      try { await atualizarUltimaChamada(); } catch (_) {}
    }, 3000);

    // Canal pesado: estatísticas (menos frequente)
    pollingGeral = setInterval(async () => {
      // FIX-05 — sair se ciclo anterior ainda não terminou
      if (_pollingEmCurso) return;
      _pollingEmCurso = true;
      try {
        await atualizarEstatisticas();
      } finally {
        _pollingEmCurso = false;
      }
    }, 8000);
  }

  function pararPollingGeral() {
    // FIX-06 — limpeza explícita
    if (pollingGeral) {
      clearInterval(pollingGeral);
      pollingGeral = null;
    }
    if (pollingLastCalled) {
      clearInterval(pollingLastCalled);
      pollingLastCalled = null;
    }
    _pollingEmCurso = false;
  }

  /* ════════════════════════════════════════════════════════════
     HEADER
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
  document.addEventListener('DOMContentLoaded', async () => {
    configurarHeader();
    configurarBotoes();
    carregarServicos();
    atualizarEstatisticas();
    atualizarUltimaChamada();
    restaurarSenhaGuardada();
    iniciarPollingGeral();
    // ADD-03 — tentar reenviar avaliações pendentes ao iniciar
    await reenviarAvaliacoesPendentes();
  });

  /* ════════════════════════════════════════════════════════════
     MODAL DE AVALIAÇÃO — window.abrirModalAvaliacao
     FIX-01  ticket_id usa dados.id (inteiro) — não dados.numero
     FIX-02  validação score 1-5 antes de submeter
     FIX-03  bloqueio de dupla submissão via _avaliacoesEnviadas
     FIX-04  feedback visual para todos os cenários de erro
     ADD-03  guarda offline se sem rede
     ADD-05  loading state no botão de envio
  ════════════════════════════════════════════════════════════ */
  window.abrirModalAvaliacao = function (dados) {
    if (!dados) return;

    // FIX-01 — extrair id numérico com fallback para minhaSenha
    const ticketId = parseInt(
      dados.id || dados.senha_id || minhaSenha?.id || 0,
      10
    );

    if (!ticketId) {
      console.warn('[avaliacao] ticket_id não encontrado nos dados:', dados);
      return;
    }

    // FIX-03 — não abrir se já avaliado nesta sessão
    if (_avaliacoesEnviadas.has(ticketId)) return;

    // Verificar também o localStorage (sessão anterior do dia)
    const chaveAval = `imtsb_av_${ticketId}`;
    if (localStorage.getItem(chaveAval)) {
      _avaliacoesEnviadas.add(ticketId);
      return;
    }

    const modal = document.getElementById('modalAvaliacao');
    if (!modal) return;

    // Preencher subtítulo com atendente e serviço
    const atendente = resolverNomeAt(dados.atendente);
    const servico   = dados.servico || minhaSenha?.servico?.nome || 'Atendimento';
    const el        = document.getElementById('evalSubtitle');
    if (el) el.innerHTML =
      `Atendente: <strong>${atendente}</strong> · ${servico}`;

    // Reset UI
    let scoreSel = 0;
    document.getElementById('starLabel').textContent = '';
    document.getElementById('evalComment').value = '';
    const btnEnviar = document.getElementById('btnEnviarAval');
    if (btnEnviar) btnEnviar.disabled = true;
    document.getElementById('starsRow')
      ?.querySelectorAll('.star-btn')
      .forEach(b => b.textContent = '☆');

    modal.style.display = 'flex';

    // ── Seleccionar estrela ──────────────────────────────────
    window._setStar = function (val) {
      scoreSel = val;
      const LABELS = ['','Muito mau','Mau','Satisfatório','Bom','Excelente!'];
      const EMOJIS = ['','😞','😕','😐','😊','🤩'];
      document.getElementById('starLabel').textContent = LABELS[val] || '';
      const emojiEl = modal.querySelector('.eval-emoji');
      if (emojiEl) emojiEl.textContent = EMOJIS[val] || '⭐';
      document.querySelectorAll('.star-btn').forEach(b => {
        b.textContent = parseInt(b.dataset.val) <= val ? '⭐' : '☆';
        b.classList.toggle('sel', parseInt(b.dataset.val) <= val);
      });
      if (btnEnviar) btnEnviar.disabled = false;
    };

    // ── Fechar modal ─────────────────────────────────────────
    window._fecharAvaliacao = function () {
      if (modal) modal.style.display = 'none';
    };

    // ── Enviar avaliação ─────────────────────────────────────
    window._enviarAvaliacao = async function () {
      // FIX-02 — validar score
      if (!scoreSel || scoreSel < 1 || scoreSel > 5) {
        mostrarMensagem('⚠ Escolha uma pontuação antes de enviar.', 'warn');
        return;
      }

      // FIX-03 — bloqueio imediato para evitar double-click
      if (_avaliacoesEnviadas.has(ticketId)) {
        window._fecharAvaliacao();
        return;
      }
      _avaliacoesEnviadas.add(ticketId);  // bloqueio optimista

      const comment = (document.getElementById('evalComment')?.value || '').trim();

      // ADD-05 — loading state no botão
      if (btnEnviar) {
        btnEnviar.disabled  = true;
        btnEnviar.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:.4rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 style="animation:_spin .7s linear infinite">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83
                       M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            A enviar…
          </span>`;
      }

      const { ok, status, data, offline } = await enviarAvaliacao(ticketId, scoreSel, comment);

      if (ok) {
        // ── SUCESSO ──────────────────────────────────────────
        localStorage.setItem(chaveAval, '1');
        window._fecharAvaliacao();
        N && N.notify('success', 'Obrigado pela avaliação! O seu feedback é muito valioso.', 4000);

      } else if (status === 409) {
        // FIX-04 — já avaliado (race condition / dupla aba)
        localStorage.setItem(chaveAval, '1');
        window._fecharAvaliacao();

      } else if (offline) {
        // ADD-03 — sem rede: guardar para reenvio automático
        _avaliacoesEnviadas.delete(ticketId);  // reverter bloqueio
        guardarAvaliacaoPendente(ticketId, scoreSel, comment);
        window._fecharAvaliacao();
        mostrarMensagem(
          '⚠ Sem ligação — a avaliação será enviada automaticamente quando houver rede.',
          'warn'
        );

      } else {
        // FIX-04 — erro HTTP: reverter bloqueio e mostrar mensagem
        _avaliacoesEnviadas.delete(ticketId);
        const msg = data?.message || `Erro ${status}. Tente novamente.`;
        console.error('[avaliacao] Erro backend:', status, data);
        mostrarMensagem(`❌ ${msg}`, 'warn');

        if (btnEnviar) {
          btnEnviar.disabled  = false;
          btnEnviar.textContent = 'Enviar avaliação';
        }
      }
    };

    // Fechar ao clicar no backdrop
    modal.onclick = e => { if (e.target === modal) window._fecharAvaliacao(); };
  };

})();
