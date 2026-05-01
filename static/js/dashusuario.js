/**
 * static/js/dashusuario.js — Sprint 4 COMPLETO
 * ═══════════════════════════════════════════════════════════════
 * ADIÇÕES SPRINT 4:
 *   ✅ "Última Chamada Geral" usa /api/realtime/snapshot (dados reais)
 *   ✅ Fallback para /api/senhas?status=atendendo se snapshot falhar
 *   ✅ Polling da última chamada independente do polling de stats
 *   ✅ Animação visual quando a última chamada muda
 *   ✅ Notificação ao utente quando a sua senha é chamada
 *   ✅ Banner de chamada com som e vibração (usa notifications.js se disponível)
 *   ✅ Tracker de posição na fila mais robusto
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store     = window.IMTSBStore;
  const N         = window.IMTSBNotifications;  // opcional
  const ANGOLA_TZ = 'Africa/Luanda';

  /* ── Estado ──────────────────────────────────────────────── */
  let servicoSelecionado      = null;
  let minhaSenha              = null;
  let pollingGeral            = null;
  let pollingAcompanhamento   = null;
  let statusAnterior          = null;
  let _ultimaChamadaAnterior  = null;  // detectar mudança na última chamada

  const STORAGE_KEY = 'imtsb_minha_senha';

  /* ── Utilitários ─────────────────────────────────────────── */
  function formatHora(value) {
    if (!value) return '--:--';
    const iso = (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+'))
      ? value + 'Z' : value;
    return new Date(iso).toLocaleTimeString('pt-PT', {
      hour: '2-digit', minute: '2-digit', timeZone: ANGOLA_TZ
    });
  }

  function resolverNomeAtendente(atendente) {
    if (!atendente) return 'atendente';
    if (typeof atendente === 'string') return atendente;
    return atendente.nome || atendente.name || 'atendente';
  }

  function traduzirStatus(status) {
    const mapa = {
      'aguardando': 'A aguardar',
      'chamando':   'A ser chamada',
      'atendendo':  'Em atendimento',
      'concluida':  'Concluída ✓',
      'cancelada':  'Cancelada'
    };
    return mapa[status] || status;
  }

  function mostrarMensagem(texto, tipo) {
    const el = document.getElementById('ticketMessage');
    if (!el) return;
    el.textContent = texto;
    el.className   = 'ticket-message';
    if (tipo) el.classList.add(tipo);
    if (tipo === 'ok') setTimeout(() => { if (el.textContent === texto) el.textContent = ''; }, 8000);
  }

  /* ── Banner de Chamada ───────────────────────────────────── */
  function mostrarBannerChamada(numero, balcao, atendente, servico) {
    const existing = document.getElementById('callBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id    = 'callBanner';
    banner.innerHTML = `
      <div class="call-banner-inner">
        <div class="call-banner-icon">🔔</div>
        <div class="call-banner-text">
          <div class="call-banner-senha">Senha <strong>${numero}</strong></div>
          <div class="call-banner-instrucao">Dirija-se ao <strong>Balcão ${balcao}</strong></div>
          <div class="call-banner-atendente">Atendente: ${atendente} · ${servico || ''}</div>
        </div>
        <button class="call-banner-close" onclick="document.getElementById('callBanner')?.remove()">✕</button>
      </div>
    `;

    if (!document.getElementById('callBannerStyle')) {
      const style = document.createElement('style');
      style.id = 'callBannerStyle';
      style.textContent = `
        #callBanner{position:fixed;top:0;left:0;right:0;z-index:10000;
          background:linear-gradient(135deg,#3e2510,#6b4226);color:white;
          box-shadow:0 8px 32px rgba(0,0,0,.35);
          animation:slideDownBanner .4s cubic-bezier(.16,1,.3,1);}
        @keyframes slideDownBanner{from{transform:translateY(-100%)}to{transform:translateY(0)}}
        .call-banner-inner{max-width:700px;margin:0 auto;display:flex;
          align-items:center;gap:1rem;padding:1.25rem 1.5rem;}
        .call-banner-icon{font-size:2.2rem;animation:ringAnim .5s ease-in-out infinite alternate;}
        @keyframes ringAnim{from{transform:rotate(-15deg)}to{transform:rotate(15deg)}}
        .call-banner-text{flex:1;}
        .call-banner-senha{font-size:.85rem;opacity:.85;margin-bottom:.15rem;}
        .call-banner-instrucao{font-size:1.5rem;font-weight:800;line-height:1.1;}
        .call-banner-atendente{font-size:.85rem;opacity:.8;margin-top:.25rem;}
        .call-banner-close{background:rgba(255,255,255,.15);border:none;color:white;
          width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1rem;
          display:flex;align-items:center;justify-content:center;}
        .call-banner-close:hover{background:rgba(255,255,255,.3);}
        @media(max-width:600px){.call-banner-instrucao{font-size:1.2rem;}}
      `;
      document.head.appendChild(style);
    }

    document.body.prepend(banner);
    setTimeout(() => banner.remove(), 30000);

    /* Som + vibração se disponível */
    N && N.play('call');
    N && N.vibrate('call');
  }

  /* ── Tracker ─────────────────────────────────────────────── */
  function actualizarTrackerUI(dados) {
    const posEl    = document.getElementById('trackerPosicao');
    const tempoEl  = document.getElementById('trackerTempo');
    const estadoEl = document.getElementById('trackerEstado');
    const tracker  = document.getElementById('ticketTracker');
    if (!dados) { if (tracker) tracker.style.display = 'none'; return; }
    if (tracker) tracker.style.display = 'block';

    const status = dados.status;
    const mudou  = statusAnterior !== null && statusAnterior !== status;
    statusAnterior = status;

    if (status === 'aguardando') {
      const pos   = dados.posicao || '?';
      const tempo = dados.tempo_espera_estimado;
      if (posEl)    { posEl.textContent = pos; posEl.style.color = '#6b4226'; posEl.style.fontSize = ''; }
      if (tempoEl)  tempoEl.textContent = tempo > 0 ? `~${Math.round(tempo)}min` : '–';
      if (estadoEl) estadoEl.textContent = pos === 1 ? '⏳ Próxima a ser chamada!' : '⏳ A aguardar...';

      const numEl    = document.getElementById('currentTicket');
      const statusEl = document.getElementById('currentStatus');
      if (numEl)    numEl.textContent    = dados.numero || '---';
      if (statusEl) { statusEl.textContent = traduzirStatus(status); statusEl.style.color = '#6b4226'; }

    } else if (status === 'atendendo' || status === 'chamando') {
      const balcao    = dados.balcao || '–';
      const atendente = resolverNomeAtendente(dados.atendente);
      const servico   = dados.servico || '';

      if (posEl)    { posEl.textContent = '🔔'; posEl.style.color = '#10b981'; posEl.style.fontSize = '1.8rem'; }
      if (tempoEl)  tempoEl.textContent = 'A ser atendido';
      if (estadoEl) { estadoEl.textContent = `→ Balcão ${balcao} · ${atendente}`; estadoEl.style.color = '#10b981'; estadoEl.style.fontWeight = '700'; }

      const numEl    = document.getElementById('currentTicket');
      const statusEl = document.getElementById('currentStatus');
      if (numEl)    numEl.textContent    = dados.numero || '---';
      if (statusEl) { statusEl.textContent = '🔔 A ser chamada!'; statusEl.style.color = '#10b981'; }

      if (mudou) {
        mostrarBannerChamada(dados.numero, balcao, atendente, servico);
        mostrarMensagem(`🔔 Senha ${dados.numero}: dirija-se ao Balcão ${balcao} com ${atendente}`, 'ok');
      }

    } else if (status === 'concluida') {
      if (posEl)    { posEl.textContent = '✓'; posEl.style.color = '#22c55e'; posEl.style.fontSize = '2rem'; }
      if (tempoEl)  tempoEl.textContent = 'Concluído';
      if (estadoEl) estadoEl.textContent = 'Atendimento concluído com sucesso';

      const numEl    = document.getElementById('currentTicket');
      const statusEl = document.getElementById('currentStatus');
      if (numEl)    numEl.style.color = '#22c55e';
      if (statusEl) { statusEl.textContent = '✓ Concluída'; statusEl.style.color = '#22c55e'; }

      if (mudou) {
        mostrarMensagem('✅ Atendimento concluído! Obrigado pela sua visita ao IMTSB.', 'ok');
        N && N.notify('conclude', 'Atendimento concluído! Obrigado pela visita.', 6000);
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 8000);

    } else if (status === 'cancelada') {
      if (posEl)    { posEl.textContent = '✕'; posEl.style.color = '#ef4444'; posEl.style.fontSize = '1.8rem'; }
      if (tempoEl)  tempoEl.textContent = 'Cancelada';
      if (estadoEl) estadoEl.textContent = 'Senha cancelada';

      const statusEl = document.getElementById('currentStatus');
      if (statusEl) { statusEl.textContent = 'Cancelada'; statusEl.style.color = '#ef4444'; }

      if (mudou) {
        mostrarMensagem('Senha cancelada. Pode emitir uma nova senha.', 'warn');
        N && N.notify('warn', 'A sua senha foi cancelada. Emita uma nova se necessário.');
      }

      pararAcompanhamento();
      setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 5000);
    }
  }

  function atualizarDisplaySenha() {
    const numEl    = document.getElementById('currentTicket');
    const statusEl = document.getElementById('currentStatus');
    const tracker  = document.getElementById('ticketTracker');

    if (!minhaSenha) {
      if (numEl)    numEl.textContent    = '---';
      if (statusEl) statusEl.textContent = 'Nenhuma senha activa';
      if (tracker)  tracker.style.display = 'none';
      statusAnterior = null;
      return;
    }
    if (numEl)    numEl.textContent    = minhaSenha.numero;
    if (statusEl) statusEl.textContent = traduzirStatus(minhaSenha.status);
    if (tracker)  tracker.style.display = 'block';
  }

  /* ── Acompanhamento de posição ───────────────────────────── */
  function iniciarAcompanhamento(numeroSenha) {
    pararAcompanhamento();
    actualizarPosicao(numeroSenha);
    pollingAcompanhamento = setInterval(() => actualizarPosicao(numeroSenha), 5000);
  }

  function pararAcompanhamento() {
    if (pollingAcompanhamento) { clearInterval(pollingAcompanhamento); pollingAcompanhamento = null; }
  }

  async function actualizarPosicao(numeroSenha) {
    try {
      const resp = await fetch(`/api/dashboard/public/senha/${encodeURIComponent(numeroSenha)}`);
      if (resp.status === 404) {
        console.info(`[acompanhamento] Senha ${numeroSenha} não encontrada hoje → limpar`);
        limparSenhaLocal();
        pararAcompanhamento();
        atualizarDisplaySenha();
        return;
      }
      if (!resp.ok) return;
      const dados = await resp.json();
      actualizarTrackerUI(dados);
      if (minhaSenha) { minhaSenha.status = dados.status; guardarSenhaLocal(minhaSenha); }
    } catch (err) {
      console.error('[actualizarPosicao]', err);
    }
  }

  /* ── Estatísticas gerais ─────────────────────────────────── */
  async function atualizarEstatisticas() {
    try {
      const resp = await fetch('/api/senhas/estatisticas');
      if (!resp.ok) return;
      const stats = await resp.json();
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('statFila',  stats.aguardando || 0);
      set('statTempo', `${Math.round(stats.tempo_medio_espera || 0)}m`);
      set('statDone',  stats.concluidas || 0);
      const total   = stats.total_emitidas || 0;
      const conclui = stats.concluidas     || 0;
      set('statSat', total > 0 ? `${Math.round((conclui / total) * 100)}%` : '—');
    } catch (err) {
      console.error('❌ Estatísticas:', err);
    }
  }

  /* ════════════════════════════════════════════════════════════
     ÚLTIMA CHAMADA GERAL — usa snapshot para dados reais
     Prioridades de fallback:
       1. /api/realtime/snapshot → lastCalled
       2. /api/senhas?status=atendendo (último atendimento activo)
       3. Mantém valor anterior
  ════════════════════════════════════════════════════════════ */
  async function atualizarUltimaChamada() {
    const numEl    = document.getElementById('ultimaChamada');
    const balcaoEl = document.getElementById('ultimoBalcao');
    if (!numEl && !balcaoEl) return;

    let numero    = null;
    let balcaoTxt = null;

    /* — Tentativa 1: snapshot (mais fiável) ─────────────────── */
    try {
      const resp = await fetch('/api/realtime/snapshot');
      if (resp.ok) {
        const snap = await resp.json();

        /* lastCalled do snapshot */
        if (snap.lastCalled && snap.lastCalled.code) {
          numero    = snap.lastCalled.code;
          balcaoTxt = snap.lastCalled.counterName || 'Balcão';
          if (snap.lastCalled.service) balcaoTxt += ` · ${snap.lastCalled.service}`;
        }
        /* Fallback: primeiro item da queue em atendimento */
        else if (snap.queue && snap.queue.length > 0) {
          const emAtend = snap.queue.find(
            t => t.status === 'em_atendimento' || t.status === 'atendendo' || t.status === 'chamando'
          );
          if (emAtend) {
            numero    = emAtend.code;
            balcaoTxt = emAtend.counterName || 'Balcão';
          }
        }
      }
    } catch (_) { /* silencioso */ }

    /* — Tentativa 2: endpoint legado ────────────────────────── */
    if (!numero) {
      try {
        const resp2 = await fetch('/api/senhas?status=atendendo&per_page=1&page=1');
        if (resp2.ok) {
          const dados  = await resp2.json();
          const senhas = dados.senhas || (Array.isArray(dados) ? dados : []);
          if (senhas.length > 0) {
            const s       = senhas[0];
            const nomeAt  = resolverNomeAtendente(s.atendente);
            numero    = s.numero;
            balcaoTxt = s.numero_balcao ? `Balcão ${s.numero_balcao} · ${nomeAt}` : nomeAt;
          }
        }
      } catch (_) { /* silencioso */ }
    }

    /* — Tentativa 3: último chamado (público/tv) ─────────────── */
    if (!numero) {
      try {
        const resp3 = await fetch('/api/dashboard/public/tv');
        if (resp3.ok) {
          const tv = await resp3.json();
          if (tv.em_atendimento && tv.em_atendimento.length > 0) {
            const s   = tv.em_atendimento[0];
            numero    = s.numero;
            balcaoTxt = `Balcão ${s.balcao} · ${s.servico || ''}`;
          }
        }
      } catch (_) { /* silencioso */ }
    }

    /* — Renderizar ───────────────────────────────────────────── */
    if (numero) {
      /* Animação de mudança se o número alterou */
      const mudou = numero !== _ultimaChamadaAnterior;
      _ultimaChamadaAnterior = numero;

      if (numEl) {
        numEl.textContent = numero;
        if (mudou) {
          numEl.style.transition = 'none';
          numEl.style.transform  = 'scale(1.18)';
          numEl.style.color      = '#22c55e';
          setTimeout(() => {
            numEl.style.transition = 'all .4s ease';
            numEl.style.transform  = 'scale(1)';
            numEl.style.color      = 'var(--primary-brown)';
          }, 500);
        }
      }
      if (balcaoEl) balcaoEl.textContent = balcaoTxt || '—';

    } else {
      /* Sem chamadas activas */
      if (numEl && !_ultimaChamadaAnterior) {
        numEl.textContent    = '—';
        if (balcaoEl) balcaoEl.textContent = 'Nenhum em atendimento';
      }
    }
  }

  /* ── Serviços ────────────────────────────────────────────── */
  async function carregarServicos() {
    const container = document.getElementById('servicesList');
    if (!container) return;

    try {
      const resp     = await fetch('/api/servicos');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw      = await resp.json();
      const servicos = Array.isArray(raw) ? raw : (raw.servicos || raw);

      if (!servicos.length) {
        container.innerHTML = '<p style="color:var(--text-muted);">Sem serviços disponíveis.</p>';
        return;
      }

      container.innerHTML = '';
      servicos.forEach(servico => {
        const temForm  = !!MAPA_FORMULARIOS[servico.id];
        const subtexto = temForm ? '📝 Preencher formulário' : (servico.descricao || 'Emissão directa');

        const card             = document.createElement('article');
        card.className         = 'service-card';
        card.dataset.servicoId = servico.id;
        card.style.cursor      = 'pointer';
        card.innerHTML = `
          <div class="service-icon">${servico.icone || '📄'}</div>
          <div class="service-info">
            <div class="service-name">${servico.nome}</div>
            <div class="service-status"><span class="status-dot"></span>${subtexto}</div>
          </div>
          <span class="arrow-icon">→</span>
        `;
        card.addEventListener('click', () => selecionarServico(servico, card));
        container.appendChild(card);
      });
    } catch (err) {
      console.error('❌ Serviços:', err);
      container.innerHTML = '<p style="color:var(--text-muted);">Erro ao carregar serviços.</p>';
    }
  }

  /* ── Mapa serviço → URL do formulário ────────────────────── */
  const MAPA_FORMULARIOS = {
    1: '/matricula.html',
    2: '/tesouraria.html',
    3: '/declaracao.html',
    4: null,                     // Biblioteca — emite directo
    5: '/apoio-cliente.html'
  };

  function selecionarServico(servico, cardEl) {
    const urlForm = MAPA_FORMULARIOS[servico.id];
    if (urlForm) { window.location.href = urlForm; return; }

    servicoSelecionado = servico;
    document.querySelectorAll('.service-card').forEach(c => c.classList.remove('ativo'));
    if (cardEl) cardEl.classList.add('ativo');
    mostrarMensagem(`${servico.nome} seleccionado. Clique em "Emitir Senha".`, 'ok');
  }

  /* ── Emitir senha ────────────────────────────────────────── */
  async function emitirSenha() {
    if (!servicoSelecionado) {
      mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
      return;
    }

    const btn = document.getElementById('btnEmitirSenha');
    if (btn) { btn.disabled = true; btn.textContent = 'A emitir...'; }
    mostrarMensagem('⏳ A emitir senha...', '');

    try {
      const resp = await fetch('/api/senhas/emitir', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ servico_id: servicoSelecionado.id, tipo: 'normal' })
      });
      const dados = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        mostrarMensagem(`❌ ${dados.erro || 'Erro ao emitir senha'}`, 'warn');
        return;
      }

      minhaSenha     = dados.senha;
      statusAnterior = null;
      guardarSenhaLocal(minhaSenha);
      atualizarDisplaySenha();
      iniciarAcompanhamento(minhaSenha.numero);
      mostrarMensagem(`✅ Senha emitida: ${minhaSenha.numero} · ${servicoSelecionado.nome}`, 'ok');
      await atualizarEstatisticas();

      N && N.notify('success', `Senha <strong>${minhaSenha.numero}</strong> emitida. Aguarde ser chamado(a).`, 6000);

    } catch (err) {
      console.error('❌ Emitir:', err);
      mostrarMensagem('❌ Erro de ligação ao servidor', 'warn');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Emitir Senha'; }
    }
  }

  /* ── localStorage ────────────────────────────────────────── */
  function guardarSenhaLocal(senha) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(senha)); } catch (_) {}
  }

  function limparSenhaLocal() {
    localStorage.removeItem(STORAGE_KEY);
    minhaSenha = null;
  }

  function restaurarSenhaGuardada() {
    try {
      const guardada = localStorage.getItem(STORAGE_KEY);
      if (!guardada) return;
      const senha    = JSON.parse(guardada);
      const hoje     = new Date().toISOString().split('T')[0];
      const dataEmissao = senha.data_emissao || '';
      if (dataEmissao !== hoje) {
        console.info(`[restaurar] Senha ${senha.numero} de ${dataEmissao} — descartada`);
        limparSenhaLocal();
        return;
      }
      minhaSenha     = senha;
      statusAnterior = senha.status;
      atualizarDisplaySenha();
      if (!['concluida', 'cancelada'].includes(senha.status)) {
        iniciarAcompanhamento(senha.numero);
      }
      console.info(`[restaurar] Senha ${senha.numero} restaurada (${senha.status})`);
    } catch (err) {
      console.warn('[restaurar]', err);
      limparSenhaLocal();
    }
  }

  /* ── Polling geral ───────────────────────────────────────── */
  function iniciarPollingGeral() {
    pararPollingGeral();
    pollingGeral = setInterval(async () => {
      await atualizarEstatisticas();
      await atualizarUltimaChamada();   // ← actualiza última chamada regularmente
    }, 5000);
  }

  function pararPollingGeral() {
    if (pollingGeral) { clearInterval(pollingGeral); pollingGeral = null; }
  }

  /* ── Header ──────────────────────────────────────────────── */
  function configurarHeader() {
    const user = store.getUser();
    const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    if (user) {
      set('userProfileName', `Bem-vindo, ${user.name}`);
      set('dadoNome',   user.name  || '—');
      set('dadoEmail',  user.email || '—');
      set('dadoPerfil', user.role  || '—');
    } else {
      set('userProfileName', 'Bem-vindo');
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
      pararPollingGeral();
      pararAcompanhamento();
      limparSenhaLocal();
      store.logout();
    });

    const painel    = document.getElementById('meusDadosPanel');
    const btnDados  = document.getElementById('btnMeusDados');
    const btnFechar = document.getElementById('btnFecharDados');
    if (btnDados && painel)  btnDados.addEventListener('click',  () => painel.classList.add('aberto'));
    if (btnFechar && painel) btnFechar.addEventListener('click', () => painel.classList.remove('aberto'));

    /* Flash message de emissão (vinda de service-form.js) */
    const flash = localStorage.getItem('imtsb_flash');
    if (flash) { mostrarMensagem(flash, 'ok'); localStorage.removeItem('imtsb_flash'); }
  }

  /* ── Init ────────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ dashusuario.js Sprint 4 carregado");
    configurarHeader();
    configurarBotoes();
    carregarServicos();
    atualizarEstatisticas();
    atualizarUltimaChamada();   // ← primeira chamada imediata
    restaurarSenhaGuardada();
    iniciarPollingGeral();
  });

})();