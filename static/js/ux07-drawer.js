/**
 * static/js/ux07-drawer.js
 * ═══════════════════════════════════════════════════════════════
 * UX-07 — Drawer de Detalhes da Senha
 *
 * Substitui informações fixas (obs card, modal admin) por um
 * drawer deslizante profissional.
 *
 * COMPORTAMENTO:
 *   • Desktop: slide da direita (420px)
 *   • Mobile:  bottom sheet (88vh, sobe do fundo)
 *   • ESC fecha | clique no backdrop fecha
 *   • Print integrado
 *
 * API:
 *   UX07.abrir(dados)  — abre com dados da senha
 *   UX07.fechar()      — fecha o drawer
 *   UX07.imprimir()    — imprime os dados actuais
 *
 * INTEGRAÇÃO:
 *   • Worker: substituir abrirDocumentoAtendimento()
 *   • Admin:  substituir verDetalhesSenha() (fallback ao modal original)
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ════════════════════════════════════════════════════════════
     CSS
  ════════════════════════════════════════════════════════════ */
  const CSS = `

    /* ── Backdrop ─────────────────────────────────────────── */
    .ux07-backdrop {
      position: fixed;
      inset: 0;
      z-index: 99980;
      background: rgba(0, 0, 0, 0);
      pointer-events: none;
      transition: background 0.3s ease;
    }

    .ux07-backdrop.ux07-vis {
      background: rgba(0, 0, 0, 0.45);
      pointer-events: auto;
    }

    /* ── Drawer ───────────────────────────────────────────── */
    .ux07-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 99981;
      width: min(460px, 100vw);
      background: #fff;
      display: flex;
      flex-direction: column;
      box-shadow: -6px 0 40px rgba(0, 0, 0, .18);
      transform: translateX(100%);
      transition: transform 0.38s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    .ux07-drawer.ux07-open {
      transform: translateX(0);
    }

    /* Mobile — bottom sheet */
    @media (max-width: 620px) {
      .ux07-drawer {
        top: auto;
        right: 0;
        left: 0;
        bottom: 0;
        width: 100%;
        max-height: 88dvh;
        max-height: 88vh;
        border-radius: 22px 22px 0 0;
        transform: translateY(102%);
      }

      .ux07-drawer.ux07-open {
        transform: translateY(0);
      }
    }

    /* ── Handle (mobile) ──────────────────────────────────── */
    .ux07-handle {
      display: none;
      width: 40px;
      height: 5px;
      background: rgba(255,255,255,.4);
      border-radius: 3px;
      margin: 0 auto .85rem;
    }

    @media (max-width: 620px) {
      .ux07-handle { display: block; }
    }

    /* ── Header ───────────────────────────────────────────── */
    .ux07-hd {
      background: linear-gradient(135deg, #3e2510 0%, #6b4226 100%);
      color: #fff;
      padding: 1.35rem 1.5rem 1.2rem;
      flex-shrink: 0;
      position: relative;
    }

    .ux07-hd-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .ux07-hd-meta {
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      opacity: .65;
      margin-bottom: .25rem;
    }

    .ux07-hd-num {
      font-family: 'Poppins', 'Inter', -apple-system, sans-serif;
      font-size: 2rem;
      font-weight: 900;
      line-height: 1.1;
    }

    .ux07-hd-serv {
      font-size: .9rem;
      opacity: .82;
      margin-top: .2rem;
      line-height: 1.35;
    }

    .ux07-x-btn {
      background: rgba(255,255,255,.18);
      border: none;
      color: #fff;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background .18s;
      -webkit-tap-highlight-color: transparent;
    }

    .ux07-x-btn:hover { background: rgba(255,255,255,.3); }

    .ux07-hd-badges {
      display: flex;
      gap: .4rem;
      margin-top: .7rem;
      flex-wrap: wrap;
    }

    .ux07-bdg {
      padding: .22rem .7rem;
      border-radius: 20px;
      font-size: .7rem;
      font-weight: 700;
      background: rgba(255,255,255,.18);
      color: #fff;
      letter-spacing: .03em;
    }

    .ux07-bdg-prio {
      background: rgba(245, 158, 11, .32);
      color: #fde68a;
    }

    .ux07-bdg-ok {
      background: rgba(5, 150, 105, .3);
      color: #a7f3d0;
    }

    .ux07-bdg-cancel {
      background: rgba(220, 38, 38, .3);
      color: #fca5a5;
    }

    /* ── Corpo ────────────────────────────────────────────── */
    .ux07-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.15rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      overscroll-behavior: contain;
    }

    .ux07-body::-webkit-scrollbar { width: 4px; }
    .ux07-body::-webkit-scrollbar-track { background: transparent; }
    .ux07-body::-webkit-scrollbar-thumb {
      background: rgba(107,66,38,.22);
      border-radius: 4px;
    }

    /* ── Section ──────────────────────────────────────────── */
    .ux07-sec-title {
      font-size: .68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: #8c6746;
      margin-bottom: .6rem;
      display: flex;
      align-items: center;
      gap: .55rem;
    }

    .ux07-sec-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(107,66,38,.14);
    }

    /* ── Meta grid ────────────────────────────────────────── */
    .ux07-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: .5rem;
    }

    .ux07-cell {
      background: #fdf8f5;
      border: 1px solid rgba(107,66,38,.1);
      border-radius: 11px;
      padding: .72rem .9rem;
    }

    .ux07-cell.full { grid-column: span 2; }

    .ux07-cell-label {
      font-size: .64rem;
      color: #8c6746;
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: .22rem;
    }

    .ux07-cell-value {
      font-size: .9rem;
      font-weight: 700;
      color: #3e2510;
      line-height: 1.3;
    }

    /* ── Form data ────────────────────────────────────────── */
    .ux07-form-block {
      background: #fdf8f5;
      border: 1px solid rgba(107,66,38,.14);
      border-radius: 12px;
      padding: .95rem 1.1rem;
      font-size: .875rem;
      color: #3e2510;
      line-height: 1.85;
      white-space: pre-wrap;
      word-break: break-word;
      min-height: 52px;
    }

    /* ── Attachment ───────────────────────────────────────── */
    .ux07-attach {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: .95rem 1.1rem;
    }

    .ux07-attach-name {
      font-size: .875rem;
      color: #1e3a5f;
      font-weight: 600;
      margin-bottom: .65rem;
      line-height: 1.35;
      word-break: break-all;
    }

    .ux07-attach-btns {
      display: flex;
      gap: .5rem;
      flex-wrap: wrap;
    }

    .ux07-abtn {
      padding: .42rem .95rem;
      border-radius: 9px;
      font-size: .82rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: opacity .18s, transform .12s;
      -webkit-tap-highlight-color: transparent;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: .35rem;
      min-height: 38px;
    }

    .ux07-abtn:active { transform: scale(.96); }

    .ux07-abtn-dl { background: #2563eb; color: #fff; }
    .ux07-abtn-dl:hover { opacity: .88; }

    .ux07-abtn-view { background: #e0f2fe; color: #0369a1; }
    .ux07-abtn-view:hover { background: #bfdbfe; }

    /* ── Avaliação ────────────────────────────────────────── */
    .ux07-rating {
      display: flex;
      align-items: center;
      gap: .65rem;
      padding: .75rem 1rem;
      background: #fef9f0;
      border: 1px solid rgba(245,158,11,.3);
      border-radius: 11px;
    }

    .ux07-stars { font-size: 1.1rem; }

    .ux07-rating-info {
      font-size: .85rem;
      color: #6b4226;
      font-weight: 600;
      line-height: 1.45;
    }

    .ux07-rating-comment {
      font-size: .8rem;
      color: #8c6746;
      font-weight: 400;
      font-style: italic;
      margin-top: .15rem;
    }

    /* ── Empty / no-attachment ────────────────────────────── */
    .ux07-empty-note {
      padding: .75rem 1rem;
      background: #f9f4ef;
      border: 1px dashed #d9cabc;
      border-radius: 10px;
      font-size: .82rem;
      color: #9c7b60;
      text-align: center;
    }

    /* ── Footer ───────────────────────────────────────────── */
    .ux07-ft {
      border-top: 1px solid rgba(107,66,38,.1);
      padding: 1rem 1.5rem;
      flex-shrink: 0;
      display: flex;
      gap: .55rem;
    }

    .ux07-ft-btn {
      padding: .75rem 1.1rem;
      border-radius: 11px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: .9rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      display: flex;
      align-items: center;
      gap: .4rem;
      justify-content: center;
      transition: opacity .18s, transform .12s;
      -webkit-tap-highlight-color: transparent;
      min-height: 46px;
    }

    .ux07-ft-btn:active { transform: scale(.97); }

    .ux07-ft-btn-primary {
      background: linear-gradient(135deg, #3e2510, #6b4226);
      color: #fff;
      flex: 1;
    }

    .ux07-ft-btn-primary:hover { opacity: .9; }

    .ux07-ft-btn-ghost {
      background: rgba(107,66,38,.1);
      color: #6b4226;
    }

    .ux07-ft-btn-ghost:hover { background: rgba(107,66,38,.16); }
  `;

  function _injectCSS() {
    if (document.getElementById('ux07-styles')) return;
    const s = document.createElement('style');
    s.id = 'ux07-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ════════════════════════════════════════════════════════════
     ESTADO
  ════════════════════════════════════════════════════════════ */

  let _bd      = null; // backdrop
  let _el      = null; // drawer element
  let _isOpen  = false;
  let _data    = null; // dados actuais
  const TZ     = 'Africa/Luanda';

  /* ════════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════════ */

  function _fmtHora(iso) {
    if (!iso) return '–';
    try {
      const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
      return d.toLocaleString('pt-PT', {
        timeZone: TZ,
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) { return iso; }
  }

  function _parseObs(obs) {
    if (!obs) return { formData: '', ficheiro: null };
    const partes   = String(obs).split(' | ').map(p => p.trim()).filter(Boolean);
    const ficheiro = partes.find(p => p.startsWith('FICHEIRO:'))
      ?.replace('FICHEIRO:', '').trim() || null;
    const formData = partes
      .filter(p => !p.startsWith('FICHEIRO:'))
      .join('\n');
    return { formData, ficheiro };
  }

  function _fichNomeDisplay(nome) {
    if (!nome) return '';
    const partes = nome.split('_');
    return partes.length > 2 ? partes.slice(2).join('_') : nome;
  }

  /* ════════════════════════════════════════════════════════════
     BUILD — cria estrutura uma única vez
  ════════════════════════════════════════════════════════════ */

  function _build() {
    if (_bd) return;

    _bd = document.createElement('div');
    _bd.className = 'ux07-backdrop';
    _bd.addEventListener('click', fechar);
    document.body.appendChild(_bd);

    _el = document.createElement('div');
    _el.className = 'ux07-drawer';
    _el.setAttribute('role', 'complementary');
    _el.setAttribute('aria-label', 'Detalhes da senha');
    document.body.appendChild(_el);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _isOpen) fechar();
    });
  }

  /* ════════════════════════════════════════════════════════════
     RENDER — popula o drawer com os dados
  ════════════════════════════════════════════════════════════ */

  function _render(d) {
    if (!_el || !d) return;

    /* Resolver campos com múltiplos formatos */
    const numero    = d.numero    || d.number  || d.code || '–';
    const servico   = d.servico?.nome || d.servico || d.service || d.servico_nome || '–';
    const tipo      = d.tipo      || d.type    || 'normal';
    const status    = d.status    || '';
    const atendente = d.atendente?.nome || d.atendente || d.atendente_nome || null;
    const balcao    = d.numero_balcao  || d.balcao   || d.counterNumber || null;
    const obs       = d.observacoes   || d.notes     || '';
    const emitidaEm = d.emitida_em    || d.createdAt || d.created_at || null;
    const espera    = d.tempo_espera_minutos != null ? d.tempo_espera_minutos : null;
    const duracao   = d.tempo_atendimento_minutos != null ? d.tempo_atendimento_minutos : null;
    const avNota    = d.avaliacao_nota   || d.rating?.score  || null;
    const avComent  = d.avaliacao_comentario || d.rating?.comment || null;
    const senhaId   = d.id || null;

    const isPrio = tipo === 'prioritaria';
    const { formData, ficheiro } = _parseObs(obs);

    /* ── Badge de status ────────────────────────────────── */
    const bdgTipo = isPrio
      ? '<span class="ux07-bdg ux07-bdg-prio">⭐ Prioritária</span>'
      : '<span class="ux07-bdg">Normal</span>';

    const bdgStatus = {
      concluida:  '<span class="ux07-bdg ux07-bdg-ok">✓ Concluída</span>',
      cancelada:  '<span class="ux07-bdg ux07-bdg-cancel">✕ Cancelada</span>',
      aguardando: '<span class="ux07-bdg">⏳ Aguardando</span>',
      atendendo:  '<span class="ux07-bdg ux07-bdg-ok">● Em Atendimento</span>',
    }[status] || '';

    /* ── Meta cells ─────────────────────────────────────── */
    function cell(label, value, full) {
      if (!value && value !== 0) return '';
      return `<div class="ux07-cell${full ? ' full' : ''}">
        <div class="ux07-cell-label">${label}</div>
        <div class="ux07-cell-value">${value}</div>
      </div>`;
    }

    const metaHTML = [
      cell('Atendente', atendente),
      cell('Balcão', balcao ? `Balcão ${balcao}` : null),
      cell('Emitida em', _fmtHora(emitidaEm)),
      cell('Espera', espera != null ? `${espera} min` : null),
      cell('Duração', duracao != null ? `${duracao} min` : null),
    ].filter(Boolean).join('');

    /* ── Ficheiro ───────────────────────────────────────── */
    const fichUrl     = senhaId ? `/api/senhas/${senhaId}/ficheiro` : null;
    const fichPreviewUrl = senhaId ? `/api/senhas/${senhaId}/ficheiro/preview` : null;
    const ficheiroHTML = ficheiro && fichUrl
      ? `<div class="ux07-attach">
           <div class="ux07-attach-name">📎 ${_fichNomeDisplay(ficheiro)}</div>
           <div class="ux07-attach-btns">
             <a href="${fichUrl}" download class="ux07-abtn ux07-abtn-dl">⬇ Download</a>
             <button class="ux07-abtn ux07-abtn-view"
               onclick="window.open('${fichPreviewUrl}','_blank','noopener,noreferrer')">
               👁 Visualizar
             </button>
           </div>
         </div>`
      : `<div class="ux07-empty-note">Sem documento anexado</div>`;

    /* ── Avaliação ──────────────────────────────────────── */
    const avalHTML = avNota
      ? `<div>
           <div class="ux07-sec-title">Avaliação</div>
           <div class="ux07-rating">
             <div class="ux07-stars">${'⭐'.repeat(Math.max(1, Math.min(5, avNota)))}</div>
             <div class="ux07-rating-info">
               ${avNota}/5 — ${['','Muito mau','Mau','Satisfatório','Bom','Excelente'][avNota]||''}
               ${avComent
                 ? `<div class="ux07-rating-comment">"${avComent}"</div>`
                 : ''}
             </div>
           </div>
         </div>`
      : '';

    _el.innerHTML = `
      <div class="ux07-hd">
        <div class="ux07-handle"></div>
        <div class="ux07-hd-row">
          <div>
            <div class="ux07-hd-meta">Detalhes do Pedido</div>
            <div class="ux07-hd-num">Senha ${numero}</div>
            <div class="ux07-hd-serv">${servico}</div>
          </div>
          <button class="ux07-x-btn" onclick="window.UX07.fechar()" aria-label="Fechar">✕</button>
        </div>
        <div class="ux07-hd-badges">
          ${bdgTipo}
          ${bdgStatus}
        </div>
      </div>

      <div class="ux07-body">

        ${metaHTML ? `
          <div>
            <div class="ux07-sec-title">Informações</div>
            <div class="ux07-grid">${metaHTML}</div>
          </div>` : ''}

        <div>
          <div class="ux07-sec-title">Dados do Formulário</div>
          <div class="ux07-form-block">${formData || 'Sem dados de formulário.'}</div>
        </div>

        <div>
          <div class="ux07-sec-title">Documento</div>
          ${ficheiroHTML}
        </div>

        ${avalHTML}

      </div>

      <div class="ux07-ft">
        <button class="ux07-ft-btn ux07-ft-btn-ghost" onclick="window.UX07.fechar()">
          ✕ Fechar
        </button>
        <button class="ux07-ft-btn ux07-ft-btn-primary" onclick="window.UX07.imprimir()">
          🖨 Imprimir
        </button>
      </div>
    `;
  }

  /* ════════════════════════════════════════════════════════════
     ABRIR
  ════════════════════════════════════════════════════════════ */

  function abrir(dados) {
    if (!dados) return;
    _build();
    _data = dados;
    _render(dados);

    /* Sequência de animação: render → backdrop → drawer */
    requestAnimationFrame(() => {
      _bd.classList.add('ux07-vis');
      requestAnimationFrame(() => _el.classList.add('ux07-open'));
    });

    _isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  /* ════════════════════════════════════════════════════════════
     FECHAR
  ════════════════════════════════════════════════════════════ */

  function fechar() {
    if (!_el || !_isOpen) return;
    _el.classList.remove('ux07-open');
    _bd.classList.remove('ux07-vis');
    _isOpen = false;
    document.body.style.overflow = '';
  }

  /* ════════════════════════════════════════════════════════════
     IMPRIMIR
  ════════════════════════════════════════════════════════════ */

  function imprimir() {
    if (!_data) return;
    const d          = _data;
    const { formData, ficheiro } = _parseObs(d.observacoes || d.notes || '');
    const nomeServico = d.servico?.nome || d.servico || '–';
    const nomeAtend   = d.atendente?.nome || d.atendente || '–';
    const senhaId     = d.id || null;
    const agora       = new Date().toLocaleString('pt-PT', { timeZone: TZ });

    const fichLink = ficheiro && senhaId
      ? `<div class="row"><div class="lbl">Documento</div>
         <div class="val"><a href="/api/senhas/${senhaId}/ficheiro" target="_blank">
           ${_fichNomeDisplay(ficheiro)}
         </a></div></div>`
      : '';

    const avNota = d.avaliacao_nota || d.rating?.score || null;
    const avHTML = avNota
      ? `<div class="row full"><div class="lbl">Avaliação</div>
         <div class="val">${'⭐'.repeat(avNota)} (${avNota}/5)
           ${d.avaliacao_comentario ? ` — "${d.avaliacao_comentario}"` : ''}</div></div>`
      : '';

    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
      <title>Senha ${d.numero || '–'} · IMTSB</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Segoe UI',sans-serif;padding:28px;color:#2a1a0a;max-width:580px;margin:0 auto}
        .hd{background:linear-gradient(135deg,#3e2510,#6b4226);color:#fff;padding:16px 20px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
        .hd h2{font-size:1.15rem;margin-bottom:3px}.hd p{opacity:.8;font-size:.76rem}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px}
        .row{background:#fdf8f5;border-radius:7px;padding:8px 10px}
        .row.full{grid-column:span 2}
        .lbl{font-size:.67rem;color:#8a7060;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
        .val{font-weight:700;font-size:.87rem;color:#3e2510;word-break:break-word}
        .dados{background:#fdf8f5;border:1px solid #e8d5c4;border-radius:7px;padding:10px 12px;
               white-space:pre-wrap;font-size:.84rem;line-height:1.75;margin-bottom:14px}
        .footer{margin-top:12px;text-align:center;color:#9c8070;font-size:.72rem;
                border-top:1px solid #f0e8dc;padding-top:10px}
        a{color:#2563eb}
        @media print{.hd{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
      <div class="hd">
        <div><h2>Senha ${d.numero || '–'} · IMTSB</h2><p>${nomeServico}</p></div>
        <div style="opacity:.7;font-size:.75rem;text-align:right">
          ${d.tipo === 'prioritaria' ? '⭐ Prioritária' : 'Normal'}
        </div>
      </div>
      <div class="grid">
        ${nomeAtend !== '–' ? `<div class="row"><div class="lbl">Atendente</div><div class="val">${nomeAtend}</div></div>` : ''}
        ${d.numero_balcao ? `<div class="row"><div class="lbl">Balcão</div><div class="val">Balcão ${d.numero_balcao}</div></div>` : ''}
        ${d.emitida_em    ? `<div class="row"><div class="lbl">Emitida em</div><div class="val" style="font-size:.8rem">${_fmtHora(d.emitida_em)}</div></div>` : ''}
        ${d.tempo_espera_minutos != null ? `<div class="row"><div class="lbl">Espera</div><div class="val">${d.tempo_espera_minutos} min</div></div>` : ''}
        ${d.tempo_atendimento_minutos != null ? `<div class="row"><div class="lbl">Duração</div><div class="val">${d.tempo_atendimento_minutos} min</div></div>` : ''}
        ${fichLink}
        ${avHTML}
      </div>
      <div class="dados">${formData || 'Sem dados de formulário.'}</div>
      <div class="footer">Impresso em ${agora} · Sistema de Filas · IMTSB</div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=660,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  }

  /* ════════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════════ */

  _injectCSS();

  window.UX07 = { abrir, fechar, imprimir };

  console.log('✅ UX07 — Drawer de Detalhes carregado');

})();
