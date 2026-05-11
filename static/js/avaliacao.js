/**
 * avaliacao.js
 * ═══════════════════════════════════════════════════════════════
 * Módulo de Avaliação de Atendimento — Sistema de Filas IMTSB
 *
 * Responsabilidades:
 *   - Renderizar o bloco de avaliação por estrelas
 *   - Enviar POST /api/tickets/rate com JWT automático
 *   - Gerir estados: disponível → enviando → enviado / erro
 *   - Prevenção de dupla submissão em memória
 *
 * Integração:
 *   1. Importar este ficheiro DEPOIS do teu dashusuario.js principal
 *      <script src="/js/avaliacao.js"></script>
 *
 *   2. Na função que renderiza a senha concluída, chamar:
 *      AvaliacaoModule.render(container, ticket_id)
 *
 *   3. Não altera nenhum HTML/CSS existente.
 *
 * Dependências:
 *   - window.localStorage com chave 'access_token' (JWT)
 *   - Nenhuma biblioteca externa
 *
 * ═══════════════════════════════════════════════════════════════
 */

"use strict";

const AvaliacaoModule = (() => {

  // ─── CONFIG ────────────────────────────────────────────────
  const API_URL       = "/api/tickets/rate";
  const TOKEN_KEY     = "access_token";   // chave no localStorage
  const CSS_PREFIX    = "aval";           // prefixo de classes CSS

  // Mapa em memória: ticket_id → true (evita dupla submissão)
  const _enviados = new Set();

  // ─── HELPERS PRIVADOS ───────────────────────────────────────

  /**
   * Devolve o JWT guardado no localStorage.
   * @returns {string|null}
   */
  function _getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Insere os estilos do módulo uma única vez no <head>.
   * Evita conflitos com CSS do projecto existente.
   */
  function _injectStyles() {
    if (document.getElementById(`${CSS_PREFIX}-styles`)) return;

    const style = document.createElement("style");
    style.id = `${CSS_PREFIX}-styles`;
    style.textContent = `
      /* ── Wrapper do bloco de avaliação ── */
      .aval-wrapper {
        margin-top: 1rem;
        padding: 1.25rem 1.5rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        font-family: inherit;
        transition: opacity 0.3s ease;
      }

      .aval-wrapper.aval-disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      /* ── Título ── */
      .aval-titulo {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin: 0 0 0.875rem;
      }

      /* ── Estrelas ── */
      .aval-estrelas {
        display: flex;
        gap: 0.375rem;
        margin-bottom: 0.875rem;
      }

      .aval-estrela {
        width: 2.25rem;
        height: 2.25rem;
        border: none;
        background: none;
        cursor: pointer;
        padding: 0;
        transition: transform 0.15s ease, filter 0.15s ease;
        line-height: 1;
        font-size: 1.75rem;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        /* cor desactivada */
        filter: grayscale(1) opacity(0.35);
      }

      .aval-estrela:hover,
      .aval-estrela.aval-hover {
        transform: scale(1.2);
        filter: grayscale(0) opacity(1);
      }

      .aval-estrela.aval-ativa {
        filter: grayscale(0) opacity(1);
        transform: scale(1.05);
      }

      /* ── Texto de score ── */
      .aval-label-score {
        font-size: 0.8125rem;
        color: #475569;
        min-height: 1.2em;
        margin-bottom: 0.75rem;
        font-weight: 500;
        transition: color 0.2s;
      }

      /* ── Comentário ── */
      .aval-comentario {
        width: 100%;
        box-sizing: border-box;
        padding: 0.625rem 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.875rem;
        font-family: inherit;
        color: #1e293b;
        background: #fff;
        resize: vertical;
        min-height: 70px;
        max-height: 160px;
        transition: border-color 0.2s, box-shadow 0.2s;
        margin-bottom: 0.875rem;
      }

      .aval-comentario::placeholder { color: #94a3b8; }
      .aval-comentario:focus {
        outline: none;
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99,102,241,.15);
      }

      /* ── Botão enviar ── */
      .aval-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s, transform 0.15s, opacity 0.2s;
      }

      .aval-btn:hover  { background: #4f46e5; }
      .aval-btn:active { transform: scale(0.97); }
      .aval-btn:disabled {
        background: #94a3b8;
        cursor: not-allowed;
        transform: none;
      }

      /* ── Spinner inline ── */
      .aval-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255,255,255,.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: aval-spin 0.7s linear infinite;
      }

      @keyframes aval-spin { to { transform: rotate(360deg); } }

      /* ── Mensagem de sucesso ── */
      .aval-sucesso {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #16a34a;
        font-size: 0.875rem;
        font-weight: 600;
        padding: 0.75rem 0;
        animation: aval-fade-in 0.4s ease;
      }

      .aval-sucesso svg { flex-shrink: 0; }

      /* ── Mensagem de erro ── */
      .aval-erro {
        color: #dc2626;
        font-size: 0.8125rem;
        margin-top: 0.5rem;
        animation: aval-fade-in 0.3s ease;
      }

      /* ── Já avaliado (só leitura) ── */
      .aval-readonly {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: #64748b;
        padding: 0.5rem 0;
      }

      @keyframes aval-fade-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* ── Score: cores por valor ── */
      [data-score="1"] { color: #ef4444; }
      [data-score="2"] { color: #f97316; }
      [data-score="3"] { color: #eab308; }
      [data-score="4"] { color: #22c55e; }
      [data-score="5"] { color: #6366f1; }
    `;

    document.head.appendChild(style);
  }

  /**
   * Rótulos por pontuação (1–5).
   * @param {number} n
   * @returns {string}
   */
  function _labelScore(n) {
    return ["", "Muito mau", "Mau", "Razoável", "Bom", "Excelente"][n] || "";
  }

  /**
   * Ícone SVG de check para o estado de sucesso.
   * @returns {string} HTML string
   */
  function _iconCheck() {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>`;
  }

  // ─── API CALL ───────────────────────────────────────────────

  /**
   * Envia avaliação ao backend.
   *
   * @param {number} ticketId  — ID da senha
   * @param {number} score     — 1 a 5
   * @param {string} comment   — Comentário opcional
   * @returns {Promise<{ok: boolean, data: object, status: number}>}
   */
  async function enviarAvaliacao(ticketId, score, comment = "") {
    const token = _getToken();

    const response = await fetch(API_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ticket_id: ticketId,
        score,
        comment: comment.trim(),
      }),
    });

    let data = {};
    try { data = await response.json(); } catch (_) {}

    return { ok: response.ok, data, status: response.status };
  }

  // ─── RENDERER ───────────────────────────────────────────────

  /**
   * Renderiza o bloco de avaliação dentro de um container existente.
   *
   * @param {HTMLElement} container — Elemento onde injectar o bloco
   * @param {number}      ticketId  — ID da senha a avaliar
   * @param {Object}      [opts]    — Opções adicionais
   * @param {boolean}     [opts.jaAvaliado=false] — Se true, mostra só leitura
   * @param {number}      [opts.scoreExistente]   — Score para exibir (só leitura)
   */
  function render(container, ticketId, opts = {}) {
    _injectStyles();

    // ── Já avaliado anteriormente ────────────────────────────
    if (opts.jaAvaliado || _enviados.has(ticketId)) {
      const score = opts.scoreExistente || "—";
      container.insertAdjacentHTML("beforeend", `
        <div class="aval-readonly" data-aval-ticket="${ticketId}">
          ${_iconCheck()}
          Avaliação registada
          ${opts.scoreExistente
            ? `<span style="margin-left:auto;font-weight:700"
                     data-score="${opts.scoreExistente}">
                 ${"★".repeat(opts.scoreExistente)}${"☆".repeat(5 - opts.scoreExistente)}
               </span>`
            : ""}
        </div>
      `);
      return;
    }

    // ── Estado interno ───────────────────────────────────────
    let scoreSeleccionado = 0;

    // ── Estrutura HTML do bloco ──────────────────────────────
    const wrapper = document.createElement("div");
    wrapper.className = "aval-wrapper";
    wrapper.dataset.avalTicket = ticketId;
    wrapper.innerHTML = `
      <p class="aval-titulo">Avaliar atendimento</p>

      <div class="aval-estrelas" role="radiogroup"
           aria-label="Pontuação de 1 a 5 estrelas">
        ${[1,2,3,4,5].map(n => `
          <button class="aval-estrela"
                  role="radio"
                  aria-checked="false"
                  aria-label="${n} ${n === 1 ? "estrela" : "estrelas"}"
                  data-valor="${n}"
                  title="${_labelScore(n)}">★</button>
        `).join("")}
      </div>

      <p class="aval-label-score" aria-live="polite">
        Clique numa estrela para avaliar
      </p>

      <textarea
        class="aval-comentario"
        placeholder="Comentário opcional (máx. 500 caracteres)"
        maxlength="500"
        aria-label="Comentário sobre o atendimento"
      ></textarea>

      <button class="aval-btn" disabled aria-label="Enviar avaliação">
        Enviar avaliação
      </button>

      <p class="aval-erro" style="display:none" role="alert"></p>
    `;

    container.appendChild(wrapper);

    // ── Referências aos elementos ────────────────────────────
    const estrelas  = wrapper.querySelectorAll(".aval-estrela");
    const labelScr  = wrapper.querySelector(".aval-label-score");
    const textarea  = wrapper.querySelector(".aval-comentario");
    const btnEnviar = wrapper.querySelector(".aval-btn");
    const pErro     = wrapper.querySelector(".aval-erro");

    // ── Actualizar UI de estrelas ────────────────────────────
    function _actualizarEstrelas(valor) {
      estrelas.forEach((btn, i) => {
        const activa = i < valor;
        btn.classList.toggle("aval-ativa", activa);
        btn.setAttribute("aria-checked", activa ? "true" : "false");
      });
      labelScr.textContent = valor
        ? `${valor}/5 — ${_labelScore(valor)}`
        : "Clique numa estrela para avaliar";
      labelScr.dataset.score = valor || "";
    }

    // ── Eventos: hover nas estrelas ──────────────────────────
    estrelas.forEach(btn => {
      const n = parseInt(btn.dataset.valor, 10);

      btn.addEventListener("mouseenter", () => {
        estrelas.forEach((b, i) => b.classList.toggle("aval-hover", i < n));
        labelScr.textContent = `${n}/5 — ${_labelScore(n)}`;
      });

      btn.addEventListener("mouseleave", () => {
        estrelas.forEach(b => b.classList.remove("aval-hover"));
        _actualizarEstrelas(scoreSeleccionado);
      });

      // ── Seleccionar score ────────────────────────────────
      btn.addEventListener("click", () => {
        scoreSeleccionado = n;
        _actualizarEstrelas(n);
        btnEnviar.disabled = false;
        pErro.style.display = "none";
      });

      // ── Teclado (accessibilidade) ────────────────────────
      btn.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          btn.click();
        }
      });
    });

    // ── Evento: enviar ───────────────────────────────────────
    btnEnviar.addEventListener("click", async () => {
      if (!scoreSeleccionado) return;
      if (_enviados.has(ticketId)) return;

      // Desactivar durante o pedido
      wrapper.classList.add("aval-disabled");
      btnEnviar.disabled = true;
      btnEnviar.innerHTML = `<span class="aval-spinner"></span> A enviar...`;
      pErro.style.display = "none";

      try {
        const { ok, data, status } = await enviarAvaliacao(
          ticketId,
          scoreSeleccionado,
          textarea.value
        );

        if (ok) {
          // ── SUCESSO ────────────────────────────────────
          _enviados.add(ticketId);

          wrapper.innerHTML = `
            <div class="aval-sucesso">
              ${_iconCheck()}
              Avaliação enviada — obrigado pelo seu feedback!
            </div>
          `;

          // Disparar evento personalizado (para dashboard escutar se necessário)
          wrapper.dispatchEvent(new CustomEvent("aval:enviada", {
            bubbles: true,
            detail: { ticketId, score: scoreSeleccionado, data }
          }));

        } else {
          // ── ERRO DO SERVIDOR ───────────────────────────
          wrapper.classList.remove("aval-disabled");
          btnEnviar.disabled = false;
          btnEnviar.textContent = "Enviar avaliação";

          const msg = data?.message || `Erro ${status}. Tente novamente.`;

          if (status === 409) {
            // Já avaliado (race condition ou dupla aba)
            _enviados.add(ticketId);
            wrapper.innerHTML = `
              <div class="aval-readonly">
                ${_iconCheck()} Esta senha já foi avaliada.
              </div>
            `;
            return;
          }

          pErro.textContent = msg;
          pErro.style.display = "block";
          console.error("[AvaliacaoModule] Erro backend:", status, data);
        }

      } catch (err) {
        // ── ERRO DE REDE ─────────────────────────────────
        wrapper.classList.remove("aval-disabled");
        btnEnviar.disabled = false;
        btnEnviar.textContent = "Enviar avaliação";
        pErro.textContent = "Erro de ligação. Verifique a sua rede.";
        pErro.style.display = "block";
        console.error("[AvaliacaoModule] Erro de rede:", err);
      }
    });
  }

  // ─── API PÚBLICA ────────────────────────────────────────────
  return {
    /**
     * Renderiza o bloco de avaliação num container.
     *
     * @example
     * // Na função que renderiza a senha concluída:
     * const card = document.querySelector(`[data-ticket="${senha.id}"]`);
     * AvaliacaoModule.render(card, senha.id);
     *
     * // Com opções (já avaliado):
     * AvaliacaoModule.render(card, senha.id, {
     *   jaAvaliado: true,
     *   scoreExistente: 4
     * });
     */
    render,

    /**
     * Envia avaliação directamente (sem UI).
     * Útil para integrações programáticas.
     *
     * @example
     * const { ok, data } = await AvaliacaoModule.enviarAvaliacao(42, 5, "Excelente!");
     */
    enviarAvaliacao,
  };

})();