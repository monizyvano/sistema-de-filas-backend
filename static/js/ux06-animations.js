/**
 * static/js/ux06-animations.js
 * ═══════════════════════════════════════════════════════════════
 * UX-06 — Animações de Cards / KPIs (Dashboard Admin)
 *
 * FUNCIONALIDADES:
 *   • Count-up animado nos KPIs ao carregar e ao actualizar
 *   • Stagger entrance para cards, secções e tabelas
 *   • Hover elevation em todos os cards
 *   • Pulse automático via MutationObserver (zero patches)
 *   • Press feedback micro-interacção nos botões
 *   • Transições suaves em toda a UI admin
 *
 * API:
 *   UX06.countUp(el, valorFinal, duracao?)
 *   UX06.pulse(el)
 *   UX06.stagger(selector, opções?)
 *   UX06.animateQueueItems(container)
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ════════════════════════════════════════════════════════════
     CSS
  ════════════════════════════════════════════════════════════ */
  const CSS = `

    /* ── Hover elevation ──────────────────────────────────── */
    .kpi-card {
      cursor: default;
      transition:
        transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 0.3s ease !important;
      will-change: transform, box-shadow;
    }

    .kpi-card:hover {
      transform: translateY(-6px) !important;
      box-shadow:
        0 20px 48px rgba(62, 37, 16, .14),
        0 4px 12px rgba(62, 37, 16, .08) !important;
    }

    .kpi-card:active {
      transform: translateY(-2px) scale(0.985) !important;
      transition-duration: 0.1s !important;
    }

    .monitor-card,
    .chart-card {
      transition:
        transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
        box-shadow 0.28s ease !important;
    }

    .monitor-card:hover,
    .chart-card:hover {
      transform: translateY(-4px) !important;
      box-shadow: 0 14px 36px rgba(0, 0, 0, .12) !important;
    }

    /* ── Entrada escalonada ───────────────────────────────── */
    .ux06-enter {
      opacity: 0;
      transform: translateY(22px);
      animation: ux06FadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    @keyframes ux06FadeUp {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* ── KPI pulse ao actualizar ──────────────────────────── */
    .kpi-value {
      display: inline-block;
      transition: color 0.3s ease;
    }

    .ux06-pulse {
      animation: ux06KpiPulse 0.5s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }

    @keyframes ux06KpiPulse {
      0%  { transform: scale(1);    color: inherit; }
      35% { transform: scale(1.14); color: #6b4226; }
      100%{ transform: scale(1);    color: inherit; }
    }

    /* ── Entrada de item de fila ──────────────────────────── */
    .ux06-slide-in {
      animation: ux06SlideIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes ux06SlideIn {
      from { opacity: 0; transform: translateX(-14px); }
      to   { opacity: 1; transform: translateX(0); }
    }

    /* ── Tabela performance — row hover ───────────────────── */
    .performance-table tbody tr {
      transition: background 0.18s ease !important;
    }

    .performance-table tbody tr:hover {
      background: rgba(107, 66, 38, .045) !important;
    }

    /* ── Queue item hover ─────────────────────────────────── */
    .queue-item {
      transition:
        transform 0.22s ease,
        background 0.2s ease !important;
      cursor: default;
    }

    .queue-item:hover {
      transform: translateX(5px) !important;
      background: rgba(107, 66, 38, .06) !important;
    }

    /* ── Filter buttons ───────────────────────────────────── */
    .filter-btn {
      transition:
        background 0.18s ease,
        color 0.18s ease,
        transform 0.12s ease,
        box-shadow 0.18s ease !important;
    }

    .filter-btn:hover:not(.active) {
      background: rgba(107, 66, 38, .08) !important;
    }

    .filter-btn:active {
      transform: scale(0.95) !important;
    }

    /* ── Export buttons ───────────────────────────────────── */
    .export-btn {
      transition:
        opacity 0.18s ease,
        transform 0.14s ease,
        box-shadow 0.2s ease !important;
    }

    .export-btn:hover:not(:disabled) {
      transform: translateY(-2px) !important;
      box-shadow: 0 6px 16px rgba(0, 0, 0, .18) !important;
    }

    .export-btn:active {
      transform: scale(0.97) translateY(0) !important;
      transition-duration: 0.08s !important;
    }

    /* ── Período metricas btns ────────────────────────────── */
    .periodo-metricas-btn {
      transition:
        background 0.2s ease,
        color 0.2s ease,
        transform 0.12s ease !important;
    }

    .periodo-metricas-btn:active {
      transform: scale(0.96) !important;
    }

    /* ── Search input focus glow ──────────────────────────── */
    .search-worker-input {
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease !important;
    }

    /* ── Remove worker btn ────────────────────────────────── */
    .remove-worker-btn {
      transition:
        background 0.18s ease,
        transform 0.12s ease !important;
    }

    .remove-worker-btn:hover {
      background: rgba(220, 38, 38, .12) !important;
      color: #dc2626 !important;
    }

    .remove-worker-btn:active {
      transform: scale(0.95) !important;
    }

    /* ── Trabalhador do mês card hover ────────────────────── */
    #trabalhadorMesCard {
      transition:
        transform 0.28s ease,
        box-shadow 0.28s ease !important;
    }

    #trabalhadorMesCard:hover {
      transform: translateY(-3px) !important;
      box-shadow: 0 10px 28px rgba(107, 66, 38, .12) !important;
    }

    /* ── Badge de score pulse ─────────────────────────────── */
    .ux06-score-update {
      animation: ux06BadgePop 0.45s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes ux06BadgePop {
      0%   { transform: scale(1); }
      45%  { transform: scale(1.18); }
      100% { transform: scale(1); }
    }

    /* ── Trend badge ──────────────────────────────────────── */
    .kpi-trend {
      transition: color 0.4s ease !important;
    }

    /* ── History buttons ──────────────────────────────────── */
    #historyPrevBtn,
    #historyNextBtn {
      transition:
        opacity 0.2s ease,
        transform 0.12s ease !important;
    }

    #historyPrevBtn:not(:disabled):hover,
    #historyNextBtn:not(:disabled):hover {
      transform: translateY(-1px) !important;
    }

    #historyPrevBtn:active,
    #historyNextBtn:active {
      transform: scale(0.96) !important;
    }
  `;

  function _injectCSS() {
    if (document.getElementById('ux06-styles')) return;
    const s = document.createElement('style');
    s.id = 'ux06-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ════════════════════════════════════════════════════════════
     COUNT-UP
  ════════════════════════════════════════════════════════════ */

  /**
   * Extrai número e sufixo de "78%", "5min", "42", "0.5h"
   */
  function _parseVal(text) {
    const str = String(text || '').trim();
    const m   = str.match(/^([\d.,]+)(.*)$/);
    if (!m) return { num: null, suffix: str };
    return {
      num:    parseFloat(m[1].replace(',', '.')),
      suffix: m[2] || '',
      isFloat: m[1].includes('.') || m[1].includes(','),
    };
  }

  /**
   * Anima um elemento com count-up de 0 até o valor actual.
   *
   * @param {HTMLElement} el
   * @param {string}      endText   — valor final (ex: "42", "78%", "5min")
   * @param {number}      [duracao] — duração em ms (default: 850)
   */
  function countUp(el, endText, duracao) {
    if (!el) return;
    duracao = duracao || 850;

    const { num: endNum, suffix, isFloat } = _parseVal(endText);
    if (endNum === null) { el.textContent = endText; return; }

    const startNum = 0;
    const diff     = endNum - startNum;
    if (diff === 0) { el.textContent = endText; return; }

    const t0 = performance.now();

    function tick(now) {
      const elapsed  = now - t0;
      const progress = Math.min(elapsed / duracao, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current  = startNum + diff * eased;

      el.textContent = isFloat
        ? current.toFixed(1) + suffix
        : Math.round(current) + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = endText; // valor exacto no fim
      }
    }

    requestAnimationFrame(tick);
  }

  /* ════════════════════════════════════════════════════════════
     PULSE
  ════════════════════════════════════════════════════════════ */

  /**
   * Anima um elemento com pulse ao actualizar valor.
   *
   * @param {HTMLElement} el
   */
  function pulse(el) {
    if (!el) return;
    el.classList.remove('ux06-pulse');
    void el.offsetWidth; // force reflow
    el.classList.add('ux06-pulse');
    el.addEventListener('animationend', () => el.classList.remove('ux06-pulse'), { once: true });
  }

  /* ════════════════════════════════════════════════════════════
     STAGGER — entrada escalonada
  ════════════════════════════════════════════════════════════ */

  /**
   * Aplica entrada escalonada a elementos.
   *
   * @param {string|NodeList} selector
   * @param {object} [opts]
   * @param {number} [opts.baseDelay=0]    — delay inicial (ms)
   * @param {number} [opts.step=80]        — incremento por item (ms)
   * @param {number} [opts.duration=600]   — duração da animação (ms)
   */
  function stagger(selector, opts) {
    const { baseDelay = 0, step = 80 } = opts || {};
    const elements = typeof selector === 'string'
      ? document.querySelectorAll(selector)
      : selector;

    elements.forEach((el, i) => {
      if (el.classList.contains('ux06-enter')) return; // já animado
      el.classList.add('ux06-enter');
      el.style.animationDelay = `${baseDelay + i * step}ms`;
    });
  }

  /* ════════════════════════════════════════════════════════════
     ANIMATE QUEUE ITEMS — novos itens na fila
  ════════════════════════════════════════════════════════════ */

  /**
   * Anima itens recém-renderizados num container de fila.
   *
   * @param {HTMLElement} container
   */
  function animateQueueItems(container) {
    if (!container) return;
    container
      .querySelectorAll('.queue-item, .queue-row, .attending-card')
      .forEach((item, i) => {
        if (item.dataset.ux06Done) return;
        item.classList.add('ux06-slide-in');
        item.style.animationDelay = `${i * 45}ms`;
        item.dataset.ux06Done = '1';
        item.addEventListener('animationend', () => {
          item.classList.remove('ux06-slide-in');
          item.style.animationDelay = '';
        }, { once: true });
      });
  }

  /* ════════════════════════════════════════════════════════════
     MUTATION OBSERVER — auto-pulse em KPIs sem patch
  ════════════════════════════════════════════════════════════ */

  const _watchers = new Map();

  /**
   * Observa um elemento e anima quando o conteúdo muda.
   *
   * @param {string} id — id do elemento
   */
  function watchKPI(id) {
    const el = document.getElementById(id);
    if (!el || _watchers.has(id)) return;

    const observer = new MutationObserver(() => {
      pulse(el);
    });

    observer.observe(el, {
      characterData: true,
      childList:     true,
      subtree:       true,
    });

    _watchers.set(id, observer);
  }

  function watchAllKPIs() {
    [
      'kpiAttend', 'kpiWait', 'kpiOcc', 'kpiSat',
      'kpiOccTrend', 'trendAttend',
      'waitingCount', 'servedToday', 'avgTime',
    ].forEach(watchKPI);
  }

  /* ════════════════════════════════════════════════════════════
     ANIMATE ON LOAD — chamado uma vez ao inicializar
  ════════════════════════════════════════════════════════════ */

  function animateOnLoad() {
    /* KPI cards — mais proeminentes, animam primeiro */
    stagger('.kpi-card', { baseDelay: 60, step: 90 });

    /* Cards de monitorização */
    stagger('.monitor-card', { baseDelay: 400, step: 80 });

    /* Gráficos */
    stagger('.chart-card', { baseDelay: 480, step: 80 });

    /* Secções de performance */
    document.querySelectorAll('.performance-section').forEach((sec, i) => {
      if (!sec.classList.contains('ux06-enter')) {
        sec.classList.add('ux06-enter');
        sec.style.animationDelay = `${560 + i * 80}ms`;
      }
    });
  }

  /* ════════════════════════════════════════════════════════════
     COUNT-UP INICIAL DOS KPIs ACTUAIS
  ════════════════════════════════════════════════════════════ */

  function countUpCurrentKPIs() {
    ['kpiAttend', 'kpiWait', 'kpiOcc', 'kpiSat'].forEach(id => {
      const el   = document.getElementById(id);
      if (!el)   return;
      const text = el.textContent.trim();
      if (!text || text === '0' || text === '0%' || text === '0min') return;

      const saved = text;
      const { num, suffix } = _parseVal(text);
      if (num === null || num === 0) return;

      el.textContent = '0' + suffix;
      /* Pequeno delay para a entrada do card terminar */
      setTimeout(() => countUp(el, saved, 950), 500 + Math.random() * 200);
    });
  }

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */

  _injectCSS();

  function _init() {
    animateOnLoad();
    watchAllKPIs();
    /* Count-up se já houver valores (polling já correu antes do load) */
    setTimeout(countUpCurrentKPIs, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    requestAnimationFrame(_init);
  }

  /* ── API pública ────────────────────────────────────────── */
  window.UX06 = {
    countUp,
    pulse,
    stagger,
    watchKPI,
    watchAllKPIs,
    animateOnLoad,
    animateQueueItems,
    countUpCurrentKPIs,
  };

  console.log('✅ UX06 — Animações de Cards/KPIs carregado');

})();