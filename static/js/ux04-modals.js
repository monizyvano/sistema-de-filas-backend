/**
 * static/js/ux04-modals.js
 * ═══════════════════════════════════════════════════════════════
 * UX-04 — Sistema de Modais + Toasts Profissionais
 *
 * PRINCÍPIOS:
 *   • Standalone — sem dependências externas
 *   • Aditivo — não quebra código existente
 *   • Fallback seguro — se não carregar, usa prompt/confirm nativos
 *   • Mobile-first — responsivo, teclado mobile compatível
 *   • Compatível com UX-01 / UX-02 / UX-03
 *
 * API PÚBLICA:
 *   UX04.prompt(opcoes)   → Promise<string|null>
 *   UX04.confirm(opcoes)  → Promise<boolean>
 *   UX04.alert(opcoes)    → Promise<void>
 *   UX04.toast(msg, tipo, duracao) → void
 *
 * TIPOS DE TOAST:
 *   'success' | 'error' | 'warn' | 'info'
 *
 * EXEMPLOS:
 *   const motivo = await UX04.prompt({ titulo: 'Motivo', campo: 'textarea' });
 *   const ok = await UX04.confirm({ titulo: 'Confirmar?', perigo: true });
 *   UX04.toast('Operação concluída', 'success');
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ════════════════════════════════════════════════════════════
     CSS — injectado uma única vez no <head>
  ════════════════════════════════════════════════════════════ */
  const CSS = `
    /* ── Reset base do modal ──────────────────────────────── */
    .ux04-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(0, 0, 0, 0);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      transition: background 0.25s ease;
      backdrop-filter: blur(0px);
      -webkit-backdrop-filter: blur(0px);
      transition:
        background 0.25s ease,
        backdrop-filter 0.25s ease;
    }

    .ux04-overlay.ux04-visible {
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }

    /* Mobile: modais sobem do fundo */
    @media (max-width: 520px) {
      .ux04-overlay {
        align-items: flex-end;
        padding: 0;
      }
    }

    /* ── Card do modal ────────────────────────────────────── */
    .ux04-card {
      background: #fff;
      border-radius: 20px;
      width: 100%;
      max-width: 440px;
      overflow: hidden;
      box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.28),
        0 4px 16px rgba(0, 0, 0, 0.12),
        0 0 0 1px rgba(0, 0, 0, 0.06);
      transform: scale(0.94) translateY(12px);
      opacity: 0;
      transition:
        transform 0.28s cubic-bezier(0.16, 1, 0.3, 1),
        opacity 0.22s ease;
    }

    .ux04-card.ux04-visible {
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    @media (max-width: 520px) {
      .ux04-card {
        border-radius: 20px 20px 0 0;
        max-width: 100%;
        transform: translateY(100%);
      }

      .ux04-card.ux04-visible {
        transform: translateY(0);
      }
    }

    /* ── Header do modal ──────────────────────────────────── */
    .ux04-header {
      padding: 1.35rem 1.5rem 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .ux04-header-left {
      display: flex;
      align-items: flex-start;
      gap: .75rem;
      flex: 1;
      min-width: 0;
    }

    .ux04-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      flex-shrink: 0;
    }

    .ux04-icon.danger  { background: rgba(220, 38,  38,  .1); }
    .ux04-icon.warning { background: rgba(217, 119, 6,   .1); }
    .ux04-icon.success { background: rgba(5,   150, 105, .1); }
    .ux04-icon.info    { background: rgba(59,  130, 246, .1); }
    .ux04-icon.neutral { background: rgba(107, 114, 128, .1); }

    .ux04-title-area { flex: 1; min-width: 0; }

    .ux04-title {
      font-family: 'Poppins', 'Inter', -apple-system, sans-serif;
      font-size: 1.05rem;
      font-weight: 700;
      color: #111827;
      line-height: 1.3;
      margin: 0;
    }

    .ux04-subtitle {
      font-size: .82rem;
      color: #6b7280;
      margin-top: .2rem;
      line-height: 1.45;
    }

    .ux04-close {
      background: rgba(0, 0, 0, .06);
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      font-size: .95rem;
      color: #6b7280;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .18s, color .18s;
      -webkit-tap-highlight-color: transparent;
    }

    .ux04-close:hover {
      background: rgba(0, 0, 0, .12);
      color: #111;
    }

    /* ── Corpo do modal ───────────────────────────────────── */
    .ux04-body {
      padding: 1rem 1.5rem;
    }

    .ux04-msg {
      font-size: .9rem;
      color: #374151;
      line-height: 1.6;
      margin: 0 0 .85rem;
    }

    /* ── Campos do formulário ─────────────────────────────── */
    .ux04-field {
      margin-bottom: .85rem;
    }

    .ux04-label {
      display: block;
      font-size: .75rem;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: .4rem;
    }

    .ux04-input,
    .ux04-textarea {
      width: 100%;
      padding: .75rem 1rem;
      border: 1.5px solid rgba(0, 0, 0, .14);
      border-radius: 12px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: .95rem;
      color: #111827;
      background: #f9fafb;
      outline: none;
      transition: border-color .18s, box-shadow .18s, background .18s;
      box-sizing: border-box;
    }

    .ux04-input:focus,
    .ux04-textarea:focus {
      border-color: #6b4226;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(107, 66, 38, .12);
    }

    .ux04-input.error,
    .ux04-textarea.error {
      border-color: #dc2626;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, .1);
    }

    .ux04-textarea {
      resize: vertical;
      min-height: 90px;
      max-height: 200px;
      line-height: 1.55;
    }

    .ux04-field-error {
      font-size: .78rem;
      color: #dc2626;
      margin-top: .3rem;
      font-weight: 500;
      display: none;
    }

    .ux04-field-error.visible { display: block; }

    .ux04-char-count {
      font-size: .72rem;
      color: #9ca3af;
      text-align: right;
      margin-top: .25rem;
    }

    .ux04-char-count.warn { color: #d97706; }
    .ux04-char-count.over { color: #dc2626; }

    /* ── Separador ────────────────────────────────────────── */
    .ux04-divider {
      height: 1px;
      background: rgba(0, 0, 0, .07);
      margin: 0;
    }

    /* ── Acções (footer) ──────────────────────────────────── */
    .ux04-actions {
      padding: 1rem 1.5rem 1.35rem;
      display: flex;
      gap: .6rem;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    @media (max-width: 380px) {
      .ux04-actions { flex-direction: column-reverse; }
      .ux04-actions .ux04-btn { width: 100%; justify-content: center; }
    }

    /* ── Botões ───────────────────────────────────────────── */
    .ux04-btn {
      display: inline-flex;
      align-items: center;
      gap: .45rem;
      padding: .72rem 1.25rem;
      border-radius: 11px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: .9rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition:
        background .18s,
        transform .12s,
        box-shadow .18s,
        opacity .18s;
      -webkit-tap-highlight-color: transparent;
      min-height: 44px;
      white-space: nowrap;
    }

    .ux04-btn:active { transform: scale(.97); }

    .ux04-btn:disabled {
      opacity: .5;
      cursor: not-allowed;
      transform: none !important;
    }

    /* Cancel */
    .ux04-btn-cancel {
      background: rgba(0, 0, 0, .06);
      color: #374151;
      border: 1px solid rgba(0, 0, 0, .1);
    }

    .ux04-btn-cancel:hover:not(:disabled) {
      background: rgba(0, 0, 0, .1);
    }

    /* Confirm — neutral */
    .ux04-btn-confirm {
      background: linear-gradient(135deg, #3e2510, #6b4226);
      color: #fff;
      box-shadow: 0 2px 8px rgba(107, 66, 38, .3);
    }

    .ux04-btn-confirm:hover:not(:disabled) {
      opacity: .9;
      box-shadow: 0 4px 14px rgba(107, 66, 38, .35);
    }

    /* Confirm — danger */
    .ux04-btn-danger {
      background: linear-gradient(135deg, #991b1b, #dc2626);
      color: #fff;
      box-shadow: 0 2px 8px rgba(220, 38, 38, .3);
    }

    .ux04-btn-danger:hover:not(:disabled) {
      opacity: .92;
      box-shadow: 0 4px 14px rgba(220, 38, 38, .35);
    }

    /* Confirm — warning */
    .ux04-btn-warning {
      background: linear-gradient(135deg, #92400e, #d97706);
      color: #fff;
      box-shadow: 0 2px 8px rgba(217, 119, 6, .28);
    }

    .ux04-btn-warning:hover:not(:disabled) {
      opacity: .92;
    }

    /* Spinner inline no botão */
    .ux04-btn-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, .35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: ux04spin .65s linear infinite;
      flex-shrink: 0;
    }

    @keyframes ux04spin {
      to { transform: rotate(360deg); }
    }

    /* ════════════════════════════════════════════════════════
       TOAST SYSTEM
    ════════════════════════════════════════════════════════ */
    #ux04-toast-wrap {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 100001;
      display: flex;
      flex-direction: column-reverse;
      gap: .5rem;
      max-width: 360px;
      width: calc(100vw - 3rem);
      pointer-events: none;
    }

    @media (max-width: 520px) {
      #ux04-toast-wrap {
        bottom: 1rem;
        right: 1rem;
        left: 1rem;
        width: auto;
        max-width: none;
      }
    }

    .ux04-toast {
      display: flex;
      align-items: flex-start;
      gap: .65rem;
      padding: .85rem 1rem .85rem 1rem;
      border-radius: 14px;
      color: #fff;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: .875rem;
      font-weight: 500;
      line-height: 1.45;
      pointer-events: all;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      box-shadow:
        0 8px 24px rgba(0, 0, 0, .2),
        0 2px 6px rgba(0, 0, 0, .1);
      animation: ux04toastIn .3s cubic-bezier(.16, 1, .3, 1) both;
      word-break: break-word;
    }

    .ux04-toast.ux04-toast-out {
      animation: ux04toastOut .22s ease-in forwards;
    }

    @keyframes ux04toastIn {
      from {
        opacity: 0;
        transform: translateX(20px) scale(.96);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @keyframes ux04toastOut {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
        max-height: 100px;
        margin-bottom: 0;
      }
      to {
        opacity: 0;
        transform: translateX(20px) scale(.95);
        max-height: 0;
        margin-bottom: -.5rem;
        padding-top: 0;
        padding-bottom: 0;
      }
    }

    @media (max-width: 520px) {
      @keyframes ux04toastIn {
        from {
          opacity: 0;
          transform: translateY(12px) scale(.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
    }

    /* Tipos de toast */
    .ux04-toast.success {
      background: linear-gradient(135deg, #065f46, #059669);
    }

    .ux04-toast.error {
      background: linear-gradient(135deg, #991b1b, #dc2626);
    }

    .ux04-toast.warn {
      background: linear-gradient(135deg, #92400e, #d97706);
    }

    .ux04-toast.info {
      background: linear-gradient(135deg, #1e40af, #2563eb);
    }

    .ux04-toast-icon {
      font-size: 1.15rem;
      flex-shrink: 0;
      line-height: 1.3;
    }

    .ux04-toast-body { flex: 1; min-width: 0; }

    .ux04-toast-title {
      font-size: .7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .08em;
      opacity: .75;
      margin-bottom: .18rem;
    }

    .ux04-toast-msg {
      font-size: .875rem;
      font-weight: 500;
    }

    .ux04-toast-close {
      background: rgba(255, 255, 255, .2);
      border: none;
      color: #fff;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      cursor: pointer;
      font-size: .8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: .05rem;
      transition: background .15s;
      -webkit-tap-highlight-color: transparent;
    }

    .ux04-toast-close:hover { background: rgba(255, 255, 255, .35); }

    /* Barra de progresso */
    .ux04-toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: rgba(255, 255, 255, .35);
      border-radius: 0 0 14px 14px;
      transform-origin: left;
    }

    /* Micro-feedback nos botões de acção do dashboard */
    .ux04-press-feedback {
      position: relative;
      overflow: hidden;
    }

    .ux04-press-feedback::after {
      content: '';
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0);
      transition: background .15s;
      border-radius: inherit;
      pointer-events: none;
    }

    .ux04-press-feedback:active::after {
      background: rgba(255, 255, 255, .18);
    }
  `;

  /* ── Injectar CSS ───────────────────────────────────────── */
  function _injectCSS() {
    if (document.getElementById('ux04-styles')) return;
    const el = document.createElement('style');
    el.id = 'ux04-styles';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  /* ════════════════════════════════════════════════════════════
     GESTOR DE OVERLAYS — controla stack de modais
  ════════════════════════════════════════════════════════════ */
  const _stack = [];

  function _createOverlay() {
    const el = document.createElement('div');
    el.className = 'ux04-overlay';
    document.body.appendChild(el);

    /* Animar entrada */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('ux04-visible'));
    });

    return el;
  }

  function _destroyOverlay(overlay, card) {
    card.classList.remove('ux04-visible');
    overlay.classList.remove('ux04-visible');

    overlay.addEventListener('transitionend', function handler() {
      overlay.removeEventListener('transitionend', handler);
      overlay.remove();
    });

    /* Fallback se transitionend não disparar */
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.remove();
        }
        }, 450);

    const idx = _stack.indexOf(overlay);
    if (idx > -1) _stack.splice(idx, 1);
  }

  /* ════════════════════════════════════════════════════════════
     CONSTRUTOR DE MODAL BASE
  ════════════════════════════════════════════════════════════ */

  /**
   * Cria a estrutura HTML base de um modal.
   *
   * @param {object} opts
   * @param {string} opts.titulo
   * @param {string} [opts.subtitulo]
   * @param {string} [opts.emoji]
   * @param {'danger'|'warning'|'success'|'info'|'neutral'} [opts.tipo]
   * @param {string} [opts.corpo]       — HTML do corpo
   * @param {string} [opts.accoesHTML]  — HTML dos botões
   * @returns {{ overlay, card, fechar }}
   */
  function _buildModal(opts) {
    const tipo    = opts.tipo    || 'neutral';
    const emoji   = opts.emoji   || { danger:'🚫', warning:'⚠️', success:'✅', info:'ℹ️', neutral:'💬' }[tipo];
    const overlay = _createOverlay();

    overlay.innerHTML = `
      <div class="ux04-card" role="dialog" aria-modal="true"
           aria-labelledby="ux04-titulo-${tipo}">

        <div class="ux04-header">
          <div class="ux04-header-left">
            <div class="ux04-icon ${tipo}">${emoji}</div>
            <div class="ux04-title-area">
              <p class="ux04-title" id="ux04-titulo-${tipo}">${opts.titulo || ''}</p>
              ${opts.subtitulo
                ? `<p class="ux04-subtitle">${opts.subtitulo}</p>`
                : ''}
            </div>
          </div>
          <button class="ux04-close" aria-label="Fechar" data-ux04-close>✕</button>
        </div>

        ${opts.corpo ? `<div class="ux04-body">${opts.corpo}</div>` : ''}

        <div class="ux04-divider"></div>

        <div class="ux04-actions">
          ${opts.accoesHTML || ''}
        </div>

      </div>`;

    const card  = overlay.querySelector('.ux04-card');
    _stack.push(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => card.classList.add('ux04-visible'));
    });

    function fechar() { _destroyOverlay(overlay, card); }

    /* Fechar ao clicar no overlay (fora do card) */
    overlay.addEventListener('click', e => {
      if (e.target === overlay) fechar();
    });

    /* Fechar com ESC */
    function _onKey(e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', _onKey);
        fechar();
      }
    }
    document.addEventListener('keydown', _onKey);

    /* Botão X */
    overlay.querySelector('[data-ux04-close]')
      ?.addEventListener('click', () => {
        document.removeEventListener('keydown', _onKey);
        fechar();
      });

    return { overlay, card, fechar, _onKey };
  }

  /* ════════════════════════════════════════════════════════════
     UX04.confirm()
     Substitui confirm() nativo com modal moderno.
  ════════════════════════════════════════════════════════════ */

  /**
   * Modal de confirmação.
   *
   * @param {object|string} opts
   * @param {string}  opts.titulo
   * @param {string}  [opts.mensagem]
   * @param {string}  [opts.subtitulo]
   * @param {boolean} [opts.perigo]          — botão confirmar vermelho
   * @param {boolean} [opts.aviso]           — botão confirmar laranja
   * @param {string}  [opts.txtConfirmar]    — texto do botão confirmar
   * @param {string}  [opts.txtCancelar]     — texto do botão cancelar
   * @param {string}  [opts.emoji]
   * @returns {Promise<boolean>}
   */
  function confirm(opts) {
    if (typeof opts === 'string') opts = { titulo: opts };

    return new Promise(resolve => {
      const tipo          = opts.perigo ? 'danger' : opts.aviso ? 'warning' : 'neutral';
      const txtConfirmar  = opts.txtConfirmar || 'Confirmar';
      const txtCancelar   = opts.txtCancelar  || 'Cancelar';
      const btnClass      = opts.perigo ? 'ux04-btn-danger' : opts.aviso ? 'ux04-btn-warning' : 'ux04-btn-confirm';

      const corpo = opts.mensagem
        ? `<p class="ux04-msg">${opts.mensagem}</p>`
        : '';

      const accoesHTML = `
        <button class="ux04-btn ux04-btn-cancel" data-ux04-cancel>${txtCancelar}</button>
        <button class="ux04-btn ${btnClass}" data-ux04-ok>${txtConfirmar}</button>
      `;

      const { overlay, fechar, _onKey } = _buildModal({
        titulo:    opts.titulo,
        subtitulo: opts.subtitulo,
        tipo,
        emoji:     opts.emoji,
        corpo,
        accoesHTML
      });

      function _done(val) {
        document.removeEventListener('keydown', _onKey);
        fechar();
        resolve(val);
      }

      overlay.querySelector('[data-ux04-ok]')?.addEventListener('click',     () => _done(true));
      overlay.querySelector('[data-ux04-cancel]')?.addEventListener('click', () => _done(false));

      /* Fechar overlay = cancelar */
      overlay.addEventListener('click', e => {
        if (e.target === overlay) _done(false);
      });

      /* Focar no botão de confirmar */
      setTimeout(() => overlay.querySelector('[data-ux04-ok]')?.focus(), 80);
    });
  }

  /* ════════════════════════════════════════════════════════════
     UX04.prompt()
     Substitui prompt() nativo com modal moderno + textarea.
  ════════════════════════════════════════════════════════════ */

  /**
   * Modal de input / prompt.
   *
   * @param {object|string} opts
   * @param {string}  opts.titulo
   * @param {string}  [opts.subtitulo]
   * @param {string}  [opts.label]           — label do campo
   * @param {string}  [opts.placeholder]
   * @param {string}  [opts.valorInicial]
   * @param {'input'|'textarea'} [opts.campo] — tipo do campo (default: textarea)
   * @param {number}  [opts.minLength]        — mínimo de caracteres (default: 3)
   * @param {number}  [opts.maxLength]        — máximo de caracteres (default: 200)
   * @param {boolean} [opts.perigo]
   * @param {string}  [opts.txtConfirmar]
   * @param {string}  [opts.txtCancelar]
   * @param {string}  [opts.emoji]
   * @param {string}  [opts.errMsg]           — mensagem de erro de validação
   * @returns {Promise<string|null>} — null se cancelado
   */
  function prompt(opts) {
    if (typeof opts === 'string') opts = { titulo: opts };

    return new Promise(resolve => {
      const tipo          = opts.perigo ? 'danger' : 'neutral';
      const campo         = opts.campo  || 'textarea';
      const minLen        = opts.minLength  ?? 3;
      const maxLen        = opts.maxLength  ?? 200;
      const txtConfirmar  = opts.txtConfirmar || 'Confirmar';
      const txtCancelar   = opts.txtCancelar  || 'Cancelar';
      const btnClass      = opts.perigo ? 'ux04-btn-danger' : 'ux04-btn-confirm';
      const errMsg        = opts.errMsg || `Preencha pelo menos ${minLen} caractere(s).`;
      const fieldId       = 'ux04-field-' + Math.random().toString(36).slice(2, 8);
      const errId         = 'ux04-err-' + Math.random().toString(36).slice(2, 8);
      const countId       = 'ux04-cnt-' + Math.random().toString(36).slice(2, 8);

      const campoHTML = campo === 'textarea'
        ? `<textarea
             class="ux04-textarea"
             id="${fieldId}"
             maxlength="${maxLen}"
             placeholder="${opts.placeholder || 'Escreva aqui…'}"
             rows="4"
             aria-describedby="${errId}"
           >${opts.valorInicial || ''}</textarea>`
        : `<input
             type="text"
             class="ux04-input"
             id="${fieldId}"
             maxlength="${maxLen}"
             placeholder="${opts.placeholder || ''}"
             value="${opts.valorInicial || ''}"
             aria-describedby="${errId}"
           />`;

      const corpo = `
        <div class="ux04-field">
          ${opts.label ? `<label class="ux04-label" for="${fieldId}">${opts.label}</label>` : ''}
          ${campoHTML}
          <div class="ux04-field-error" id="${errId}">${errMsg}</div>
          <div class="ux04-char-count" id="${countId}">
            0 / ${maxLen}
          </div>
        </div>`;

      const accoesHTML = `
        <button class="ux04-btn ux04-btn-cancel" data-ux04-cancel>${txtCancelar}</button>
        <button class="ux04-btn ${btnClass}" data-ux04-ok disabled>${txtConfirmar}</button>
      `;

      const { overlay, fechar, _onKey } = _buildModal({
        titulo:    opts.titulo,
        subtitulo: opts.subtitulo,
        tipo,
        emoji:     opts.emoji,
        corpo,
        accoesHTML
      });

      const fieldEl   = overlay.querySelector('#' + fieldId);
      const errEl     = overlay.querySelector('#' + errId);
      const countEl   = overlay.querySelector('#' + countId);
      const btnOk     = overlay.querySelector('[data-ux04-ok]');
      const btnCancel = overlay.querySelector('[data-ux04-cancel]');

      /* Contador de caracteres e validação */
      function _validate() {
        const val = fieldEl?.value?.trim() || '';
        const len = (fieldEl?.value || '').length;

        if (countEl) {
          countEl.textContent = `${len} / ${maxLen}`;
          countEl.className = 'ux04-char-count' +
            (len > maxLen * .9  ? ' warn' : '') +
            (len >= maxLen      ? ' over' : '');
        }

        const valid = val.length >= minLen;
        if (btnOk) btnOk.disabled = !valid;

        if (!valid && val.length > 0) {
          fieldEl.classList.add('error');
          if (errEl) errEl.classList.add('visible');
        } else {
          fieldEl.classList.remove('error');
          if (errEl) errEl.classList.remove('visible');
        }

        return valid;
      }

      fieldEl?.addEventListener('input', _validate);

      /* Inicializar com valor pré-existente */
      if (opts.valorInicial) {
        setTimeout(_validate, 10);
      }

      function _done(val) {
        document.removeEventListener('keydown', _onKey);
        fechar();
        resolve(val);
      }

      btnOk?.addEventListener('click', () => {
        if (_validate()) {
          _done((fieldEl?.value || '').trim());
        }
      });

      btnCancel?.addEventListener('click', () => _done(null));

      /* Fechar overlay = cancelar */
      overlay.addEventListener('click', e => {
        if (e.target === overlay) _done(null);
      });

      /* Submit com Enter (só em input simples) */
      if (campo === 'input') {
        fieldEl?.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (_validate()) _done((fieldEl.value || '').trim());
          }
        });
      }

      /* Ctrl+Enter em textarea */
      if (campo === 'textarea') {
        fieldEl?.addEventListener('keydown', e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (_validate()) _done((fieldEl.value || '').trim());
          }
        });
      }

      /* Focar no campo */
      setTimeout(() => {
        fieldEl?.focus();
        if (campo === 'textarea' && fieldEl) {
          const len = fieldEl.value.length;
          fieldEl.setSelectionRange(len, len);
        }
      }, 80);
    });
  }

  /* ════════════════════════════════════════════════════════════
     UX04.alert()
     Substitui alert() nativo.
  ════════════════════════════════════════════════════════════ */

  /**
   * Modal de alerta simples.
   *
   * @param {object|string} opts
   * @param {string}  opts.titulo
   * @param {string}  [opts.mensagem]
   * @param {'danger'|'warning'|'info'|'success'} [opts.tipo]
   * @param {string}  [opts.txtFechar]
   * @returns {Promise<void>}
   */
  function alert(opts) {
    if (typeof opts === 'string') opts = { titulo: opts };

    return new Promise(resolve => {
      const tipo      = opts.tipo     || 'info';
      const txtFechar = opts.txtFechar || 'Fechar';

      const corpo = opts.mensagem
        ? `<p class="ux04-msg">${opts.mensagem}</p>`
        : '';

      const accoesHTML = `
        <button class="ux04-btn ux04-btn-confirm" data-ux04-ok>${txtFechar}</button>
      `;

      const { overlay, fechar, _onKey } = _buildModal({
        titulo:    opts.titulo,
        subtitulo: opts.subtitulo,
        tipo,
        emoji:     opts.emoji,
        corpo,
        accoesHTML
      });

      overlay.querySelector('[data-ux04-ok]')?.addEventListener('click', () => {
        document.removeEventListener('keydown', _onKey);
        fechar();
        resolve();
      });

      setTimeout(() => overlay.querySelector('[data-ux04-ok]')?.focus(), 80);
    });
  }

  /* ════════════════════════════════════════════════════════════
     UX04.toast()
     Sistema de toasts modernos com stacking.
  ════════════════════════════════════════════════════════════ */

  let _toastWrap = null;
  const _MAX_TOASTS = 4;

  function _getToastWrap() {
    if (_toastWrap) return _toastWrap;
    _toastWrap = document.createElement('div');
    _toastWrap.id = 'ux04-toast-wrap';
    _toastWrap.setAttribute('aria-live', 'polite');
    _toastWrap.setAttribute('aria-atomic', 'false');
    document.body.appendChild(_toastWrap);
    return _toastWrap;
  }

  const TOAST_CONFIG = {
    success: { icon: '✅', label: 'Sucesso',     bg: 'success' },
    error:   { icon: '❌', label: 'Erro',        bg: 'error'   },
    warn:    { icon: '⚠️',  label: 'Atenção',    bg: 'warn'    },
    info:    { icon: 'ℹ️',  label: 'Informação', bg: 'info'    },
  };

  /**
   * Mostra um toast moderno.
   *
   * @param {string} mensagem
   * @param {'success'|'error'|'warn'|'info'} tipo
   * @param {number} [duracao=4500] — ms, 0 = permanente
   * @param {string} [titulo]       — título opcional
   */
  function toast(mensagem, tipo, duracao, titulo) {
    tipo    = tipo    || 'info';
    duracao = duracao ?? 4500;

    const wrap  = _getToastWrap();
    const cfg   = TOAST_CONFIG[tipo] || TOAST_CONFIG.info;
    const el    = document.createElement('div');

    el.className = `ux04-toast ${cfg.bg}`;
    el.setAttribute('role', 'alert');
    el.innerHTML = `
      <div class="ux04-toast-icon">${cfg.icon}</div>
      <div class="ux04-toast-body">
        <div class="ux04-toast-title">${titulo || cfg.label}</div>
        <div class="ux04-toast-msg"></div>
      </div>
      <button class="ux04-toast-close" aria-label="Fechar">✕</button>
      ${duracao > 0
        ? `<div class="ux04-toast-progress"
               style="animation: ux04toastProgress ${duracao}ms linear forwards"></div>`
        : ''}
    `;

    /* Limitar stack */
    const actuais = wrap.querySelectorAll('.ux04-toast');
    if (actuais.length >= _MAX_TOASTS) {
      _dismissToast(actuais[actuais.length - 1]);
    }

    wrap.prepend(el);

    const msgEl = el.querySelector('.ux04-toast-msg');

    if (msgEl) {
    msgEl.textContent = mensagem;
    }

    /* Dismiss */
    function dismiss() { _dismissToast(el); }
    el.addEventListener('click', dismiss);
    el.querySelector('.ux04-toast-close')
      ?.addEventListener('click', e => { e.stopPropagation(); dismiss(); });

    if (duracao > 0) setTimeout(dismiss, duracao);

    return dismiss;
  }

  /* Injectar keyframe de progresso dinamicamente */
  function _ensureProgressKeyframe() {
    if (document.getElementById('ux04-progress-kf')) return;
    const s = document.createElement('style');
    s.id = 'ux04-progress-kf';
    s.textContent = `
      @keyframes ux04toastProgress {
        from { width: 100%; }
        to   { width: 0%;   }
      }
    `;
    document.head.appendChild(s);
  }

  function _dismissToast(el) {
    if (!el || !el.parentNode) return;
    el.classList.add('ux04-toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 350);
  }

  /* ════════════════════════════════════════════════════════════
     MICRO-FEEDBACK: adicionar classe press-feedback
     a todos os botões de acção do dashboard
  ════════════════════════════════════════════════════════════ */
  function _applyPressFeedback() {
    const selector = [
      '.btn-next',
      '.btn-conclude',
      '.btn-deny',
      '.btn-pause',
      '.btn-redirect',
      '.btn-docs',
      '.btn-action',
      '.export-btn',
      '.btn-redir-confirm',
    ].join(', ');

    document.querySelectorAll(selector).forEach(btn => {
      if (!btn.classList.contains('ux04-press-feedback')) {
        btn.classList.add('ux04-press-feedback');
      }
    });
  }

  /* ════════════════════════════════════════════════════════════
     INICIALIZAÇÃO
  ════════════════════════════════════════════════════════════ */
  _injectCSS();
  _ensureProgressKeyframe();

  /* Aplicar micro-feedback após DOM pronto */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyPressFeedback);
  } else {
    setTimeout(_applyPressFeedback, 100);
  }

  /* ── Expor API pública ──────────────────────────────────── */
  window.UX04 = {
    confirm,
    prompt,
    alert,
    toast,
    refresh: _applyPressFeedback, // Reaplica micro-feedback (para botões dinâmicos)
  };

  console.log('✅ UX04 — Modais + Toasts Profissionais carregado');

})();