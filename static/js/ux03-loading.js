/**
 * static/js/ux03-loading.js
 * ═══════════════════════════════════════════════════════════════
 * UX-03 — Loading / Feedback States
 * Módulo standalone: não altera arquitectura existente.
 *
 * Responsabilidades:
 *   1. Botões com loading state (spinner + texto contextual)
 *   2. Skeletons / shimmer para KPIs e listas
 *   3. Indicador de conectividade (🟢 Ligado / 🟡 Reconectando / 🔴 Offline)
 *   4. Empty states amigáveis
 *   5. Toasts padronizados (wrapper do sistema existente)
 *
 * Uso:
 *   UX03.btnLoading(btn, true, 'A chamar...')
 *   UX03.btnLoading(btn, false)
 *   UX03.setConnStatus('online' | 'reconnecting' | 'offline')
 *   UX03.emptyState(containerEl, 'Nenhuma senha aguardando')
 *   UX03.skeletonOn(containerEl, 3)
 *   UX03.skeletonOff(containerEl)
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ── Estilos injectados uma única vez ───────────────────── */
  const CSS = `
    /* ── Loading button ─────────────────────────────────── */
    .ux03-btn-loading {
      position: relative !important;
      pointer-events: none !important;
      opacity: 0.72 !important;
      cursor: not-allowed !important;
    }

    .ux03-btn-loading::after {
      content: '';
      position: absolute;
      right: .85rem;
      top: 50%;
      transform: translateY(-50%);
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: ux03spin .65s linear infinite;
    }

    @keyframes ux03spin { to { transform: translateY(-50%) rotate(360deg); } }

    /* ── Skeleton / shimmer ──────────────────────────────── */
    .ux03-skeleton {
      background: linear-gradient(
        90deg,
        rgba(255,255,255,.04) 25%,
        rgba(255,255,255,.10) 50%,
        rgba(255,255,255,.04) 75%
      );
      background-size: 200% 100%;
      animation: ux03shimmer 1.4s infinite;
      border-radius: 10px;
      min-height: 52px;
    }

    @keyframes ux03shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Skeleton para KPI cards */
    .ux03-kpi-skeleton {
      height: 48px;
      border-radius: 8px;
    }

    /* Skeleton para linhas de lista */
    .ux03-row-skeleton {
      height: 38px;
      margin-bottom: .45rem;
      border-radius: 9px;
    }

    /* ── Indicador de conectividade ──────────────────────── */
    #ux03-conn-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1200;
      padding: .45rem 1.5rem;
      font-size: .8rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: .5rem;
      transform: translateY(-100%);
      transition: transform .35s cubic-bezier(.16,1,.3,1), background .3s;
      letter-spacing: .03em;
    }

    #ux03-conn-bar.visible {
      transform: translateY(0);
    }

    #ux03-conn-bar.online {
      background: rgba(5, 150, 105, .92);
      color: #fff;
    }

    #ux03-conn-bar.reconnecting {
      background: rgba(217, 119, 6, .92);
      color: #fff;
    }

    #ux03-conn-bar.offline {
      background: rgba(185, 28, 28, .95);
      color: #fff;
    }

    .ux03-conn-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    #ux03-conn-bar.reconnecting .ux03-conn-dot {
      animation: ux03spin .9s linear infinite;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      background: transparent;
    }

    /* ── Empty state ─────────────────────────────────────── */
    .ux03-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem 1rem;
      color: rgba(255,255,255,.35);
      text-align: center;
      gap: .4rem;
      min-height: 72px;
    }

    .ux03-empty-icon {
      font-size: 1.6rem;
      opacity: .5;
    }

    .ux03-empty-text {
      font-size: .82rem;
      font-weight: 500;
    }
  `;

  function _injectStyles() {
    if (document.getElementById('ux03-styles')) return;
    const s = document.createElement('style');
    s.id = 'ux03-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── BOTÃO: loading state ───────────────────────────────── */

  /**
   * Activa ou desactiva o estado de loading num botão.
   *
   * @param {HTMLElement} btn
   * @param {boolean}     loading
   * @param {string}      [texto] — texto a mostrar durante loading
   */
  function btnLoading(btn, loading, texto) {
    if (!btn) return;

    if (loading) {
      btn._ux03OrigText    = btn.textContent;
      btn._ux03OrigDisabled = btn.disabled;
      btn.disabled = true;
      btn.classList.add('ux03-btn-loading');
      if (texto) btn.textContent = texto;
    } else {
      btn.disabled = !!btn._ux03OrigDisabled;
      btn.classList.remove('ux03-btn-loading');
      if (btn._ux03OrigText !== undefined) {
        btn.textContent = btn._ux03OrigText;
        delete btn._ux03OrigText;
        delete btn._ux03OrigDisabled;
      }
    }
  }

  /* ── CONECTIVIDADE ──────────────────────────────────────── */

  let _connBar        = null;
  let _connHideTimer  = null;
  let _connCurrent    = null;

  function _getConnBar() {
    if (_connBar) return _connBar;
    _connBar = document.createElement('div');
    _connBar.id = 'ux03-conn-bar';
    _connBar.innerHTML = '<div class="ux03-conn-dot"></div><span id="ux03-conn-text"></span>';
    document.body.appendChild(_connBar);
    return _connBar;
  }

  /**
   * Define o estado de conectividade.
   *
   * @param {'online'|'reconnecting'|'offline'} estado
   * @param {boolean} [autoHide=true] — esconder após 3s se 'online'
   */
  function setConnStatus(estado, autoHide) {
    if (estado === _connCurrent && estado !== 'online') return;
    _connCurrent = estado;

    const bar     = _getConnBar();
    const textEl  = document.getElementById('ux03-conn-text');

    const LABELS = {
      online:       '🟢 Ligado — sistema em tempo real',
      reconnecting: '🟡 A reconectar ao servidor…',
      offline:      '🔴 Sem ligação — a tentar reconectar'
    };

    bar.className = `visible ${estado}`;
    if (textEl) textEl.textContent = LABELS[estado] || estado;

    clearTimeout(_connHideTimer);

    /* Esconder automaticamente após 3s quando 'online' */
    if (estado === 'online' && autoHide !== false) {
      _connHideTimer = setTimeout(() => {
        bar.classList.remove('visible');
        _connCurrent = null;
      }, 3000);
    }
  }

  /* ── SKELETON / SHIMMER ─────────────────────────────────── */

  /**
   * Mostra esqueletos de carregamento num container.
   *
   * @param {HTMLElement} container
   * @param {number}      [n=3]       — número de linhas
   * @param {'row'|'kpi'} [tipo='row']
   */
  function skeletonOn(container, n, tipo) {
    if (!container) return;
    container.dataset.ux03Prev = container.innerHTML;
    const cls  = tipo === 'kpi' ? 'ux03-kpi-skeleton' : 'ux03-row-skeleton';
    const linhas = Array.from({ length: n || 3 })
      .map(() => `<div class="ux03-skeleton ${cls}"></div>`)
      .join('');
    container.innerHTML = linhas;
  }

  /**
   * Remove esqueletos e restaura conteúdo anterior (se existir).
   *
   * @param {HTMLElement} container
   */
  function skeletonOff(container) {
    if (!container) return;
    if (container.dataset.ux03Prev !== undefined) {
      container.innerHTML = container.dataset.ux03Prev;
      delete container.dataset.ux03Prev;
    }
  }

  /* ── EMPTY STATE ────────────────────────────────────────── */

  const EMPTY_ICONS = {
    fila:       '📭',
    historico:  '📋',
    atendimento:'✅',
    default:    '🗂'
  };

  /**
   * Mostra um empty state amigável num container.
   *
   * @param {HTMLElement} container
   * @param {string}      texto
   * @param {'fila'|'historico'|'atendimento'|'default'} [tipo]
   */
  function emptyState(container, texto, tipo) {
    if (!container) return;
    const icon = EMPTY_ICONS[tipo] || EMPTY_ICONS.default;
    container.innerHTML = `
      <div class="ux03-empty">
        <div class="ux03-empty-icon">${icon}</div>
        <div class="ux03-empty-text">${texto || 'Sem dados disponíveis'}</div>
      </div>`;
  }

  /* ── POLLING MONITOR ────────────────────────────────────── */

  let _lastPollOk  = Date.now();
  let _pollWatcher = null;

  /**
   * Regista uma tentativa de polling bem-sucedida.
   * Chamar no final de cada ciclo de polling que retornou 200.
   */
  function pollOk() {
    const wasOffline = _connCurrent === 'offline' || _connCurrent === 'reconnecting';
    _lastPollOk = Date.now();
    if (wasOffline) setConnStatus('online');
  }

  /**
   * Regista uma falha de polling.
   * Chamar quando fetch falha ou timeout.
   */
  function pollFail() {
    const elapsed = Date.now() - _lastPollOk;
    if (elapsed > 12000) {
      setConnStatus('offline', false);
    } else if (elapsed > 5000) {
      setConnStatus('reconnecting', false);
    }
  }

  /**
   * Inicia monitor passivo de conectividade.
   * Verifica a cada 8s se houve polling recente.
   */
  function startPollMonitor() {
    if (_pollWatcher) return;
    _pollWatcher = setInterval(() => {
      const elapsed = Date.now() - _lastPollOk;
      if (elapsed > 20000)      setConnStatus('offline', false);
      else if (elapsed > 10000) setConnStatus('reconnecting', false);
    }, 8000);
  }

  /* ── EXPOR API ──────────────────────────────────────────── */

  _injectStyles();

  window.UX03 = {
    btnLoading,
    setConnStatus,
    skeletonOn,
    skeletonOff,
    emptyState,
    pollOk,
    pollFail,
    startPollMonitor
  };

  console.log('✅ UX03 — Loading/Feedback States carregado');

})();