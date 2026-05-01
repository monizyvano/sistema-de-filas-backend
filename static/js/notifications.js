/**
 * static/js/notifications.js — Sprint 4 FIXED
 * ═══════════════════════════════════════════════════════════════
 * Sistema de notificações com foco em:
 *   • Tela CLIENTE  → banner topo, vibração, som, toast mobile
 *   • Tela TRABALHADOR → toasts laterais, som subtil
 *
 * API PÚBLICA:
 *   IMTSBNotifications.notify(type, message, duration?)
 *   IMTSBNotifications.toast(message, type, duration?)
 *   IMTSBNotifications.play(type)
 *   IMTSBNotifications.vibrate(type)
 *   IMTSBNotifications.onCall(numero, balcao)
 *   IMTSBNotifications.onConclude(numero)
 *   IMTSBNotifications.onDeny(numero)
 *   IMTSBNotifications.onRedirect(numero, servico)
 *   IMTSBNotifications.clientCalled(numero, balcao, atendente)
 *
 * TIPOS: call | success | warn | error | info | conclude | deny
 *        redirect | pause | resume
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ════════════════════════════════════════════════════════════
     ESTILOS — injectados uma vez no <head>
  ════════════════════════════════════════════════════════════ */
  const CSS = `
    /* ── Toast container ──────────────────────────────── */
    .imtsb-wrap {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: .45rem;
      pointer-events: none;
      max-width: 340px;
      width: calc(100vw - 2rem);
    }

    /* ── Toast base ───────────────────────────────────── */
    .imtsb-toast {
      display: flex;
      align-items: flex-start;
      gap: .65rem;
      padding: .85rem 1rem 1rem;
      border-radius: 14px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: .875rem;
      font-weight: 500;
      color: #fff;
      box-shadow: 0 8px 28px rgba(0,0,0,.3), 0 1px 0 rgba(255,255,255,.1) inset;
      pointer-events: all;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      animation: imtsb-in .3s cubic-bezier(.16,1,.3,1) both;
      line-height: 1.45;
      -webkit-tap-highlight-color: transparent;
    }

    @keyframes imtsb-in {
      from { opacity:0; transform:translateX(22px) scale(.96); }
      to   { opacity:1; transform:translateX(0)    scale(1);   }
    }
    @keyframes imtsb-out {
      from { opacity:1; transform:translateX(0)    scale(1);   }
      to   { opacity:0; transform:translateX(22px) scale(.96); }
    }
    @keyframes imtsb-progress {
      from { width:100%; }
      to   { width:0%;   }
    }

    .imtsb-toast-icon  { font-size:1.2rem; flex-shrink:0; margin-top:.05rem; }
    .imtsb-toast-body  { flex:1; min-width:0; }
    .imtsb-toast-label {
      font-size:.7rem; font-weight:700;
      text-transform:uppercase; letter-spacing:.08em;
      opacity:.75; margin-bottom:.18rem;
    }
    .imtsb-toast-msg   { font-weight:500; word-break:break-word; }
    .imtsb-toast-close {
      background:rgba(255,255,255,.18); border:none; color:#fff;
      width:22px; height:22px; border-radius:50%; cursor:pointer;
      font-size:.85rem; line-height:1; padding:0; flex-shrink:0;
      margin-top:.05rem; display:flex; align-items:center; justify-content:center;
    }
    .imtsb-progress {
      position:absolute; bottom:0; left:0; height:3px;
      background:rgba(255,255,255,.35); border-radius:0 0 14px 14px;
    }

    /* ── Banner de chamada (cliente) ──────────────────── */
    .imtsb-call-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 100000;
      background: linear-gradient(135deg, #3e2510, #6b4226);
      color: #fff;
      box-shadow: 0 6px 28px rgba(0,0,0,.4);
      animation: imtsb-banner-in .38s cubic-bezier(.16,1,.3,1);
    }
    @keyframes imtsb-banner-in {
      from { transform:translateY(-100%); opacity:0; }
      to   { transform:translateY(0);     opacity:1; }
    }
    .imtsb-call-banner-inner {
      max-width: 700px;
      margin: 0 auto;
      padding: 1.15rem 1.35rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .imtsb-call-bell {
      font-size: 2.4rem;
      animation: imtsb-ring .5s ease-in-out infinite alternate;
      flex-shrink: 0;
    }
    @keyframes imtsb-ring {
      from { transform:rotate(-14deg) scale(1);    }
      to   { transform:rotate(14deg)  scale(1.08); }
    }
    .imtsb-call-content { flex: 1; }
    .imtsb-call-label   { font-size:.72rem; opacity:.75; text-transform:uppercase; letter-spacing:.08em; }
    .imtsb-call-number  { font-family:'Poppins',sans-serif; font-size:1.55rem; font-weight:900; line-height:1.1; }
    .imtsb-call-sub     { font-size:.88rem; opacity:.82; margin-top:.2rem; }
    .imtsb-call-close   {
      background:rgba(255,255,255,.18); border:none; color:#fff;
      width:36px; height:36px; border-radius:50%; cursor:pointer;
      font-size:1.1rem; display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
      -webkit-tap-highlight-color: transparent;
    }
    .imtsb-call-close:hover { background:rgba(255,255,255,.32); }

    /* Mobile — banner mais compacto */
    @media (max-width: 500px) {
      .imtsb-wrap { top:.6rem; right:.6rem; max-width:calc(100vw - 1.2rem); }
      .imtsb-call-number { font-size:1.3rem; }
      .imtsb-call-bell   { font-size:1.8rem; }
    }
  `;

  /* ════════════════════════════════════════════════════════════
     CONFIG POR TIPO
  ════════════════════════════════════════════════════════════ */
  const TYPES = {
    call:     { bg:'linear-gradient(135deg,#1d4ed8,#2563eb)', icon:'🔔', label:'Chamada'       },
    success:  { bg:'linear-gradient(135deg,#047857,#059669)', icon:'✅', label:'Sucesso'        },
    warn:     { bg:'linear-gradient(135deg,#b45309,#d97706)', icon:'⚠️', label:'Atenção'       },
    error:    { bg:'linear-gradient(135deg,#b91c1c,#dc2626)', icon:'❌', label:'Erro'           },
    info:     { bg:'linear-gradient(135deg,#0369a1,#0284c7)', icon:'ℹ️', label:'Informação'   },
    conclude: { bg:'linear-gradient(135deg,#065f46,#059669)', icon:'✓',  label:'Concluído'     },
    deny:     { bg:'linear-gradient(135deg,#991b1b,#b91c1c)', icon:'🚫', label:'Negado'        },
    redirect: { bg:'linear-gradient(135deg,#5b21b6,#7c3aed)', icon:'↪️', label:'Redireccionado'},
    pause:    { bg:'linear-gradient(135deg,#92400e,#d97706)', icon:'⏸',  label:'Pausado'       },
    resume:   { bg:'linear-gradient(135deg,#065f46,#047857)', icon:'▶',  label:'Retomado'      },
  };

  /* ════════════════════════════════════════════════════════════
     SONS — Web Audio API (tons puros, sem ficheiros externos)
  ════════════════════════════════════════════════════════════ */
  const SOUNDS = {
    call:     [{ f:880,d:.09 },{ f:1100,d:.09 },{ f:880,d:.09 },{ f:1100,d:.18 }],
    success:  [{ f:523,d:.09 },{ f:659,d:.09 },{ f:784,d:.18 }],
    warn:     [{ f:440,d:.14 },{ f:392,d:.22 }],
    error:    [{ f:392,d:.10 },{ f:330,d:.10 },{ f:220,d:.22 }],
    info:     [{ f:659,d:.09 },{ f:784,d:.16 }],
    conclude: [{ f:523,d:.07 },{ f:659,d:.07 },{ f:784,d:.07 },{ f:1047,d:.2 }],
    deny:     [{ f:392,d:.14 },{ f:294,d:.28 }],
    redirect: [{ f:523,d:.09 },{ f:698,d:.09 },{ f:880,d:.18 }],
    pause:    [{ f:494,d:.12 },{ f:392,d:.2  }],
    resume:   [{ f:392,d:.10 },{ f:494,d:.18 }],
  };

  /* ════════════════════════════════════════════════════════════
     VIBRAÇÃO — padrões específicos por acção
  ════════════════════════════════════════════════════════════ */
  const VIBRATIONS = {
    call:     [100, 50, 100, 50, 200],  // urgente: rítmico longo
    success:  [80, 40, 80],
    warn:     [200, 80, 150],
    error:    [300],
    info:     [60, 30, 60],
    conclude: [80, 40, 80, 40, 80],
    deny:     [250, 100, 80],
    redirect: [120, 60, 120],
    pause:    [120, 60, 80],
    resume:   [80, 40, 120],
  };

  /* ════════════════════════════════════════════════════════════
     MÓDULO PRINCIPAL
  ════════════════════════════════════════════════════════════ */
  const IMTSBNotifications = {

    _wrap:     null,
    _ctx:      null,
    _unlocked: false,

    /* ── Setup ───────────────────────────────────────────── */
    _setup() {
      if (this._wrap) return;

      if (!document.getElementById('imtsb-n-css')) {
        const s = document.createElement('style');
        s.id = 'imtsb-n-css';
        s.textContent = CSS;
        document.head.appendChild(s);
      }

      this._wrap = document.createElement('div');
      this._wrap.className = 'imtsb-wrap';
      document.body.appendChild(this._wrap);
    },

    /* ── Áudio ───────────────────────────────────────────── */
    _getCtx() {
      if (!this._ctx) {
        try { this._ctx = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (_) { return null; }
      }
      if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
      return this._ctx;
    },

    unlock() {
      if (this._unlocked) return;
      this._unlocked = true;
      this._getCtx();
    },

    play(type) {
      const ctx   = this._getCtx();
      if (!ctx) return;
      const tones = SOUNDS[type] || SOUNDS.info;
      let   t     = ctx.currentTime + 0.02;

      tones.forEach(({ f, d, g = 0.26 }) => {
        try {
          const o = ctx.createOscillator();
          const v = ctx.createGain();
          o.connect(v); v.connect(ctx.destination);
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t);
          v.gain.setValueAtTime(g, t);
          v.gain.exponentialRampToValueAtTime(0.001, t + d);
          o.start(t); o.stop(t + d + .04);
          t += d;
        } catch (_) {}
      });
    },

    /* ── Vibração — foco mobile ──────────────────────────── */
    vibrate(type) {
      if (!navigator.vibrate) return;
      const pattern = VIBRATIONS[type] || VIBRATIONS.info;
      try { navigator.vibrate(pattern); } catch (_) {}
    },

    /* ── Toast lateral (ambas as telas) ─────────────────── */
    toast(message, type = 'info', duration = 4000, label = null) {
      this._setup();
      const cfg = TYPES[type] || TYPES.info;

      const el = document.createElement('div');
      el.className = 'imtsb-toast';
      el.style.background = cfg.bg;
      el.innerHTML = `
        <div class="imtsb-toast-icon">${cfg.icon}</div>
        <div class="imtsb-toast-body">
          <div class="imtsb-toast-label">${label || cfg.label}</div>
          <div class="imtsb-toast-msg">${message}</div>
        </div>
        <button class="imtsb-toast-close" aria-label="Fechar">✕</button>
        ${duration > 0
          ? `<div class="imtsb-progress" style="animation:imtsb-progress ${duration}ms linear forwards;"></div>`
          : ''}
      `;

      const dismiss = () => this._dismiss(el);
      el.addEventListener('click', dismiss);
      el.querySelector('.imtsb-toast-close').addEventListener('click', e => {
        e.stopPropagation(); dismiss();
      });

      this._wrap.appendChild(el);
      if (duration > 0) setTimeout(dismiss, duration);

      /* Máximo 4 toasts visíveis */
      const all = Array.from(this._wrap.children);
      if (all.length > 4) this._dismiss(all[0]);

      return el;
    },

    _dismiss(el) {
      if (!el || !el.parentNode) return;
      el.style.animation = 'imtsb-out .25s ease-in forwards';
      setTimeout(() => el.parentNode && el.remove(), 250);
    },

    /* ── Notificação completa (som + vibração + toast) ───── */
    notify(type, message, duration = 4500, label = null) {
      this.play(type);
      this.vibrate(type);
      return this.toast(message, type, duration, label);
    },

    /* ════════════════════════════════════════════════════════
       BANNER DE CHAMADA — exclusivo para tela do CLIENTE
       Aparece no topo, grande, com vibração longa
    ════════════════════════════════════════════════════════ */
    clientCalled(numero, balcao, atendente) {
      /* Remover banner anterior */
      document.getElementById('imtsb-call-banner')?.remove();

      /* Vibração intensa no telemóvel */
      if (navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (_) {}
      }

      /* Som de chamada */
      this.play('call');

      /* Banner HTML */
      const banner = document.createElement('div');
      banner.id    = 'imtsb-call-banner';
      banner.className = 'imtsb-call-banner';
      banner.innerHTML = `
        <div class="imtsb-call-banner-inner">
          <div class="imtsb-call-bell">🔔</div>
          <div class="imtsb-call-content">
            <div class="imtsb-call-label">A sua vez!</div>
            <div class="imtsb-call-number">Senha ${numero}</div>
            <div class="imtsb-call-sub">
              Dirija-se ao <strong>Balcão ${balcao}</strong>
              ${atendente ? ` · ${atendente}` : ''}
            </div>
          </div>
          <button class="imtsb-call-close" onclick="document.getElementById('imtsb-call-banner')?.remove()">✕</button>
        </div>
      `;

      document.body.prepend(banner);

      /* Fechar ao tocar em qualquer sítio do banner (exceto o X) */
      banner.addEventListener('click', function(e) {
        if (!e.target.classList.contains('imtsb-call-close')) {
          banner.remove();
        }
      });

      /* Auto-fechar após 30 segundos */
      setTimeout(() => banner.remove(), 30000);

      /* Segunda vibração após 2s (reforço) */
      setTimeout(() => {
        if (navigator.vibrate) {
          try { navigator.vibrate([150, 75, 150]); } catch (_) {}
        }
      }, 2000);
    },

    /* ════════════════════════════════════════════════════════
       NOTIFICAÇÃO NATIVA DO BROWSER (se autorizado)
       Útil quando o utilizador minimiza o browser no telemóvel
    ════════════════════════════════════════════════════════ */
    async requestPermission() {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied')  return false;
      const r = await Notification.requestPermission().catch(() => 'denied');
      return r === 'granted';
    },

    async nativeNotify(title, body, icon) {
      if (!('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      try {
        new Notification(title, {
          body,
          icon: icon || '/static/image/logo.png',
          badge: '/static/image/logo.png',
          vibrate: [200, 100, 200],
          tag: 'imtsb-call',
          renotify: true,
        });
      } catch (_) {}
    },

    /* ── Atalhos para acções comuns ──────────────────────── */

    /* Trabalhador chamou senha */
    onCall(numero, balcao) {
      this.notify('call', `Senha <strong>${numero}</strong> chamada — Balcão ${balcao}`, 5000);
    },

    /* Atendimento concluído (trabalhador) */
    onConclude(numero) {
      this.notify('conclude', `Atendimento <strong>${numero}</strong> concluído.`, 3500);
    },

    /* Senha negada (trabalhador) */
    onDeny(numero) {
      this.notify('deny', `Senha <strong>${numero}</strong> negada. Motivo registado.`, 5000);
    },

    /* Senha redireccionada (trabalhador) */
    onRedirect(numero, servico) {
      this.notify('redirect',
        `Senha <strong>${numero}</strong> redireccionada para <strong>${servico}</strong>.`, 5000);
    },

    /* Senha cancelada */
    onCancel(numero) {
      this.notify('warn', `Senha <strong>${numero}</strong> cancelada.`, 4500);
    },

    /* Erro genérico */
    onError(msg) {
      this.notify('error', msg || 'Erro ao processar operação.', 5000);
    },
  };

  /* ── Desbloquear áudio no primeiro gesto ──────────────── */
  const _unlock = () => IMTSBNotifications.unlock();
  ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(ev =>
    document.addEventListener(ev, _unlock, { once: true, passive: true })
  );

  /* ── Pedir permissão de notificação ao carregar ─────────── */
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      IMTSBNotifications.requestPermission().catch(() => {});
    });
  }

  window.IMTSBNotifications = IMTSBNotifications;
  console.log('✅ IMTSBNotifications v4 (mobile-first) carregado');

})();