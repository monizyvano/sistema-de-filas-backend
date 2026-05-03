/**
 * static/js/dashadm.js — Sprint 5
 * ═══════════════════════════════════════════════════════════════
 * MELHORIAS:
 *   ✅ Produtividade: métricas avançadas (avaliação ★, tempo médio,
 *      atendimentos, taxa conclusão, redireccionamentos)
 *   ✅ Pesquisa de trabalhador por nome ou departamento
 *   ✅ "Trabalhador do Mês" calculado automaticamente por score
 *   ✅ Histórico com paginação e filtros de período
 *   ✅ Exportação Excel / PDF com relatório completo
 *   ✅ KPIs, gráficos, gestão de membros mantidos
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  const store = window.IMTSBStore;

  let pieChart         = null;
  let lineChart        = null;
  let barChart         = null;
  let pollingInterval  = null;
  let periodoActivo    = 'semana';
  let _todosTrabalhadores = [];   // cache para pesquisa
  let _filtroNome        = '';    // filtro de pesquisa activo

  const historicoState = { page:1, perPage:15, total:0, totalPages:1 };

  /* ── Helper de base URL ────────────────────────────────── */
  const BASE = () => (window.IMTSBApiConfig?.baseUrl || '/api');
  const tok  = () => store.getToken();

  /* ── fetch autenticado ─────────────────────────────────── */
  async function api(path, opts = {}) {
    return fetch(`${BASE()}${path}`, {
      ...opts,
      headers: { 'Content-Type':'application/json',
                 'Authorization': `Bearer ${tok()}`,
                 ...(opts.headers || {}) }
    });
  }

  /* ════════════════════════════════════════════════════════════
     INICIALIZAÇÃO
  ════════════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', async () => {
    if (!store.isLoggedIn()) { window.location.href = '/login'; return; }
    const user = store.getUser();
    if (user?.role !== 'admin') {
      alert('Acesso negado.'); window.location.href = '/'; return;
    }

    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-PT', {
      weekday:'long', year:'numeric', month:'long', day:'numeric'
    });

    atualizarHeader();
    await carregarDashboard();
    configurarBotoes();
    iniciarPolling();
  });

  /* ════════════════════════════════════════════════════════════
     CARREGAR DASHBOARD COMPLETO
  ════════════════════════════════════════════════════════════ */
  async function carregarDashboard() {
    await Promise.all([
      atualizarKPIs(),
      atualizarFilas(),
      carregarTrabalhadores(),
      atualizarHistorico(1),
      criarGraficos(),
      atualizarTempoPorServico()
    ]);
  }

  /* ════════════════════════════════════════════════════════════
     KPIs
  ════════════════════════════════════════════════════════════ */
  async function atualizarKPIs() {
    try {
      const r = await fetch(`${BASE()}/senhas/estatisticas`);
      if (!r.ok) return;
      const s = await r.json();

      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      set('kpiAttend', s.concluidas || 0);
      set('kpiWait',   `${s.tempo_medio_espera || 0}min`);

      const total = (s.aguardando||0) + (s.atendendo||0);
      const taxa  = total > 0 ? Math.round((s.atendendo / total)*100) : 0;
      set('kpiOcc',      `${taxa}%`);
      set('kpiOccTrend', `${taxa}%`);

      const t = s.total_emitidas||0, c = s.concluidas||0;
      set('kpiSat', t > 0 ? `${Math.round((c/t)*100)}%` : '0%');

      await atualizarTrendReal();
    } catch (e) { console.error('KPIs:', e); }
  }

  async function atualizarTrendReal() {
    const el = document.getElementById('trendAttend');
    if (!el) return;
    try {
      const r = await api('/dashboard/admin/trend');
      if (!r.ok) return;
      const d = await r.json();
      const p = d.variacao_percentual;
      if (d.tendencia === 'alta')  { el.textContent = `+${p}%`; el.style.color = '#22c55e'; }
      else if (d.tendencia === 'baixa') { el.textContent = `${p}%`;  el.style.color = '#ef4444'; }
      else { el.textContent = '~0%'; el.style.color = '#6b7280'; }
      el.title = `Hoje: ${d.hoje} | Ontem: ${d.ontem}`;
    } catch (_) { el.textContent = '--'; }
  }

  /* ════════════════════════════════════════════════════════════
     FILAS EM TEMPO REAL
  ════════════════════════════════════════════════════════════ */
  async function atualizarFilas() {
    try {
      const [rS, rF] = await Promise.all([
        fetch(`${BASE()}/servicos`),
        fetch(`${BASE()}/senhas?status=aguardando&hoje=1&page=1&per_page=200`,
              { headers: { Authorization:`Bearer ${tok()}` } })
      ]);
      const servicos = rS.ok ? await rS.json() : [];
      const dadosF   = rF.ok ? await rF.json() : {};
      const senhas   = Array.isArray(dadosF) ? dadosF : (dadosF.senhas || []);

      const map = {};
      senhas.forEach(s => { const sid = s.servico_id||s.servico?.id; map[sid] = (map[sid]||0)+1; });

      const queueList = document.getElementById('queueList');
      if (!queueList) return;
      const lista = Array.isArray(servicos) ? servicos : (servicos.servicos || servicos);
      const total = Object.values(map).reduce((a,b)=>a+b, 0);

      if (!lista.length) return;
      if (total === 0) {
        queueList.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);">
          <div style="font-size:2rem;margin-bottom:.5rem;">✅</div>Nenhuma senha aguardando</div>`;
        return;
      }
      queueList.innerHTML = lista.map(s => `
        <div class="queue-item">
          <div>
            <div class="queue-service">${s.icone||'📋'} ${s.nome}</div>
            <div class="queue-count">${map[s.id]||0} pessoa(s) aguardando</div>
          </div>
          <div class="queue-number" style="color:${(map[s.id]||0)>0?'var(--primary-brown)':'var(--text-muted)'}">
            ${String(map[s.id]||0).padStart(2,'0')}
          </div>
        </div>`).join('');
    } catch (e) { console.error('Filas:', e); }
  }

  /* ════════════════════════════════════════════════════════════
     GRÁFICOS
  ════════════════════════════════════════════════════════════ */
  async function criarGraficos() {
    try {
      const r = await fetch(`${BASE()}/senhas/estatisticas`);
      if (!r.ok) return;
      const s = await r.json();
      const pieCtx = document.getElementById('pieChart');
      if (pieCtx) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCtx, {
          type: 'doughnut',
          data: {
            labels: ['Aguardando','Em Atendimento','Concluídas','Canceladas'],
            datasets: [{ data: [s.aguardando||0,s.atendendo||0,s.concluidas||0,s.canceladas||0],
              backgroundColor:['#bf9770','#6b4226','#22c55e','#ef4444'], borderWidth:0, hoverOffset:8 }]
          },
          options: { responsive:true, maintainAspectRatio:false, cutout:'68%',
            plugins:{ legend:{ position:'bottom', labels:{ padding:14,font:{size:12},usePointStyle:true } } } }
        });
      }
      await atualizarLineChart(periodoActivo);
    } catch (e) { console.error('Gráficos:', e); }
  }

  window.changeChartPeriod = async function(periodo) {
    periodoActivo = periodo;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    await atualizarLineChart(periodo);
  };

  async function atualizarLineChart(periodo) {
    const ctx = document.getElementById('lineChart');
    if (!ctx) return;
    try {
      const r = await api(`/dashboard/admin/fluxo?periodo=${periodo}`);
      if (!r.ok) return;
      const d = await r.json();
      if (lineChart) lineChart.destroy();
      lineChart = new Chart(ctx, {
        type:'line',
        data:{ labels:d.labels, datasets:[{
          label:'Atendimentos concluídos', data:d.dados,
          borderColor:'#6b4226', backgroundColor:'rgba(107,66,38,.08)',
          borderWidth:2.5, pointRadius:4, pointBackgroundColor:'#6b4226',
          fill:true, tension:.35
        }] },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{display:false} },
          scales:{ y:{beginAtZero:true,ticks:{stepSize:1,precision:0}},
                   x:{ticks:{maxTicksLimit:12,autoSkip:true}} } }
      });
    } catch (e) { console.error('LineChart:', e); }
  }

  async function atualizarTempoPorServico() {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    try {
      const r = await api('/dashboard/admin/tempo-por-servico');
      if (!r.ok) return;
      const { servicos: sv } = await r.json();
      if (!sv?.length) return;
      const labels  = sv.map(s => s.nome.length>14 ? s.nome.slice(0,14)+'…' : s.nome);
      if (barChart) barChart.destroy();
      barChart = new Chart(ctx, {
        type:'bar',
        data:{ labels, datasets:[
          { label:'Tempo médio (min)', data:sv.map(s=>s.tempo_medio),
            backgroundColor:'#6b4226', borderRadius:6, yAxisID:'y' },
          { label:'Total atendidos', data:sv.map(s=>s.total_hoje),
            backgroundColor:'rgba(107,66,38,.25)', borderRadius:6, yAxisID:'y1' }
        ] },
        options:{ responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{ position:'bottom', labels:{padding:12,usePointStyle:true} } },
          scales:{
            y: { beginAtZero:true,position:'left', title:{display:true,text:'min'}, ticks:{stepSize:1} },
            y1:{ beginAtZero:true,position:'right',grid:{drawOnChartArea:false},title:{display:true,text:'qtd'},ticks:{precision:0} }
          } }
      });
    } catch (e) { console.error('BarChart:', e); }
  }

  /* ════════════════════════════════════════════════════════════
     ★ PRODUTIVIDADE — métricas avançadas + pesquisa + mês
  ════════════════════════════════════════════════════════════ */
  async function carregarTrabalhadores() {
    const perfBody    = document.getElementById('performanceBody');
    const workersBody = document.getElementById('workersBody');
    const loadMsg     = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1.2rem;">A carregar…</td></tr>';
    if (perfBody)    perfBody.innerHTML    = loadMsg;
    if (workersBody) workersBody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1rem;">A carregar…</td></tr>';

    try {
      const r = await api('/atendentes/');
      if (!r.ok) throw new Error(r.status);
      const lista = await r.json();
      _todosTrabalhadores = Array.isArray(lista) ? lista : [];
      renderProdutividade(_todosTrabalhadores);
      renderGestaoMembros(_todosTrabalhadores);
      renderTrabalhadorMes(_todosTrabalhadores);
    } catch (e) {
      console.error('Trabalhadores:', e);
      const err = '<tr><td colspan="7" style="color:#ef4444;text-align:center;padding:1rem;">Erro ao carregar</td></tr>';
      if (perfBody)    perfBody.innerHTML    = err;
      if (workersBody) workersBody.innerHTML = err;
    }
  }

  /* ── Calcular score composto (0–100) ──────────────────── */
  function calcularScore(t) {
    const atend    = t.atendimentos_hoje || 0;
    const tempo    = t.tempo_medio       || 0;
    const nota     = t.avaliacao_media   || 0;    // 0–5 ★
    const taxa     = t.taxa_conclusao    || 100;  // %
    const redir    = t.redirecionamentos || 0;

    /* Normalizar cada métrica (0–100) */
    const pAtend  = Math.min(atend / 20 * 100, 100);        // referência: 20 atend = 100%
    const pTempo  = Math.max(0, 100 - (tempo - 5) * 4);     // <5min ideal; >30min = 0
    const pNota   = nota > 0 ? (nota / 5) * 100 : 70;       // sem nota → neutro 70
    const pTaxa   = taxa;
    const pRedir  = Math.max(0, 100 - redir * 10);          // cada redir -10pts

    /* Pesos: nota 35% | taxa 25% | atend 20% | tempo 12% | redir 8% */
    return Math.round(
      pNota * .35 + pTaxa * .25 + pAtend * .20 + pTempo * .12 + pRedir * .08
    );
  }

  function scoreBadge(sc) {
    if (sc >= 85) return { label:'⭐ Excelente',  cor:'#065f46', bg:'rgba(5,150,105,.12)' };
    if (sc >= 70) return { label:'👍 Bom',         cor:'#6b4226', bg:'rgba(107,66,38,.12)' };
    if (sc >= 50) return { label:'😐 Regular',      cor:'#d97706', bg:'rgba(217,119,6,.1)'  };
    return             { label:'⚠ Melhoria',      cor:'#b91c1c', bg:'rgba(220,38,38,.1)'  };
  }

  /* ── Render tabela de produtividade ──────────────────── */
  function renderProdutividade(lista) {
    const body = document.getElementById('performanceBody');
    if (!body) return;

    const filtrado = _filtroNome
      ? lista.filter(t =>
          t.nome.toLowerCase().includes(_filtroNome) ||
          (t.departamento||'').toLowerCase().includes(_filtroNome))
      : lista;

    if (!filtrado.length) {
      body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1.5rem;">Nenhum resultado para "' + _filtroNome + '"</td></tr>';
      return;
    }

    /* Ordenar por score desc */
    const comScore = filtrado
      .filter(t => t.tipo === 'atendente' && t.ativo)
      .map(t => ({ ...t, _score: calcularScore(t) }))
      .sort((a,b) => b._score - a._score);

    const admins = filtrado.filter(t => t.tipo === 'admin');
    const inact  = filtrado.filter(t => !t.ativo);
    const todos  = [...comScore, ...admins, ...inact];

    body.innerHTML = todos.map((t, idx) => {
      const sc     = t._score ?? null;
      const badge  = sc !== null ? scoreBadge(sc) : null;
      const nota   = t.avaliacao_media > 0
        ? '★'.repeat(Math.round(t.avaliacao_media)) + `<small style="font-size:.7rem;"> (${(+t.avaliacao_media).toFixed(1)})</small>`
        : '<span style="color:#d1d5db;">Sem avaliações</span>';
      const tipoLabel  = t.tipo === 'admin' ? '👑 Admin' : '👤 Atendente';
      const statusDot  = t.ativo
        ? '<span style="color:#22c55e;margin-right:4px;">●</span>'
        : '<span style="color:#9ca3af;margin-right:4px;">●</span>';

      return `<tr style="${!t.ativo ? 'opacity:.5;' : ''}">
        <td>
          <div class="employee-info">
            <div class="employee-avatar">${getInits(t.nome)}</div>
            <div>
              <div class="employee-name">${statusDot}${t.nome}${!t.ativo ? ' <em style="font-size:.75rem;color:#9ca3af;">(inactivo)</em>' : ''}</div>
              <div class="employee-role">${tipoLabel} · ${t.departamento||'Geral'}${t.balcao ? ` · Balcão ${t.balcao}` : ''}</div>
            </div>
          </div>
        </td>
        <td><strong>${t.atendimentos_hoje||0}</strong></td>
        <td>${t.tempo_medio||0} min</td>
        <td style="font-size:.82rem;">${nota}</td>
        <td>${t.taxa_conclusao != null ? (t.taxa_conclusao+'%') : '—'}</td>
        <td>${t.ativo ? '<span style="color:#22c55e">Activo</span>' : '<span style="color:#9ca3af">Inactivo</span>'}</td>
        <td>
          ${badge
            ? `<span style="background:${badge.bg};color:${badge.cor};
                 padding:.25rem .65rem;border-radius:20px;font-size:.75rem;font-weight:700;
                 white-space:nowrap;">${badge.label} (${sc}%)</span>`
            : '<span style="color:#9ca3af;font-size:.8rem;">—</span>'}
        </td>
      </tr>`;
    }).join('');
  }

  /* ── Trabalhador do Mês ──────────────────────────────── */
  function renderTrabalhadorMes(lista) {
    const container = document.getElementById('trabalhadorMesCard');
    if (!container) return;

    const candidatos = lista
      .filter(t => t.tipo === 'atendente' && t.ativo)
      .map(t => ({ ...t, _score: calcularScore(t) }))
      .sort((a,b) => b._score - a._score);

    if (!candidatos.length) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;">Sem dados suficientes.</p>';
      return;
    }

    const top = candidatos[0];
    const sc  = top._score;
    const nota = top.avaliacao_media > 0
      ? `★ ${(+top.avaliacao_media).toFixed(1)}`
      : 'Sem avaliações';

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
        <div style="
          width:64px;height:64px;border-radius:50%;
          background:linear-gradient(135deg,#c4a164,#8c6746);
          display:flex;align-items:center;justify-content:center;
          font-family:'Poppins',sans-serif;font-size:1.5rem;font-weight:800;color:#fff;
          box-shadow:0 4px 16px rgba(140,103,70,.35);flex-shrink:0;
        ">${getInits(top.nome)}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
            <span style="font-size:1.25rem;font-weight:800;color:#3e2510;">${top.nome}</span>
            <span style="background:rgba(196,161,100,.2);color:#6b4226;
                         padding:.2rem .75rem;border-radius:20px;font-size:.78rem;font-weight:700;">
              🏆 Trabalhador do Mês
            </span>
          </div>
          <div style="font-size:.85rem;color:#8c6746;margin-top:.25rem;">
            ${top.departamento||'Geral'}${top.balcao ? ` · Balcão ${top.balcao}` : ''}
          </div>
          <div style="display:flex;gap:1.25rem;margin-top:.5rem;flex-wrap:wrap;">
            <span style="font-size:.8rem;"><strong>${top.atendimentos_hoje||0}</strong> atendimentos</span>
            <span style="font-size:.8rem;"><strong>${top.tempo_medio||0}min</strong> médio</span>
            <span style="font-size:.8rem;"><strong>${nota}</strong></span>
            <span style="font-size:.8rem;font-weight:700;color:#065f46;">Score: ${sc}%</span>
          </div>
        </div>
      </div>
      ${candidatos.length > 1 ? `
        <div style="margin-top:1rem;padding-top:.75rem;border-top:1px solid #f0e8dc;">
          <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;
                      letter-spacing:.08em;color:#8c6746;margin-bottom:.5rem;">
            Pódio do dia
          </div>
          <div style="display:flex;flex-direction:column;gap:.4rem;">
            ${candidatos.slice(0,3).map((c,i) => `
              <div style="display:flex;align-items:center;gap:.65rem;">
                <span style="font-size:.9rem;min-width:18px;">
                  ${['🥇','🥈','🥉'][i]}
                </span>
                <span style="font-size:.85rem;font-weight:600;color:#3e2510;flex:1;">
                  ${c.nome}
                </span>
                <span style="font-size:.78rem;color:#8c6746;">
                  ${c.atendimentos_hoje||0} atend. · ${c.avaliacao_media > 0 ? '★'+Number(c.avaliacao_media).toFixed(1) : '—'} · ${c._score}%
                </span>
              </div>`).join('')}
          </div>
        </div>` : ''}
    `;
  }

  /* ── Gestão de membros (tabela simples) ──────────────── */
  function renderGestaoMembros(lista) {
    const body = document.getElementById('workersBody');
    if (!body) return;
    if (!lista.length) {
      body.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1.5rem;">Nenhum membro</td></tr>';
      return;
    }
    body.innerHTML = lista.map(t => `
      <tr style="${!t.ativo ? 'opacity:.5;' : ''}">
        <td>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <div class="employee-avatar" style="width:32px;height:32px;font-size:.75rem;">${getInits(t.nome)}</div>
            <span>${t.nome} ${t.tipo==='admin'?'👑':''}</span>
          </div>
        </td>
        <td style="font-size:.85rem;color:var(--text-muted);">${t.email}</td>
        <td style="font-size:.85rem;">${t.departamento||'–'}${t.balcao?` · Balcão ${t.balcao}`:''}</td>
        <td>
          ${t.ativo
            ? `<button class="remove-worker-btn"
                 onclick="removerTrabalhador(${t.id},'${t.nome.replace(/'/g,"\\'")}')">Desactivar</button>`
            : `<span style="color:#9ca3af;font-size:.8rem;">Inactivo</span>`}
        </td>
      </tr>`).join('');
  }

  /* ── Pesquisa de trabalhador ─────────────────────────── */
  window.pesquisarTrabalhador = function(val) {
    _filtroNome = (val || '').toLowerCase().trim();
    renderProdutividade(_todosTrabalhadores);
  };

  /* ── Adicionar membro ────────────────────────────────── */
  async function adicionarTrabalhador() {
    const nome  = (document.getElementById('newWorkerName')?.value  || '').trim();
    const email = (document.getElementById('newWorkerEmail')?.value || '').trim();
    const senha = (document.getElementById('newWorkerPass')?.value  || '').trim();
    const role  = (document.getElementById('newWorkerRole')?.value  || 'atendente');
    const dept  = (document.getElementById('newWorkerDept')?.value  || '');
    const msgEl = document.getElementById('workerFormMsg');

    const setMsg = (t, ok) => {
      if (!msgEl) return;
      msgEl.textContent = t;
      msgEl.style.color = ok ? '#22c55e' : '#ef4444';
      msgEl.style.fontWeight = '600';
    };

    if (!nome || !email || !senha) { setMsg('Nome, email e senha são obrigatórios.', false); return; }
    if (senha.length < 6) { setMsg('A senha deve ter pelo menos 6 caracteres.', false); return; }

    const mapaServico = {
      'Secretaria Academica':1,'Contabilidade':2,
      'Direccao Pedagogica':3,'Biblioteca':4,'Apoio ao Cliente':5
    };
    const servicoId = role === 'admin' ? null : (mapaServico[dept] || null);

    const btn = document.getElementById('btnAddWorker');
    if (btn) { btn.disabled = true; btn.textContent = 'A criar…'; }

    try {
      const r = await api('/atendentes/', {
        method:'POST',
        body: JSON.stringify({ nome, email, senha, tipo:role, servico_id:servicoId })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const bal = d.atendente?.balcao ? ` (Balcão ${d.atendente.balcao})` : '';
        setMsg(`✅ "${nome}" criado com sucesso!${bal}`, true);
        ['newWorkerName','newWorkerEmail','newWorkerPass'].forEach(id => {
          const el = document.getElementById(id); if (el) el.value = '';
        });
        await carregarTrabalhadores();
        setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 6000);
      } else {
        setMsg(d.erro || 'Erro ao criar membro.', false);
      }
    } catch (e) {
      console.error('Adicionar:', e); setMsg('Erro de ligação.', false);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Adicionar membro'; }
    }
  }

  /* ════════════════════════════════════════════════════════════
     HISTÓRICO COM FILTROS DE PERÍODO
  ════════════════════════════════════════════════════════════ */
  let _filtroActivo = 'hoje';

  function _calcularIntervalo(periodo) {
    const hoje  = new Date();
    const pad   = n => String(n).padStart(2,'0');
    const fmt   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    const hs    = fmt(hoje);
    if (periodo === 'hoje')    return { de:hs, ate:hs };
    if (periodo === 'semana') {
      const seg = new Date(hoje); seg.setDate(hoje.getDate()-hoje.getDay()+1);
      return { de:fmt(seg), ate:hs };
    }
    if (periodo === 'mes') {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      return { de:fmt(ini), ate:hs };
    }
    if (periodo === 'intervalo') {
      return {
        de:  document.getElementById('filtroDataDe')?.value  || '',
        ate: document.getElementById('filtroDataAte')?.value || hs
      };
    }
    return { de:'', ate:'' };
  }

  function _realcarFiltro(nome) {
    ['filtroHoje','filtroSemana','filtroMes','filtroTodos'].forEach(id => {
      const b = document.getElementById(id);
      if (!b) return;
      const act = id === 'filtro' + nome.charAt(0).toUpperCase() + nome.slice(1);
      b.style.background = act ? '#6b4226' : 'white';
      b.style.color      = act ? 'white'   : '#6b4226';
    });
  }

  window.filtrarHistorico = function(periodo) {
    _filtroActivo = periodo;
    _realcarFiltro(periodo);
    historicoState.page = 1;
    atualizarHistorico(1);
  };

  async function atualizarHistorico(page) {
    try {
      const pg = page || historicoState.page;
      const pp = historicoState.perPage;
      const { de, ate } = _calcularIntervalo(_filtroActivo);
      let url = `/senhas?status=concluida&page=${pg}&per_page=${pp}`;
      if (de)  url += `&data_de=${de}`;
      if (ate) url += `&data_ate=${ate}`;

      const r = await api(url);
      if (!r.ok) return;
      const data = await r.json();

      historicoState.page       = data.page       || pg;
      historicoState.total      = data.total        || 0;
      historicoState.totalPages = data.total_pages  || 1;

      const body = document.getElementById('historyBody');
      if (!body) return;

      const senhas = data.senhas || [];
      if (!senhas.length && pg === 1) {
        body.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Sem atendimentos no período</td></tr>';
        renderNavegacao(); return;
      }

      const fmtTs = iso => iso
        ? new Date(iso.endsWith('Z') ? iso : iso+'Z')
            .toLocaleString('pt-PT', { timeZone:'Africa/Luanda',
              day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' })
        : '--';

      body.innerHTML = senhas.map(s => {
        const servico   = s.servico?.nome   || 'Serviço';
        const atendente = s.atendente?.nome || '–';
        const duracao   = s.tempo_atendimento_minutos || 0;
        const espera    = s.tempo_espera_minutos      || 0;
        const dataHora  = fmtTs(s.atendimento_concluido_em || s.emitida_em);
        const tipoBadge = s.tipo === 'prioritaria'
          ? '<span style="background:rgba(245,158,11,.15);color:#92400e;padding:2px 8px;border-radius:20px;font-size:.75rem;font-weight:700;">★ Prior.</span>'
          : '<span style="background:rgba(107,66,38,.1);color:#6b4226;padding:2px 8px;border-radius:20px;font-size:.75rem;">Normal</span>';
        const notaHtml = s.avaliacao_nota
          ? `${'⭐'.repeat(s.avaliacao_nota)}<small style="font-size:.72rem;"> (${s.avaliacao_nota})</small>`
          : '<span style="color:#d1d5db;">—</span>';
        return `<tr>
          <td><strong>${s.numero}</strong> ${tipoBadge}</td>
          <td>${servico}</td>
          <td>${atendente}</td>
          <td style="font-size:.8rem;">${dataHora}</td>
          <td>${espera ? espera+'min' : '–'}</td>
          <td>${duracao}min</td>
          <td>
            <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
              <span class="performance-badge badge-excellent">✓ Concluído</span>
              <span style="font-size:.8rem;">${notaHtml}</span>
              <button onclick="verDetalhesSenha(${s.id},'${s.numero}','${servico}')"
                style="background:#f0e8dc;border:none;border-radius:8px;padding:.25rem .6rem;
                       font-size:.78rem;font-weight:700;color:#6b4226;cursor:pointer;">👁 Ver</button>
            </div>
          </td>
        </tr>`;
      }).join('');

      renderNavegacao();
    } catch (e) { console.error('Histórico:', e); }
  }

  function renderNavegacao() {
    const bA = document.getElementById('historyPrevBtn');
    const bP = document.getElementById('historyNextBtn');
    const pi = document.getElementById('historyPageInfo');
    const { page, totalPages, total } = historicoState;
    if (bA) { bA.disabled = page<=1;          bA.onclick = () => atualizarHistorico(page-1); }
    if (bP) { bP.disabled = page>=totalPages; bP.onclick = () => atualizarHistorico(page+1); }
    if (pi) pi.textContent = `Página ${page} de ${totalPages} · ${total} registos`;
  }

  /* ════════════════════════════════════════════════════════════
     EXPORTAÇÃO
  ════════════════════════════════════════════════════════════ */
  async function _carregarParaExport() {
    const { de, ate } = _calcularIntervalo(_filtroActivo);
    let url = `/senhas?page=1&per_page=500&status=concluida`;
    if (de)  url += `&data_de=${de}`;
    if (ate) url += `&data_ate=${ate}`;
    const r = await api(url);
    if (!r.ok) throw new Error();
    const d = await r.json();
    return d.senhas || [];
  }

  function _fmtTs(iso) {
    if (!iso) return '–';
    return new Date(iso.endsWith('Z') ? iso : iso+'Z')
      .toLocaleString('pt-PT', { timeZone:'Africa/Luanda',
        day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit' });
  }

  function _labelPeriodo() {
    return { hoje:'Hoje', semana:'Esta Semana', mes:'Este Mês',
      todos:'Todos', intervalo:'Intervalo'
    }[_filtroActivo] || '';
  }

  window.exportData = async function() {
    const fmt = document.getElementById('exportFormat')?.value || 'excel';
    try {
      const r = await api('/senhas?status=concluida&hoje=1&page=1&per_page=500');
      if (!r.ok) { showToast('Não foi possível carregar dados.','error'); return; }
      const data   = await r.json();
      const senhas = data.senhas || [];
      if (!senhas.length) { showToast('Sem dados para exportar hoje.','warn'); return; }

      const agora = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });
      const hoje  = new Date().toLocaleDateString('pt-PT', { timeZone:'Africa/Luanda' });
      const n     = senhas.length;
      const mE    = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_espera_minutos||0),0)/n) : 0;
      const mA    = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_atendimento_minutos||0),0)/n) : 0;
      const nPri  = senhas.filter(s=>s.tipo==='prioritaria').length;
      const mNota = (() => {
        const avs = senhas.filter(s=>s.avaliacao_nota);
        return avs.length ? (avs.reduce((a,s)=>a+s.avaliacao_nota,0)/avs.length).toFixed(1) : '—';
      })();

      if (fmt === 'excel' && window.XLSX) {
        const resumo = [
          ['IMTSB — Relatório Diário',''],
          ['Data', hoje], ['Gerado em', agora], [''],
          ['Total de Atendimentos', n], ['Prioritários', nPri],
          ['Tempo Médio de Espera (min)', mE],
          ['Duração Média de Atendimento (min)', mA],
          ['Avaliação Média', mNota],
        ];
        const detalhe = senhas.map(s => ({
          'Senha': s.numero, 'Tipo': s.tipo==='prioritaria'?'Prioritária':'Normal',
          'Serviço': s.servico?.nome||'–', 'Atendente': s.atendente?.nome||'–',
          'Balcão': s.numero_balcao||'–',
          'Emitida em': _fmtTs(s.emitida_em), 'Conclusão': _fmtTs(s.atendimento_concluido_em),
          'Espera (min)': s.tempo_espera_minutos||0, 'Duração (min)': s.tempo_atendimento_minutos||0,
          'Avaliação ★': s.avaliacao_nota||'—', 'Comentário': s.avaliacao_comentario||''
        }));
        const wb  = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet(resumo);
        const ws2 = XLSX.utils.json_to_sheet(detalhe);
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo do Dia');
        XLSX.utils.book_append_sheet(wb, ws2, 'Detalhe');
        XLSX.writeFile(wb, `imtsb_relatorio_${new Date().toISOString().slice(0,10)}.xlsx`);
        return;
      }
      _gerarPDF(senhas, 'Hoje — '+hoje, agora, { n, nPri, mE, mA, mNota });
    } catch (e) { console.error('Export:', e); showToast('Erro ao exportar.','error'); }
  };

  window.exportarHistorico = async function(fmt) {
    try {
      showToast('A preparar exportação…','');
      const senhas = await _carregarParaExport();
      if (!senhas.length) { showToast('Sem dados no período.','warn'); return; }
      const agora = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });
      const label = _labelPeriodo();
      const n     = senhas.length;
      const mE    = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_espera_minutos||0),0)/n) : 0;
      const mA    = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_atendimento_minutos||0),0)/n) : 0;
      const nPri  = senhas.filter(s=>s.tipo==='prioritaria').length;
      const mNota = (() => {
        const avs = senhas.filter(s=>s.avaliacao_nota);
        return avs.length ? (avs.reduce((a,s)=>a+s.avaliacao_nota,0)/avs.length).toFixed(1) : '—';
      })();

      if (fmt === 'excel' && window.XLSX) {
        const wb  = XLSX.utils.book_new();
        const ws1 = XLSX.utils.aoa_to_sheet([
          ['IMTSB — Relatório',''], ['Período',label], ['Gerado em',agora], [''],
          ['Total',n], ['Prioritários',nPri], ['Espera média',mE+' min'],
          ['Duração média',mA+' min'], ['Avaliação média',mNota]
        ]);
        const ws2 = XLSX.utils.json_to_sheet(senhas.map(s => ({
          'Senha':s.numero, 'Tipo':s.tipo==='prioritaria'?'Prioritária':'Normal',
          'Serviço':s.servico?.nome||'–', 'Atendente':s.atendente?.nome||'–',
          'Emitida':_fmtTs(s.emitida_em), 'Conclusão':_fmtTs(s.atendimento_concluido_em),
          'Espera':s.tempo_espera_minutos||0, 'Duração':s.tempo_atendimento_minutos||0,
          'Avaliação ★':s.avaliacao_nota||'—', 'Comentário':s.avaliacao_comentario||''
        })));
        XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
        XLSX.utils.book_append_sheet(wb, ws2, 'Atendimentos');
        const slug = label.replace(/\s+/g,'_').toLowerCase();
        XLSX.writeFile(wb, `imtsb_historico_${slug}.xlsx`);
        showToast('Excel exportado!','success');
        return;
      }
      _gerarPDF(senhas, label, agora, { n, nPri, mE, mA, mNota });
    } catch (e) { console.error('exportarHistorico:', e); showToast('Erro ao exportar.','error'); }
  };

  function _gerarPDF(senhas, label, agora, { n, nPri, mE, mA, mNota }) {
    if (!window.jspdf) { showToast('Biblioteca PDF não carregada.','error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
    doc.setFillColor(62,37,16);
    doc.roundedRect(10,8,277,20,3,3,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('IMTSB · Relatório de Atendimentos', 15, 17);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`Período: ${label}`, 15, 23);
    doc.text(`Gerado em: ${agora}`, 200, 23);
    [['Total',String(n)],['Prioritários',String(nPri)],
     ['Média Espera',`${mE} min`],['Avaliação ★',String(mNota)]
    ].forEach(([l,v],i) => {
      const x = 10+i*70;
      doc.setFillColor(253,248,245); doc.roundedRect(x,32,66,16,2,2,'F');
      doc.setTextColor(107,66,38); doc.setFontSize(16); doc.setFont('helvetica','bold');
      doc.text(v, x+33, 42, { align:'center' });
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(140,103,70);
      doc.text(l.toUpperCase(), x+33, 46, { align:'center' });
    });
    doc.autoTable({
      head:[['Senha','Tipo','Serviço','Atendente','Emitida','Conclusão','Espera','Duração','★']],
      body: senhas.map(s=>[
        s.numero, s.tipo==='prioritaria'?'★ Prior.':'Normal',
        s.servico?.nome||'–', s.atendente?.nome||'–',
        _fmtTs(s.emitida_em), _fmtTs(s.atendimento_concluido_em),
        (s.tempo_espera_minutos||0)+' min', (s.tempo_atendimento_minutos||0)+' min',
        s.avaliacao_nota||'—'
      ]),
      startY:52, margin:{left:10,right:10},
      styles:{fontSize:7,cellPadding:2.2},
      headStyles:{fillColor:[107,66,38],textColor:255,fontStyle:'bold'},
      alternateRowStyles:{fillColor:[253,248,245]},
      didDrawPage:(d)=>{
        doc.setFontSize(7); doc.setTextColor(160,130,110);
        doc.text(`IMTSB · Pág. ${d.pageNumber}`, 148.5,
          doc.internal.pageSize.height-5, { align:'center' });
      }
    });
    const slug = label.replace(/\s+/g,'_').replace(/\//g,'-').toLowerCase();
    doc.save(`imtsb_relatorio_${slug}.pdf`);
    showToast('PDF exportado!','success');
  }

  /* ════════════════════════════════════════════════════════════
     MODAL DETALHES DE SENHA (admin)
  ════════════════════════════════════════════════════════════ */
  let _dadosModalAdmin = null;

  window.verDetalhesSenha = async function(id, numero, servico) {
    const modal = document.getElementById('modalDetalhesAdmin');
    if (!modal) return;
    document.getElementById('mda-titulo').textContent  = `Senha ${numero} · ${servico}`;
    document.getElementById('mda-form').textContent    = 'A carregar…';
    document.getElementById('mda-servico').textContent = servico;
    ['mda-atendente','mda-hora','mda-duracao'].forEach(i => {
      const el = document.getElementById(i); if (el) el.textContent = '–';
    });
    document.getElementById('mda-fich-bloco').style.display = 'none';
    document.getElementById('mda-sem-fich').style.display   = 'block';
    modal.style.display = 'flex';

    try {
      const r = await api(`/senhas/${id}`);
      if (!r.ok) { document.getElementById('mda-form').textContent = 'Erro ao carregar.'; return; }
      const s = _dadosModalAdmin = await r.json();

      const horaStr = s.emitida_em
        ? new Date(s.emitida_em.endsWith('Z') ? s.emitida_em : s.emitida_em+'Z')
            .toLocaleTimeString('pt-PT', { hour:'2-digit',minute:'2-digit',timeZone:'Africa/Luanda' })
        : '–';

      document.getElementById('mda-atendente').textContent = s.atendente?.nome || '–';
      document.getElementById('mda-hora').textContent      = horaStr;
      document.getElementById('mda-duracao').textContent   =
        s.tempo_atendimento_minutos ? `${s.tempo_atendimento_minutos} min` : '–';

      /* Nota de avaliação */
      const notaEl = document.getElementById('mda-nota');
      if (notaEl) notaEl.textContent = s.avaliacao_nota
        ? `${'⭐'.repeat(s.avaliacao_nota)} (${s.avaliacao_nota}/5)`
        : 'Sem avaliação';

      const obs        = s.observacoes || '';
      const partes     = obs.split(' | ').map(p=>p.trim()).filter(Boolean);
      const nomeFich   = partes.find(p=>p.startsWith('FICHEIRO:'))?.replace('FICHEIRO:','').trim()||null;
      const linhasForm = partes.filter(p=>!p.startsWith('FICHEIRO:')).join('\n');

      document.getElementById('mda-form').textContent = linhasForm || 'Sem dados de formulário.';

      if (nomeFich) {
        const url = `/api/senhas/${id}/ficheiro`;
        document.getElementById('mda-fich-nome').textContent =
          `📎 ${nomeFich.split('_').slice(2).join('_')||nomeFich}`;
        document.getElementById('mda-btn-dl').href    = url;
        document.getElementById('mda-btn-vis').onclick = () =>
          window.open(url,'_blank','noopener,noreferrer');
        document.getElementById('mda-fich-bloco').style.display = 'block';
        document.getElementById('mda-sem-fich').style.display   = 'none';
      }
    } catch (e) {
      document.getElementById('mda-form').textContent = 'Erro de ligação.';
    }
  };

  window.fecharModalAdmin = function() {
    document.getElementById('modalDetalhesAdmin').style.display = 'none';
    _dadosModalAdmin = null;
  };

  document.addEventListener('click', e => {
    const m = document.getElementById('modalDetalhesAdmin');
    if (m && e.target === m) window.fecharModalAdmin();
  });

  window.imprimirDetalheAdmin = function() {
    const s = _dadosModalAdmin; if (!s) return;
    const obs        = s.observacoes||'';
    const partes     = obs.split(' | ').map(p=>p.trim()).filter(Boolean);
    const nomeFich   = partes.find(p=>p.startsWith('FICHEIRO:'))?.replace('FICHEIRO:','').trim()||null;
    const linhasForm = partes.filter(p=>!p.startsWith('FICHEIRO:')).join('\n');
    const agora      = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });
    const fmtData = iso => iso
      ? new Date(iso.endsWith('Z')?iso:iso+'Z')
          .toLocaleString('pt-PT',{timeZone:'Africa/Luanda',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : '–';
    const ficheiroHtml = nomeFich
      ? `<div class="row full"><div class="lbl">Documento</div>
         <div class="val"><a href="/api/senhas/${s.id}/ficheiro" target="_blank">
         ${nomeFich.split('_').slice(2).join('_')||nomeFich}</a></div></div>` : '';
    const notaHtml = s.avaliacao_nota
      ? `<div class="row"><div class="lbl">Avaliação</div>
         <div class="val">${'⭐'.repeat(s.avaliacao_nota)} (${s.avaliacao_nota}/5)${s.avaliacao_comentario ? ` — ${s.avaliacao_comentario}` : ''}</div></div>` : '';
    const html = `<html><head><meta charset="UTF-8"><title>Pedido ${s.numero}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;padding:28px;color:#2a1a0a;max-width:600px;margin:0 auto}
      .header{background:linear-gradient(135deg,#3e2510,#6b4226);color:white;padding:16px 20px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between}
      .header h2{font-size:1.15rem;margin-bottom:3px}.header p{opacity:.8;font-size:.76rem}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .row{background:#fdf8f5;border-radius:7px;padding:8px 10px}.row.full{grid-column:span 2}
      .lbl{font-size:.67rem;color:#8a7060;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
      .val{font-weight:700;font-size:.87rem;color:#3e2510}
      .dados{background:#fdf8f5;border:1px solid #e8d5c4;border-radius:7px;padding:10px 12px;white-space:pre-wrap;font-size:.84rem;line-height:1.75;margin:12px 0}
      .footer{margin-top:14px;text-align:center;color:#9c8070;font-size:.72rem;border-top:1px solid #f0e8dc;padding-top:10px}
      a{color:#2563eb}</style></head><body>
      <div class="header"><div><h2>IMTSB · Relatório de Atendimento</h2><p>Instituto Médio Técnico São Benedito</p></div></div>
      <div class="grid">
        <div class="row"><div class="lbl">Senha</div><div class="val">${s.numero}</div></div>
        <div class="row"><div class="lbl">Serviço</div><div class="val">${s.servico?.nome||'–'}</div></div>
        <div class="row"><div class="lbl">Atendente</div><div class="val">${s.atendente?.nome||'–'}</div></div>
        <div class="row"><div class="lbl">Balcão</div><div class="val">${s.numero_balcao?'Balcão '+s.numero_balcao:'–'}</div></div>
        <div class="row"><div class="lbl">Emitida às</div><div class="val">${fmtData(s.emitida_em)}</div></div>
        <div class="row"><div class="lbl">Conclusão</div><div class="val">${fmtData(s.atendimento_concluido_em)}</div></div>
        <div class="row"><div class="lbl">Espera</div><div class="val">${s.tempo_espera_minutos?s.tempo_espera_minutos+' min':'–'}</div></div>
        <div class="row"><div class="lbl">Duração</div><div class="val">${s.tempo_atendimento_minutos?s.tempo_atendimento_minutos+' min':'–'}</div></div>
        ${ficheiroHtml}${notaHtml}
      </div>
      <div class="dados">${linhasForm||'Sem dados de formulário.'}</div>
      <div class="footer">Impresso em ${agora} · Sistema de Gestão de Filas · IMTSB</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    const w = window.open('','_blank','width=680,height=820');
    if (!w) { showToast('Permita popups para imprimir.','error'); return; }
    w.document.write(html); w.document.close();
  };

  window.imprimirRelatorioCompleto = async function() {
    const { de, ate } = _calcularIntervalo(_filtroActivo);
    let url = `/senhas?status=concluida&page=1&per_page=100`;
    if (de)  url += `&data_de=${de}`;
    if (ate) url += `&data_ate=${ate}`;
    let senhas = [];
    try { const r = await api(url); const d = await r.json(); senhas = d.senhas||[]; }
    catch(e) { showToast('Erro ao carregar.','error'); return; }
    const agora = new Date().toLocaleString('pt-PT',{timeZone:'Africa/Luanda'});
    const label = _labelPeriodo();
    const fmtH  = iso => iso
      ? new Date(iso.endsWith('Z')?iso:iso+'Z')
          .toLocaleString('pt-PT',{timeZone:'Africa/Luanda',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})
      : '–';
    const n    = senhas.length;
    const mE   = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_espera_minutos||0),0)/n) : 0;
    const mA   = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_atendimento_minutos||0),0)/n) : 0;
    const nPri = senhas.filter(s=>s.tipo==='prioritaria').length;
    const linhas = senhas.map(s => `<tr>
      <td>${s.numero}${s.tipo==='prioritaria'?' ★':''}</td>
      <td>${s.servico?.nome||'–'}</td>
      <td>${s.atendente?.nome||'–'}</td>
      <td style="font-size:.78rem">${fmtH(s.atendimento_concluido_em||s.emitida_em)}</td>
      <td>${s.tempo_espera_minutos||'–'}</td>
      <td>${s.tempo_atendimento_minutos||'–'}</td>
      <td>${s.avaliacao_nota?'★'.repeat(s.avaliacao_nota):'—'}</td>
    </tr>`).join('');
    const html = `<html><head><meta charset="UTF-8"><title>Relatório IMTSB</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;padding:22px;color:#2a1a0a}
      .header{background:linear-gradient(135deg,#3e2510,#6b4226);color:white;padding:14px 18px;border-radius:9px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px}
      .kpi{background:#fdf8f5;border:1px solid #e8d5c4;border-radius:7px;padding:9px;text-align:center}
      .kpi .n{font-size:1.35rem;font-weight:800;color:#6b4226}.kpi .l{font-size:.67rem;color:#8a7060;text-transform:uppercase;letter-spacing:.05em}
      table{width:100%;border-collapse:collapse;font-size:.81rem}
      th{background:#f3ece6;color:#6b4226;padding:7px 9px;text-align:left;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
      td{padding:6px 9px;border-bottom:1px solid #f0e8dc}tr:nth-child(even) td{background:#fdfaf8}
      .footer{margin-top:14px;text-align:center;color:#9c8070;font-size:.72rem;border-top:1px solid #f0e8dc;padding-top:9px}
      @media print{.header,.kpi{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
      <div class="header"><div><h2 style="font-size:1.1rem;margin-bottom:2px">IMTSB · Relatório de Atendimentos</h2>
      <p style="opacity:.8;font-size:.74rem">Período: ${label}</p></div>
      <div style="opacity:.85;font-size:.76rem;text-align:right">Impresso em<br>${agora}</div></div>
      <div class="kpis">
        <div class="kpi"><div class="n">${n}</div><div class="l">Total</div></div>
        <div class="kpi"><div class="n">${nPri}</div><div class="l">Prioritários</div></div>
        <div class="kpi"><div class="n">${mE} min</div><div class="l">Média Espera</div></div>
        <div class="kpi"><div class="n">${mA} min</div><div class="l">Média Atendimento</div></div>
      </div>
      <table><thead><tr><th>Senha</th><th>Serviço</th><th>Atendente</th><th>Data/Hora</th><th>Espera</th><th>Duração</th><th>★</th></tr></thead>
      <tbody>${linhas||'<tr><td colspan="7" style="text-align:center;padding:14px;color:#9c8070;">Sem registos.</td></tr>'}</tbody></table>
      <div class="footer">Sistema de Gestão de Filas · IMTSB · ${agora}</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    const w = window.open('','_blank','width:860,height:720');
    if (!w) { showToast('Permita popups.','error'); return; }
    w.document.write(html); w.document.close();
  };

  /* ════════════════════════════════════════════════════════════
     POLLING + UTILITÁRIOS
  ════════════════════════════════════════════════════════════ */
  function iniciarPolling() {
    pararPolling();
    pollingInterval = setInterval(async () => {
      await atualizarKPIs(); await atualizarFilas();
    }, 15000);
  }
  function pararPolling() {
    if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
  }

  function configurarBotoes() {
    const btnAdd  = document.getElementById('btnAddWorker');
    if (btnAdd) btnAdd.addEventListener('click', adicionarTrabalhador);
    const btnSair = document.getElementById('btnSairAdmin');
    if (btnSair) btnSair.addEventListener('click', () => {
      if (confirm('Sair?')) { pararPolling(); store.logout(); window.location.href = '/login'; }
    });
  }

  function atualizarHeader() {
    const u = store.getUser();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('adminProfileName', u?.name || 'Administrador');
    set('adminInitials',    getInits(u?.name||'AD'));
  }

  function getInits(n) {
    return (n||'AD').split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2);
  }

  function showToast(message, type) {
    const t    = document.createElement('div');
    const bg   = type==='success'?'#22c55e':type==='error'?'#ef4444':'#d97706';
    t.style.cssText = `position:fixed;bottom:2rem;right:2rem;background:${bg};color:white;
      padding:.85rem 1.5rem;border-radius:12px;font-weight:600;z-index:9999;
      box-shadow:0 8px 24px rgba(0,0,0,.2);`;
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 4000);
  }

  /* Funções globais */
  window.removerTrabalhador = async function(id, nome) {
    if (!confirm(`Desactivar "${nome}"?`)) return;
    try {
      const r = await api(`/atendentes/${id}`, { method:'DELETE' });
      const d = await r.json().catch(()=>({}));
      if (r.ok) { showToast(`"${nome}" desactivado.`,'success'); await carregarTrabalhadores(); }
      else alert(`Erro: ${d.erro||'Não foi possível desactivar.'}`);
    } catch(e) { alert('Erro de ligação.'); }
  };

  window.sair = function() {
    if (confirm('Sair?')) { pararPolling(); store.logout(); window.location.href='/login'; }
  };

})();