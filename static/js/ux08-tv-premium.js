/**
 * static/js/ux08-tv-premium.js
 * ═══════════════════════════════════════════════════════════════
 * UX-08 — TV Display Premium
 *
 * FUNCIONALIDADES:
 *   • Flash overlay de chamada (full-screen, 3s)
 *   • Web Speech API em Português (PT-PT / PT-BR)
 *   • Animação flip no número da última chamada
 *   • Queue transitions suaves (sem flicker)
 *   • Prioridade com efeito especial (glow dourado)
 *   • Sounds distintos por tipo de evento
 *   • Botões: Som | Voz | Fullscreen
 *   • Polling adaptativo (4s em foco, 15s em background)
 *
 * SUBSTITUÍ o script inline de tv.html.
 * Adicionar na tv.html antes de </body>:
 *   <script src="/static/js/ux08-tv-premium.js"></script>
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ════════════════════════════════════════════════════════════
     CONFIG
  ════════════════════════════════════════════════════════════ */
  const CFG = {
    POLLING_ACTIVO:     4000,
    POLLING_BACKGROUND: 20000,
    TZ:                 'Africa/Luanda',
    MAX_FILA:           12,
    FLASH_DURACAO:      3800,   // ms que o flash fica visível
    SOUND_ENABLED:      true,
    SPEECH_ENABLED:     true,
    SPEECH_LANG:        'pt-PT',
    SPEECH_RATE:        0.82,
    SPEECH_PITCH:       1.05,
    SPEECH_VOLUME:      0.95,
  };

  /* ════════════════════════════════════════════════════════════
     CSS PREMIUM — injectado no <head>
  ════════════════════════════════════════════════════════════ */
  const CSS = `
    /* ── Flash overlay ────────────────────────────────────── */
    #tv-flash {
      position: fixed;
      inset: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.35s ease;
      background: linear-gradient(135deg, #2a1008 0%, #5c3418 50%, #2a1008 100%);
    }

    #tv-flash.tv-flash-show {
      opacity: 1;
      pointer-events: auto;
    }

    #tv-flash.tv-flash-priority {
      background: linear-gradient(135deg, #3d2600 0%, #7c4e00 50%, #3d2600 100%);
    }

    .tv-flash-inner {
      text-align: center;
      color: #fff;
      padding: 2rem;
      animation: tvFlashEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes tvFlashEnter {
      from { transform: scale(0.82); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }

    .tv-flash-icon {
      font-size: 4.5rem;
      animation: tvRing 0.45s ease-in-out infinite alternate;
      display: block;
      margin-bottom: 1rem;
    }

    @keyframes tvRing {
      from { transform: rotate(-16deg) scale(1); }
      to   { transform: rotate(16deg)  scale(1.08); }
    }

    .tv-flash-label {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: .18em;
      opacity: .65;
      margin-bottom: .75rem;
      font-weight: 700;
    }

    .tv-flash-number {
      font-family: 'Poppins', sans-serif;
      font-size: clamp(4rem, 18vw, 9rem);
      font-weight: 900;
      line-height: 1;
      color: #c4a164;
      text-shadow: 0 0 80px rgba(196, 161, 100, .45);
      margin-bottom: 1rem;
    }

    .tv-flash-priority .tv-flash-number {
      color: #fbbf24;
      text-shadow: 0 0 80px rgba(251, 191, 36, .5);
    }

    .tv-flash-balcao {
      font-family: 'Poppins', sans-serif;
      font-size: clamp(1.4rem, 4vw, 2.2rem);
      font-weight: 700;
      color: rgba(255,255,255,.88);
      margin-bottom: .4rem;
    }

    .tv-flash-service {
      font-size: clamp(.9rem, 2.5vw, 1.3rem);
      opacity: .7;
    }

    /* ── Número flip no banner ────────────────────────────── */
    .lc-num-flip {
      animation: tvNumFlip 0.45s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    @keyframes tvNumFlip {
      0%  { transform: rotateX(-90deg) scale(0.85); opacity: 0; }
      60% { transform: rotateX(8deg)   scale(1.05); opacity: 1; }
      100%{ transform: rotateX(0)      scale(1);    opacity: 1; }
    }

    .lc-num { perspective: 800px; display: inline-block; }

    /* ── Prioridade glow ──────────────────────────────────── */
    .tv-priority-glow {
      animation: tvGoldenGlow 2.5s ease-in-out infinite alternate !important;
    }

    @keyframes tvGoldenGlow {
      from { text-shadow: 0 0 10px rgba(251,191,36,0); }
      to   { text-shadow: 0 0 30px rgba(251,191,36,.6), 0 0 60px rgba(251,191,36,.3); }
    }

    /* ── Attending card entrada ───────────────────────────── */
    .attending-card {
      animation: tvCardEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) both !important;
    }

    @keyframes tvCardEnter {
      from { opacity: 0; transform: translateX(-16px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    /* ── Queue row entrada ────────────────────────────────── */
    .queue-row-enter {
      animation: tvRowEnter 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes tvRowEnter {
      from { opacity: 0; transform: translateX(12px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    /* ── Next-up breath ───────────────────────────────────── */
    .queue-row.next-up {
      animation: tvBreath 3s ease-in-out infinite !important;
    }

    @keyframes tvBreath {
      0%, 100%  { box-shadow: 0 0 0 0 rgba(107,66,38,0); }
      50%       { box-shadow: 0 0 0 4px rgba(107,66,38,.2); }
    }

    /* ── Controls bar ─────────────────────────────────────── */
    #tv-controls {
      position: fixed;
      bottom: 1.2rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      gap: .5rem;
      background: rgba(0,0,0,.55);
      backdrop-filter: blur(12px);
      border-radius: 50px;
      padding: .4rem .55rem;
      border: 1px solid rgba(255,255,255,.1);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    body:hover #tv-controls,
    #tv-controls:focus-within {
      opacity: 1;
    }

    .tv-ctrl-btn {
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.15);
      color: #fff;
      padding: .42rem .85rem;
      border-radius: 30px;
      font-size: .78rem;
      font-weight: 600;
      cursor: pointer;
      transition: background .18s;
      white-space: nowrap;
      -webkit-tap-highlight-color: transparent;
    }

    .tv-ctrl-btn:hover { background: rgba(255,255,255,.22); }

    .tv-ctrl-btn.active {
      background: rgba(107,66,38,.6);
      border-color: rgba(191,151,118,.4);
    }

    .tv-ctrl-btn.muted {
      background: rgba(185,28,28,.4);
      border-color: rgba(220,38,38,.4);
    }

    /* ── Connectivity pill ────────────────────────────────── */
    #tv-conn {
      position: fixed;
      top: .8rem;
      right: 1rem;
      z-index: 9998;
      font-size: .7rem;
      font-weight: 700;
      padding: .25rem .7rem;
      border-radius: 20px;
      transition: all .3s ease;
    }

    #tv-conn.online  {
      background: rgba(34,197,94,.18);
      border: 1px solid rgba(34,197,94,.35);
      color: #4ade80;
    }

    #tv-conn.offline {
      background: rgba(239,68,68,.2);
      border: 1px solid rgba(239,68,68,.4);
      color: #fca5a5;
    }

    #tv-conn.connecting {
      background: rgba(245,158,11,.18);
      border: 1px solid rgba(245,158,11,.35);
      color: #fcd34d;
    }
  `;

  /* ════════════════════════════════════════════════════════════
     ESTADO
  ════════════════════════════════════════════════════════════ */
  let _ultimaNum   = null;
  let _audioCtx    = null;
  let _soundMuted  = false;
  let _speechMuted = false;
  let _voicePT     = null;
  let _alertaFila  = false;
  let _flashTimer  = null;
  let _pollingTimer = null;
  let _lastOk      = Date.now();

  const TZ  = CFG.TZ;
  const MAX = CFG.MAX_FILA;

  /* ════════════════════════════════════════════════════════════
     INJECTAR CSS + ELEMENTOS
  ════════════════════════════════════════════════════════════ */

  function _setup() {
    /* CSS */
    if (!document.getElementById('ux08-styles')) {
      const s = document.createElement('style');
      s.id = 'ux08-styles';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    /* Flash overlay */
    if (!document.getElementById('tv-flash')) {
      const flash = document.createElement('div');
      flash.id = 'tv-flash';
      flash.innerHTML = `
        <div class="tv-flash-inner">
          <span class="tv-flash-icon" id="tvFlashIcon">🔔</span>
          <div class="tv-flash-label" id="tvFlashLabel">Chamada</div>
          <div class="tv-flash-number" id="tvFlashNumber">—</div>
          <div class="tv-flash-balcao" id="tvFlashBalcao"></div>
          <div class="tv-flash-service" id="tvFlashService"></div>
        </div>`;
      document.body.appendChild(flash);
    }

    /* Controls bar */
    if (!document.getElementById('tv-controls')) {
      const ctrl = document.createElement('div');
      ctrl.id = 'tv-controls';
      ctrl.innerHTML = `
        <button class="tv-ctrl-btn active" id="tvBtnSound"   onclick="tvToggleSound()">🔔 Som</button>
        <button class="tv-ctrl-btn active" id="tvBtnSpeech"  onclick="tvToggleSpeech()">🗣 Voz</button>
        <button class="tv-ctrl-btn"        id="tvBtnFullscreen" onclick="tvToggleFullscreen()">⛶ Ecrã Cheio</button>
      `;
      document.body.appendChild(ctrl);
    }

    /* Connectivity pill */
    if (!document.getElementById('tv-conn')) {
      const conn = document.createElement('div');
      conn.id = 'tv-conn';
      conn.className = 'online';
      conn.textContent = '● Ligado';
      document.body.appendChild(conn);
    }
  }

  /* ════════════════════════════════════════════════════════════
     BASE URL
  ════════════════════════════════════════════════════════════ */
  function _baseUrl() {
    const { protocol, hostname, port } = window.location;
    if (port === '5000') return '/api';
    return `${protocol}//${hostname}:5000/api`;
  }

  /* ════════════════════════════════════════════════════════════
     RELÓGIO
  ════════════════════════════════════════════════════════════ */
  function _relogio() {
    const el = document.getElementById('clock');
    if (el) {
      el.textContent = new Date().toLocaleTimeString('pt-PT', { timeZone: TZ });
    }
    setTimeout(_relogio, 1000);
  }

  /* ════════════════════════════════════════════════════════════
     ÁUDIO — Web Audio API
  ════════════════════════════════════════════════════════════ */
  function _ctx() {
    if (!_audioCtx) {
      try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) { return null; }
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
    return _audioCtx;
  }

  ['click', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => _ctx(), { once: true, passive: true })
  );

  /**
   * Toca sequência de tons.
   * @param {Array<{f,d,g,type}>} tons
   * @param {number} [delay=0]
   */
  function _tocar(tons, delay) {
    if (_soundMuted) return;
    const ctx = _ctx();
    if (!ctx) return;
    let t = ctx.currentTime + 0.02 + (delay || 0);

    tons.forEach(({ f, d = .12, g = 0.26, type = 'sine' }) => {
      try {
        const o = ctx.createOscillator();
        const v = ctx.createGain();
        const bq = ctx.createBiquadFilter();
        bq.type = 'lowpass';
        bq.frequency.value = 3200;
        o.connect(bq); bq.connect(v); v.connect(ctx.destination);
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        v.gain.setValueAtTime(g, t);
        v.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.start(t); o.stop(t + d + .05);
        t += d;
      } catch (_) {}
    });
  }

  /* Sons por tipo de evento */
  const SOUNDS = {
    normal: [
      { f: 659, d: .10, g: .28 },
      { f: 784, d: .10, g: .26 },
      { f: 988, d: .10, g: .26 },
      { f: 784, d: .09, g: .20 },
      { f: 988, d: .22, g: .22 },
    ],
    priority: [
      { f: 880,  d: .07, g: .30, type: 'triangle' },
      { f: 1100, d: .07, g: .30, type: 'triangle' },
      { f: 1320, d: .07, g: .28, type: 'triangle' },
      { f: 1100, d: .07, g: .24, type: 'triangle' },
      { f: 1320, d: .24, g: .28, type: 'triangle' },
    ],
    fila: [
      { f: 440, d: .18, g: .22 },
      { f: 392, d: .18, g: .20 },
      { f: 349, d: .26, g: .18 },
    ],
  };

  /* ════════════════════════════════════════════════════════════
     SPEECH — Web Speech API
  ════════════════════════════════════════════════════════════ */

  function _initVoice() {
    if (!window.speechSynthesis) return;

    function _selectVoice() {
      const voices = speechSynthesis.getVoices();
      _voicePT = voices.find(v => v.lang === 'pt-PT')
        || voices.find(v => v.lang === 'pt-BR')
        || voices.find(v => v.lang.startsWith('pt'))
        || null;
    }

    _selectVoice();
    speechSynthesis.onvoiceschanged = _selectVoice;
  }

  function _falar(texto) {
    if (_speechMuted || !window.speechSynthesis || !texto) return;

    try {
      speechSynthesis.cancel();

      const utt   = new SpeechSynthesisUtterance(texto);
      utt.lang    = CFG.SPEECH_LANG;
      utt.rate    = CFG.SPEECH_RATE;
      utt.pitch   = CFG.SPEECH_PITCH;
      utt.volume  = CFG.SPEECH_VOLUME;
      if (_voicePT) utt.voice = _voicePT;

      speechSynthesis.speak(utt);
    } catch (_) {}
  }

  /* ════════════════════════════════════════════════════════════
     FLASH OVERLAY — anúncio de chamada
  ════════════════════════════════════════════════════════════ */

  function _mostrarFlash(numero, balcao, servico, isPrioritaria) {
    const el     = document.getElementById('tv-flash');
    const elNum  = document.getElementById('tvFlashNumber');
    const elBal  = document.getElementById('tvFlashBalcao');
    const elServ = document.getElementById('tvFlashService');
    const elIcon = document.getElementById('tvFlashIcon');
    const elLbl  = document.getElementById('tvFlashLabel');
    if (!el) return;

    /* Popular */
    if (elNum)  elNum.textContent  = numero  || '—';
    if (elBal)  elBal.textContent  = balcao  ? `Balcão ${balcao}` : '';
    if (elServ) elServ.textContent = servico || '';
    if (elIcon) elIcon.textContent = isPrioritaria ? '⚡' : '🔔';
    if (elLbl)  elLbl.textContent  = isPrioritaria ? '⭐ Chamada Prioritária' : 'Chamada';

    el.classList.toggle('tv-flash-priority', isPrioritaria);

    /* Mostrar */
    el.classList.add('tv-flash-show');

    /* Esconder após FLASH_DURACAO */
    clearTimeout(_flashTimer);
    _flashTimer = setTimeout(() => {
      el.style.transition = 'opacity 0.6s ease';
      el.style.opacity    = '0';
      setTimeout(() => {
        el.classList.remove('tv-flash-show');
        el.style.transition = '';
        el.style.opacity    = '';
      }, 650);
    }, CFG.FLASH_DURACAO);
  }

  /* ════════════════════════════════════════════════════════════
     ANIMAÇÃO DO NÚMERO (last called)
  ════════════════════════════════════════════════════════════ */

  let _iconTimer = null;

  function _animarNovaChamada(numero, balcao, servico, hora, isPrioritaria) {
    const nEl   = document.getElementById('lcNumero');
    const bEl   = document.getElementById('lcBalcao');
    const sEl   = document.getElementById('lcServico');
    const hEl   = document.getElementById('lcHora');
    const iEl   = document.getElementById('lcIcon');
    const evEl  = document.getElementById('lcEventLabel');

    /* Flip animation no número */
    if (nEl) {
      nEl.classList.remove('lc-num-flip', 'tv-priority-glow');
      void nEl.offsetWidth;
      nEl.textContent = numero;
      nEl.classList.add('lc-num-flip');
      if (isPrioritaria) nEl.classList.add('tv-priority-glow');
      setTimeout(() => nEl.classList.remove('lc-num-flip'), 600);
    }

    if (bEl) bEl.textContent  = balcao  ? `Balcão ${balcao}`  : 'A ser chamado';
    if (sEl) sEl.textContent  = servico || '—';
    if (hEl) hEl.textContent  = hora    ? `Chamado às ${hora}` : '';

    if (iEl) {
      iEl.textContent = isPrioritaria ? '⚡' : '🔔';
      iEl.classList.remove('idle');
      iEl.classList.add('ringing');
      clearTimeout(_iconTimer);
      _iconTimer = setTimeout(() => {
        iEl.classList.remove('ringing');
        iEl.classList.add('idle');
      }, 8000);
    }

    if (evEl) {
      evEl.textContent = isPrioritaria ? 'PRIORITÁRIA' : 'CHAMADA';
      evEl.className   = `lc-event-label ${isPrioritaria ? 'amber' : 'green'}`;
    }

    /* Flash overlay */
    _mostrarFlash(numero, balcao, servico, isPrioritaria);

    /* Som */
    _tocar(isPrioritaria ? SOUNDS.priority : SOUNDS.normal);
    /* Segunda voz para prioridade (acorde) */
    if (isPrioritaria) {
      _tocar([
        { f: 660, d: .07, g: .16 },
        { f: 825, d: .07, g: .16 },
        { f: 990, d: .28, g: .18 },
      ], 0.04);
    }

    /* Voz */
    const textoVoz = isPrioritaria
      ? `Senha ${numero}, atendimento prioritário — ${balcao ? 'Balcão ' + balcao : ''}. ${servico || ''}`
      : `Senha ${numero} — ${balcao ? 'Balcão ' + balcao : ''}. ${servico || ''}`;
    setTimeout(() => _falar(textoVoz), 400);
  }

  /* ════════════════════════════════════════════════════════════
     RENDER — Em Atendimento
  ════════════════════════════════════════════════════════════ */

  function _renderAtendendo(lista) {
    const el = document.getElementById('attendingList');
    if (!el) return;

    if (!lista?.length) {
      el.innerHTML = '<p class="empty-state">Nenhum atendimento em curso</p>';
      return;
    }

    el.innerHTML = lista.map((it, i) => {
      const isPrio = it.tipo === 'prioritaria';
      return `
        <div class="attending-card" style="animation-delay:${i * 60}ms">
          <div class="att-number ${isPrio ? 'priority' : 'normal'} ${isPrio ? 'tv-priority-glow' : ''}">
            ${it.numero}
          </div>
          <div>
            <div class="att-service">${it.servico || 'Serviço'}</div>
            <div class="att-balcao">Balcão ${it.balcao || '–'}</div>
            <span class="tipo-badge ${isPrio ? 'tipo-prioritaria' : 'tipo-normal'}">
              ${isPrio ? '⚡ Prioritária' : 'Normal'}
            </span>
          </div>
          <div class="att-dot"></div>
        </div>`;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════
     RENDER — Fila de espera (smooth update)
  ════════════════════════════════════════════════════════════ */

  let _filaAnterior = [];

  function _renderFila(lista, total) {
    const lEl = document.getElementById('queueList');
    const tEl = document.getElementById('totalWaiting');
    if (tEl) tEl.textContent = total || 0;

    if (!lEl) return;

    if (!lista?.length) {
      lEl.innerHTML = '<p class="empty-state">Fila vazia — sem senhas aguardando</p>';
      _filaAnterior = [];
      _alertaFila   = false;
      return;
    }

    /* IDs anteriores para detectar novos */
    const idsAnteriores = new Set(_filaAnterior.map(s => s.numero));

    lEl.innerHTML = lista.slice(0, MAX).map((it, i) => {
      const isPrio  = it.tipo === 'prioritaria';
      const isNova  = !idsAnteriores.has(it.numero);
      const tempo   = it.tempo_espera_estimado > 0 ? `~${it.tempo_espera_estimado}min` : '—';
      const classes = [
        'queue-row',
        i === 0 ? 'next-up' : '',
        isPrio  ? 'priority' : '',
        isNova  ? 'queue-row-enter' : '',
      ].filter(Boolean).join(' ');

      return `<div class="${classes}" style="${isNova ? `animation-delay:${i * 35}ms` : ''}">
        <div class="q-pos">${it.posicao || i + 1}º</div>
        <div class="q-num ${isPrio ? 'tv-priority-glow' : ''}">${it.numero}</div>
        <div class="q-service">
          ${it.servico || 'Serviço'}
          ${isPrio
            ? '<br><span style="font-size:.7rem;color:var(--amber);font-weight:700;">⚡ PRIORITÁRIA</span>'
            : ''}
        </div>
        <div class="q-time">${i === 0 ? '🔜 Próxima' : tempo}</div>
      </div>`;
    }).join('');

    if (lista.length > MAX) {
      lEl.innerHTML += `
        <div style="text-align:center;padding:.65rem;font-size:.78rem;color:var(--muted);">
          + ${lista.length - MAX} mais na fila
        </div>`;
    }

    _filaAnterior = lista.slice();

    /* Alerta de fila longa */
    if (total >= 8 && !_alertaFila) {
      _alertaFila = true;
      setTimeout(() => {
        _tocar(SOUNDS.fila);
        _falar(`Atenção — ${total} senhas aguardando atendimento.`);
      }, 1500);
      setTimeout(() => { _alertaFila = false; }, 120000);
    } else if (total < 8) {
      _alertaFila = false;
    }
  }

  /* ════════════════════════════════════════════════════════════
     RENDER — Footer stats
  ════════════════════════════════════════════════════════════ */

  function _renderFooter(d) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('footerTotal',      d.total_emitidas    || '–');
    set('footerConcluidas', d.concluidas        || '–');
    set('footerAvaliacao',  d.avaliacao_media   ? `★ ${Number(d.avaliacao_media).toFixed(1)}` : '–');
    const t = d.tempo_medio_global || d.tempo_medio_atendimento_min || 0;
    set('footerTempo', t > 0 ? `${t}min` : '–');
  }

  /* ════════════════════════════════════════════════════════════
     CONNECTIVITY INDICATOR
  ════════════════════════════════════════════════════════════ */

  function _setConn(estado) {
    const el = document.getElementById('tv-conn');
    if (!el) return;
    el.className = estado;
    el.textContent = {
      online:     '● Ligado',
      offline:    '● Sem ligação',
      connecting: '● A ligar…',
    }[estado] || '';
  }

  /* ════════════════════════════════════════════════════════════
     CICLO PRINCIPAL — polling adaptativo
  ════════════════════════════════════════════════════════════ */

  async function _actualizar() {
    try {
      const r = await fetch(`${_baseUrl()}/dashboard/public/tv`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);

      const d = await r.json();
      _lastOk = Date.now();
      _setConn('online');

      const ea  = d.em_atendimento || [];
      const hor = new Date().toLocaleTimeString('pt-PT',
        { hour: '2-digit', minute: '2-digit', timeZone: TZ });

      /* Detectar nova chamada */
      if (ea.length > 0) {
        const nova = ea[0];
        if (nova.numero !== _ultimaNum) {
          _ultimaNum = nova.numero;
          _animarNovaChamada(
            nova.numero,
            nova.balcao,
            nova.servico,
            hor,
            nova.tipo === 'prioritaria'
          );
        }
      } else if (_ultimaNum === null) {
        /* Sem chamadas ainda hoje */
        const nEl = document.getElementById('lcNumero');
        if (nEl && nEl.textContent === '—') { /* manter */ }
      }

      _renderAtendendo(ea);
      _renderFila(d.aguardando || [], d.total_aguardando || 0);
      _renderFooter(d);

      const tmEl = document.getElementById('tempoMedio');
      if (tmEl) {
        tmEl.textContent = d.tempo_medio_global > 0
          ? `Espera estimada: ~${d.tempo_medio_global} min`
          : 'Espera estimada: –';
      }

      const upEl = document.getElementById('lastUpdate');
      if (upEl) {
        upEl.textContent = 'Actualizado às ' +
          new Date().toLocaleTimeString('pt-PT',
            { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ });
      }

      /* Esconder loading */
      const ov = document.getElementById('loadingOverlay');
      if (ov) {
        ov.style.transition = 'opacity .5s ease';
        ov.style.opacity    = '0';
        setTimeout(() => { ov.style.display = 'none'; }, 500);
      }

    } catch (e) {
      console.error('[TV] Erro de polling:', e);
      const elapsed = Date.now() - _lastOk;
      _setConn(elapsed > 15000 ? 'offline' : 'connecting');
    }
  }

  /* Polling adaptativo: rápido em foco, lento em background */
  function _iniciarPolling() {
    clearInterval(_pollingTimer);

    function _ciclo() {
      _actualizar();
    }

    _ciclo(); // imediato
    const intervalo = document.hidden ? CFG.POLLING_BACKGROUND : CFG.POLLING_ACTIVO;
    _pollingTimer = setInterval(_ciclo, intervalo);
  }

  document.addEventListener('visibilitychange', () => {
    clearInterval(_pollingTimer);
    const intervalo = document.hidden ? CFG.POLLING_BACKGROUND : CFG.POLLING_ACTIVO;
    _pollingTimer   = setInterval(_actualizar, intervalo);
    if (!document.hidden) _actualizar(); // refresh imediato ao voltar
  });

  /* ════════════════════════════════════════════════════════════
     CONTROLOS GLOBAIS (chamados pelos botões)
  ════════════════════════════════════════════════════════════ */

  window.tvToggleSound = function () {
    _soundMuted = !_soundMuted;
    const btn   = document.getElementById('tvBtnSound');
    if (btn) {
      btn.textContent = _soundMuted ? '🔕 Sem Som' : '🔔 Som';
      btn.classList.toggle('muted',  _soundMuted);
      btn.classList.toggle('active', !_soundMuted);
    }
  };

  window.tvToggleSpeech = function () {
    _speechMuted = !_speechMuted;
    if (_speechMuted && window.speechSynthesis) speechSynthesis.cancel();
    const btn = document.getElementById('tvBtnSpeech');
    if (btn) {
      btn.textContent = _speechMuted ? '🔇 Sem Voz' : '🗣 Voz';
      btn.classList.toggle('muted',  _speechMuted);
      btn.classList.toggle('active', !_speechMuted);
    }
  };

  window.tvToggleFullscreen = function () {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      const btn = document.getElementById('tvBtnFullscreen');
      if (btn) btn.textContent = '⊠ Sair de Ecrã Cheio';
    } else {
      document.exitFullscreen?.().catch(() => {});
      const btn = document.getElementById('tvBtnFullscreen');
      if (btn) btn.textContent = '⛶ Ecrã Cheio';
    }
  };

  /* Manter compatibilidade com botão existente na tv.html */
  window.toggleMute = window.tvToggleSound;

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */

  _setup();
  _relogio();
  _initVoice();
  _iniciarPolling();

  /* Desbloquear áudio no primeiro gesto */
  ['click', 'touchstart', 'keydown'].forEach(ev =>
    document.addEventListener(ev, () => _ctx(), { once: true, passive: true })
  );

  console.log('✅ UX08 — TV Display Premium carregado');

})();