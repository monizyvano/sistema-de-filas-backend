/**
 * static/js/dashusuario.js — Sprint 5
 * ═══════════════════════════════════════════════════════════════
 * CORRECÇÕES E MELHORIAS:
 *   ✅ Tracker mostra SERVIÇO escolhido pelo cliente
 *   ✅ Quando senha NEGADA → banner + notificação ao cliente c/ motivo
 *   ✅ Quando senha REDIRECCIONADA → notificação ao cliente
 *   ✅ Nome registado no perfil (ou "Visitante" para sem conta)
 *   ✅ Modal de avaliação por estrelas após conclusão
 *   ✅ Última chamada geral funcional via snapshot + fallback
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store     = window.IMTSBStore;
  const N         = window.IMTSBNotifications;
  const ANGOLA_TZ = 'Africa/Luanda';

  /* ── Estado ──────────────────────────────────────────────── */
  let servicoSelecionado     = null;
  let minhaSenha             = null;
  let pollingGeral           = null;
  let pollingAcompanhamento  = null;
  let statusAnterior         = null;
  let obsAnterior            = null;       // detectar mudança nas observações
  let _ultimaChamada         = null;
  let _iconTimer             = null;

  const STORAGE_KEY = 'imtsb_minha_senha';

  /* ── Utilitários ─────────────────────────────────────────── */
  function formatHora(v) {
    if (!v) return '--:--';
    const iso = (typeof v === 'string' && !v.endsWith('Z') && !v.includes('+'))
      ? v + 'Z' : v;
    return new Date(iso).toLocaleTimeString('pt-PT',
      { hour:'2-digit', minute:'2-digit', timeZone: ANGOLA_TZ });
  }

  function resolverNomeAt(a) {
    if (!a) return 'atendente';
    if (typeof a === 'string') return a;
    return a.nome || a.name || 'atendente';
  }

  const STATUS_MAP = {
    aguardando: 'A aguardar',
    chamando:   'A ser chamada',
    atendendo:  'Em atendimento',
    concluida:  'Concluída ✓',
    cancelada:  'Cancelada'
  };

  /* ── set() helper ────────────────────────────────────────── */
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  /* ── Mensagem de estado ──────────────────────────────────── */
  function mostrarMensagem(texto, tipo) {
    const el = document.getElementById('ticketMessage');
    if (!el) return;
    el.innerHTML = texto;
    el.className = 'ticket-message';
    if (tipo) el.classList.add(tipo);
    if (tipo === 'ok') setTimeout(() => { if (el.innerHTML === texto) el.textContent = ''; }, 9000);
  }

  /* ════════════════════════════════════════════════════════════
     TRACKER UI — minha senha, serviço, posição, notificações
  ════════════════════════════════════════════════════════════ */
  function actualizarTrackerUI(dados) {
    if (!dados) {
      document.getElementById('ticketTracker')?.style.setProperty('display','none');
      return;
    }

    const tracker = document.getElementById('ticketTracker');
    if (tracker) tracker.style.display = 'flex';

    const status    = dados.status;
    const numero    = dados.numero || minhaSenha?.numero || '---';
    const servico   = dados.servico || minhaSenha?.servico?.nome || servicoSelecionado?.nome || '—';
    const mudou     = statusAnterior !== null && statusAnterior !== status;
    const obsNova   = dados.observacoes || '';
    const obsMudou  = obsAnterior !== null && obsAnterior !== obsNova;
    statusAnterior  = status;
    obsAnterior     = obsNova;

    /* — Sempre actualiza o serviço no chip ──────────────── */
    set('trackerServico', servico);

    /* — Número e badge de estado ────────────────────────── */
    const numEl    = document.getElementById('currentTicket');
    const badgeEl  = document.getElementById('currentStatusBadge');
    const iconEl   = document.getElementById('currentStatusIcon');
    const statusEl = document.getElementById('currentStatus');

    if (numEl) numEl.textContent = numero;

    /* ── AGUARDANDO ──────────────────────────────────────── */
    if (status === 'aguardando') {
      const pos   = dados.posicao || '?';
      const tempo = dados.tempo_espera_estimado || 0;

      set('trackerPosicao', pos);
      set('trackerTempo',   tempo > 0 ? `~${Math.round(tempo)}min` : '—');
      set('trackerEstado',  pos === 1 ? '⏳ Próxima a ser chamada!' : `⏳ Posição ${pos} na fila`);

      document.getElementById('chipPosicao')?.classList.remove('chip-green','chip-red');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-waiting';
      if (iconEl)  iconEl.textContent = '⏳';
      if (statusEl) statusEl.textContent = STATUS_MAP.aguardando;

    /* ── CHAMANDO / ATENDENDO ────────────────────────────── */
    } else if (status === 'atendendo' || status === 'chamando') {
      const balcao   = dados.balcao || '–';
      const atendente = resolverNomeAt(dados.atendente);

      set('trackerPosicao', '🔔');
      set('trackerTempo',   'Agora');
      set('trackerEstado',  `→ Balcão ${balcao} · ${atendente}`);

      document.getElementById('chipPosicao')?.classList.add('chip-green');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-calling';
      if (iconEl)  iconEl.textContent = '🔔';
      if (statusEl) statusEl.textContent = '🔔 A ser chamada!';

      if (mudou) {
        /* Banner de chamada proeminente */
        N && N.clientCalled(numero, balcao, atendente);
        mostrarMensagem(
          `🔔 Senha <strong>${numero}</strong>: dirija-se ao Balcão <strong>${balcao}</strong> com ${atendente}`,
          'ok'
        );
        /* Notificação nativa (browser minimizado no telemóvel) */
        N && N.nativeNotify('IMTSB — A sua vez!',
          `Senha ${numero} — Balcão ${balcao}. Dirija-se ao atendente.`);
      }

    /* ── CONCLUÍDA ───────────────────────────────────────── */
    } else if (status === 'concluida') {
      set('trackerPosicao', '✓');
      set('trackerTempo',   'Concluído');
      set('trackerEstado',  'Atendimento concluído com sucesso!');

      document.getElementById('chipPosicao')?.classList.add('chip-green');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-done';
      if (iconEl)  iconEl.textContent = '✓';
      if (statusEl) statusEl.textContent = '✓ Concluída';
      if (numEl)   numEl.classList.add('pulse-green');

      if (mudou) {
        mostrarMensagem('✅ Atendimento concluído! Obrigado pela visita ao IMTSB.', 'ok');
        N && N.notify('conclude', 'Atendimento concluído! Obrigado pela sua visita.', 7000);
        N && N.nativeNotify('IMTSB — Concluído!', `Senha ${numero} atendida com sucesso.`);
        /* Abrir modal de avaliação */
        setTimeout(() => abrirModalAvaliacao(dados), 2000);
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 12000);

    /* ── CANCELADA (inclui NEGADA e REDIRECIONADA) ─────── */
    } else if (status === 'cancelada') {
      const obs = (dados.observacoes || minhaSenha?.observacoes || '').toString();

      document.getElementById('chipPosicao')?.classList.add('chip-red');
      if (badgeEl) badgeEl.className = 'ticket-status-badge status-cancelled';
      if (iconEl)  iconEl.textContent = '✕';
      if (statusEl) statusEl.textContent = 'Cancelada';

      if (mudou || obsMudou) {
        if (obs.startsWith('NEGADO:')) {
          /* Senha foi negada pelo trabalhador */
          const motivo = obs.replace('NEGADO:', '').trim();
          set('trackerPosicao', '🚫');
          set('trackerTempo',   'Negada');
          set('trackerEstado',  `Negada: ${motivo}`);

          mostrarMensagem(
            `🚫 A sua senha <strong>${numero}</strong> foi negada.<br>Motivo: <em>${motivo}</em>`,
            'warn'
          );
          N && N.notify('deny',
            `Senha ${numero} negada. Motivo: ${motivo}`, 8000);
          N && N.nativeNotify('IMTSB — Senha Negada',
            `Senha ${numero}: ${motivo}. Dirija-se à recepção para mais informações.`);

        } else if (obs.includes('REDIR:')) {
          /* Senha foi redireccionada */
          const partes  = obs.split('|').map(p => p.trim());
          const redirPart = partes.find(p => p.startsWith('REDIR:')) || '';
          const motivoPart = partes.find(p => p.startsWith('Motivo:')) || '';
          const destino = redirPart.replace('REDIR:', '').split('→')[1]?.trim() || 'outro serviço';
          const motivo  = motivoPart.replace('Motivo:', '').trim();

          set('trackerPosicao', '↪');
          set('trackerTempo',   'Redireccionada');
          set('trackerEstado',  `→ ${destino}`);

          mostrarMensagem(
            `↪ Senha <strong>${numero}</strong> redireccionada para <strong>${destino}</strong>.` +
            (motivo ? `<br><em>${motivo}</em>` : ''), 'ok'
          );
          N && N.notify('redirect',
            `Senha ${numero} redireccionada para ${destino}.${motivo ? ' ' + motivo : ''}`, 7000);
          N && N.nativeNotify('IMTSB — Redireccionado',
            `Senha ${numero} → ${destino}. Aguarde ser chamado no novo serviço.`);

          /* Senha redireccionada volta a aguardar — não limpar */
          return;

        } else {
          /* Cancelamento genérico */
          set('trackerPosicao', '✕');
          set('trackerTempo',   'Cancelada');
          set('trackerEstado',  'Senha cancelada. Emita nova senha se necessário.');
          mostrarMensagem('Senha cancelada. Pode emitir uma nova senha.', 'warn');
          N && N.notify('warn', `Senha ${numero} cancelada.`, 5000);
        }
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 8000);
    }
  }

  /* ── Display principal (sem dados do servidor) ───────────── */
  function atualizarDisplaySenha() {
    const numEl = document.getElementById('currentTicket');
    const tracker = document.getElementById('ticketTracker');

    if (!minhaSenha) {
      if (numEl)   numEl.textContent = '---';
      if (tracker) tracker.style.display = 'none';
      set('currentStatus', 'Nenhuma senha activa');
      set('trackerEstado', 'Seleccione um serviço e emita a sua senha.');
      statusAnterior = null;
      obsAnterior    = null;
      return;
    }
    if (numEl) numEl.textContent = minhaSenha.numero;
    set('currentStatus', STATUS_MAP[minhaSenha.status] || minhaSenha.status);
    if (tracker) tracker.style.display = 'flex';
    /* Serviço */
    const srv = minhaSenha.servico?.nome || servicoSelecionado?.nome || '—';
    set('trackerServico', srv);
  }

  /* ════════════════════════════════════════════════════════════
     MODAL DE AVALIAÇÃO POR ESTRELAS
  ════════════════════════════════════════════════════════════ */
  function abrirModalAvaliacao(dados) {
    /* Não repetir se já avaliado */
    if (localStorage.getItem(`imtsb_avaliado_${dados?.id || ''}`)) return;

    const modalId = 'modalAvaliacao';
    if (document.getElementById(modalId)) return;

    const atendente = resolverNomeAt(dados?.atendente);
    const servico   = dados?.servico || minhaSenha?.servico?.nome || 'Atendimento';
    const senhaId   = dados?.id      || minhaSenha?.id;

    const modal = document.createElement('div');
    modal.id    = modalId;
    modal.style.cssText = `
      position:fixed;inset:0;z-index:99990;
      background:rgba(0,0,0,.55);backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;padding:1rem;
    `;
    modal.innerHTML = `
      <div style="
        background:white;border-radius:22px;max-width:380px;width:100%;
        padding:2rem;box-shadow:0 24px 64px rgba(0,0,0,.35);
        text-align:center;animation:evalIn .35s cubic-bezier(.16,1,.3,1);
      ">
        <style>
          @keyframes evalIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:none}}
          .star-btn{background:none;border:none;font-size:2.2rem;cursor:pointer;
                    padding:.15rem .2rem;transition:transform .15s;line-height:1;-webkit-tap-highlight-color:transparent;}
          .star-btn:hover,.star-btn.active{transform:scale(1.2);}
          .star-btn.active .s-empty{display:none;}
          .star-btn:not(.active) .s-filled{display:none;}
          .btn-aval-confirm{
            width:100%;padding:.85rem;margin-top:1rem;
            background:linear-gradient(135deg,#3e2510,#6b4226);color:white;
            border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;
          }
          .btn-aval-skip{
            display:block;margin:0.6rem auto 0;background:none;border:none;
            font-size:.82rem;color:#8c6746;cursor:pointer;text-decoration:underline;
          }
        </style>
        <div style="font-size:2.5rem;margin-bottom:.5rem;">⭐</div>
        <h3 style="font-family:'Poppins',sans-serif;font-size:1.2rem;font-weight:800;
                   color:#3e2510;margin-bottom:.35rem;">Como foi o seu atendimento?</h3>
        <p style="font-size:.85rem;color:#8c6746;margin-bottom:1.25rem;">
          Atendente: <strong>${atendente}</strong> · ${servico}
        </p>
        <div id="starsRow" style="display:flex;justify-content:center;gap:.2rem;margin-bottom:.5rem;">
          ${[1,2,3,4,5].map(n => `
            <button class="star-btn" data-val="${n}" onclick="setStar(${n})">
              <span class="s-filled">⭐</span>
              <span class="s-empty">☆</span>
            </button>`).join('')}
        </div>
        <div id="starLabel" style="font-size:.82rem;color:#8c6746;min-height:1.2rem;margin-bottom:.75rem;"></div>
        <textarea id="evalComment" maxlength="200" placeholder="Comentário opcional (máx. 200 caracteres)..."
          style="width:100%;padding:.75rem;border:1.5px solid rgba(196,168,130,.5);
                 border-radius:12px;font-family:inherit;font-size:.9rem;resize:vertical;
                 min-height:70px;outline:none;"></textarea>
        <button class="btn-aval-confirm" id="btnEnviarAvaliacao" onclick="enviarAvaliacao(${senhaId})" disabled>
          Enviar avaliação
        </button>
        <button class="btn-aval-skip" onclick="fecharAvaliacao()">Saltar</button>
      </div>
    `;
    document.body.appendChild(modal);

    /* Fechar ao clicar fora */
    modal.addEventListener('click', e => { if (e.target === modal) fecharAvaliacao(); });
  }

  window._avaliacaoNota = 0;

  window.setStar = function(val) {
    window._avaliacaoNota = val;
    const labels = ['','Muito mau','Mau','Satisfatório','Bom','Excelente! ⭐'];
    document.getElementById('starLabel').textContent = labels[val] || '';
    document.querySelectorAll('.star-btn').forEach(btn => {
      const n = parseInt(btn.dataset.val);
      btn.classList.toggle('active', n <= val);
    });
    const btn = document.getElementById('btnEnviarAvaliacao');
    if (btn) btn.disabled = false;
  };

  window.enviarAvaliacao = async function(senhaId) {
    const nota     = window._avaliacaoNota;
    const comment  = (document.getElementById('evalComment')?.value || '').trim();
    const btn      = document.getElementById('btnEnviarAvaliacao');

    if (!nota) return;
    if (btn) { btn.disabled = true; btn.textContent = 'A enviar...'; }

    try {
      const baseUrl = window.IMTSBApiConfig?.baseUrl || '/api';
      const resp = await fetch(`${baseUrl.replace('/api','')}/api/tickets/rate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ticket_id: senhaId, score: nota, comment })
      });

      if (resp.ok) {
        if (senhaId) localStorage.setItem(`imtsb_avaliado_${senhaId}`, '1');
        N && N.notify('success', 'Obrigado pela avaliação! O seu feedback é valioso.', 4000);
      }
    } catch (e) {
      console.warn('[avaliação]', e);
    } finally {
      fecharAvaliacao();
    }
  };

  window.fecharAvaliacao = function() {
    document.getElementById('modalAvaliacao')?.remove();
    window._avaliacaoNota = 0;
  };

  /* ════════════════════════════════════════════════════════════
     ACOMPANHAMENTO — polling da posição da senha
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
      const base = window.IMTSBApiConfig?.baseUrl || '/api';
      const resp = await fetch(`${base}/dashboard/public/senha/${encodeURIComponent(num)}`);
      if (resp.status === 404) {
        limparSenhaLocal();
        pararAcompanhamento();
        atualizarDisplaySenha();
        return;
      }
      if (!resp.ok) return;
      const dados = await resp.json();

      /* Injectar serviço e observações no objecto */
      if (minhaSenha) {
        dados.servico      = dados.servico      || minhaSenha.servico?.nome || servicoSelecionado?.nome;
        dados.observacoes  = dados.observacoes  || minhaSenha.observacoes || '';
        minhaSenha.status  = dados.status;
        minhaSenha.observacoes = dados.observacoes;
        guardarSenhaLocal(minhaSenha);
      }

      actualizarTrackerUI(dados);
    } catch (err) {
      console.error('[posicao]', err);
    }
  }

  /* ════════════════════════════════════════════════════════════
     ÚLTIMA CHAMADA GERAL — snapshot + fallbacks
  ════════════════════════════════════════════════════════════ */
  async function atualizarUltimaChamada() {
    const numEl     = document.getElementById('ultimaChamada');
    const balcaoEl  = document.getElementById('ultimoBalcao');
    const servicoEl = document.getElementById('ultimoServico');
    const horaEl    = document.getElementById('ultimaHora');
    const iconEl    = document.getElementById('lastCallIcon');
    if (!numEl) return;

    const base = window.IMTSBApiConfig?.baseUrl || '/api';
    let numero = null, balcao = null, servico = null, hora = null;

    /* Tentativa 1: snapshot */
    try {
      const r = await fetch(`${base}/realtime/snapshot`);
      if (r.ok) {
        const snap = await r.json();
        const lc   = snap.lastCalled;
        if (lc?.code) {
          numero  = lc.code;
          balcao  = lc.counterName || 'Balcão';
          servico = lc.service     || '—';
          hora    = lc.at ? formatHora(lc.at) : null;
        }
      }
    } catch (_) {}

    /* Tentativa 2: tv endpoint */
    if (!numero) {
      try {
        const r2 = await fetch(`${base}/dashboard/public/tv`);
        if (r2.ok) {
          const tv = await r2.json();
          if (tv.em_atendimento?.length > 0) {
            const s = tv.em_atendimento[0];
            numero  = s.numero;
            balcao  = `Balcão ${s.balcao}`;
            servico = s.servico || '—';
          }
        }
      } catch (_) {}
    }

    if (!numero) return;

    const mudou = numero !== _ultimaChamada;
    _ultimaChamada = numero;

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
      }, 6000);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     ESTATÍSTICAS GERAIS
  ════════════════════════════════════════════════════════════ */
  async function atualizarEstatisticas() {
    try {
      const base = window.IMTSBApiConfig?.baseUrl || '/api';
      const r    = await fetch(`${base}/senhas/estatisticas`);
      if (!r.ok) return;
      const s = await r.json();
      set('statFila',  s.aguardando || 0);
      set('statTempo', `${Math.round(s.tempo_medio_espera || 0)}min`);
      set('statDone',  s.concluidas || 0);
      const t = s.total_emitidas || 0, c = s.concluidas || 0;
      set('statSat', t > 0 ? `${Math.round((c/t)*100)}%` : '—');
    } catch (_) {}
  }

  /* ═══════════════════════════════════════════════════════════
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
      const base = window.IMTSBApiConfig?.baseUrl || '/api';
      const r    = await fetch(`${base}/servicos`);
      if (!r.ok) throw new Error();
      const raw      = await r.json();
      const servicos = Array.isArray(raw) ? raw : (raw.servicos || raw);
      if (!servicos.length) { container.innerHTML = '<p>Sem serviços.</p>'; return; }
      container.innerHTML = '';
      servicos.forEach(s => {
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
    /* Actualiza já o chip de serviço */
    set('trackerServico', s.nome);
    mostrarMensagem(`${s.nome} seleccionado. Clique em "Emitir Senha".`, 'ok');
  }

  /* ═══════════════════════════════════════════════════════════
     EMITIR SENHA
  ════════════════════════════════════════════════════════════ */
  async function emitirSenha() {
    if (!servicoSelecionado) {
      mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
      return;
    }
    const btn = document.getElementById('btnEmitirSenha');
    if (btn) { btn.disabled = true; btn.textContent = 'A emitir...'; }
    mostrarMensagem('⏳ A emitir senha…', '');

    try {
      const base = window.IMTSBApiConfig?.baseUrl || '/api';
      const r    = await fetch(`${base}/senhas/emitir`, {
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
      iniciarAcompanhamento(minhaSenha.numero);
      set('trackerServico', servicoSelecionado.nome);
      mostrarMensagem(`✅ Senha emitida: <strong>${minhaSenha.numero}</strong> · ${servicoSelecionado.nome}`, 'ok');
      await atualizarEstatisticas();
      N && N.notify('success',
        `Senha <strong>${minhaSenha.numero}</strong> emitida. Aguarde ser chamado(a).`, 6000);

    } catch (_) {
      mostrarMensagem('❌ Erro de ligação ao servidor', 'warn');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Emitir Senha'; }
    }
  }

  /* ═══════════════════════════════════════════════════════════
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

  /* ═══════════════════════════════════════════════════════════
     POLLING GERAL
  ════════════════════════════════════════════════════════════ */
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

  /* ═══════════════════════════════════════════════════════════
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
      pararPollingGeral(); pararAcompanhamento(); limparSenhaLocal();
      store?.logout?.();
    });

    const painel   = document.getElementById('meusDadosPanel');
    const btnD     = document.getElementById('btnMeusDados');
    const btnF     = document.getElementById('btnFecharDados');
    if (btnD && painel) btnD.addEventListener('click',  () => painel.classList.add('aberto'));
    if (btnF && painel) btnF.addEventListener('click',  () => painel.classList.remove('aberto'));

    /* Flash da página de formulário */
    const flash = localStorage.getItem('imtsb_flash');
    if (flash) { mostrarMensagem(flash, 'ok'); localStorage.removeItem('imtsb_flash'); }
  }

  /* ═══════════════════════════════════════════════════════════
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