/**
 * static/js/dashadm.js — Sprint 2 CORRIGIDO
 * ═══════════════════════════════════════════════════════════════
 * FIXES:
 *   ✅ atualizarTrabalhadores() usa GET /api/atendentes/ (estava a usar GET /api/auth/register)
 *   ✅ adicionarTrabalhador() usa POST /api/atendentes/ (endpoint com validação)
 *   ✅ Payload correcto: { nome, email, senha, tipo, balcao, servico_id }
 *   ✅ Remoção de dados "falsos" em fila em tempo real
 *   ✅ changeChartPeriod() usa 'dia'/'semana'/'mes'
 *   ✅ exportData() com CSV real
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

    const historicoState = { page: 1, perPage: 15, total: 0, totalPages: 1 };

    /* ═══════════════════════════════════════════════════════
       INICIALIZAÇÃO
    ═══════════════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', async () => {
        console.log("✅ Dashboard admin carregado — Sprint 2 FIXED");

        if (!store.isLoggedIn()) { window.location.href = '/login'; return; }

        const user = store.getUser();
        if (user.role !== 'admin') {
            alert("Acesso negado. Apenas administradores.");
            window.location.href = '/';
            return;
        }

        const dateEl = document.getElementById('currentDate');
        if (dateEl) dateEl.textContent = new Date().toLocaleDateString('pt-PT', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        atualizarHeader();
        await carregarDashboard();
        configurarBotoes();
        iniciarPolling();
    });

    /* ═══════════════════════════════════════════════════════
       CARREGAR DASHBOARD
    ═══════════════════════════════════════════════════════ */
    async function carregarDashboard() {
        await Promise.all([
            atualizarKPIs(),
            atualizarFilas(),
            atualizarTrabalhadores(),
            atualizarHistorico(1),
            criarGraficos(),
            atualizarTempoPorServico()
        ]);
    }

    /* ═══════════════════════════════════════════════════════
       KPIs
    ═══════════════════════════════════════════════════════ */
    async function atualizarKPIs() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            if (!response.ok) return;
            const stats = await response.json();

            const kpiAttend = document.getElementById('kpiAttend');
            if (kpiAttend) kpiAttend.textContent = stats.concluidas || 0;

            await atualizarTrendReal();

            const kpiWait = document.getElementById('kpiWait');
            if (kpiWait) kpiWait.textContent = `${stats.tempo_medio_espera || 0}min`;

            const kpiOcc = document.getElementById('kpiOcc');
            if (kpiOcc) {
                const total = (stats.aguardando || 0) + (stats.atendendo || 0);
                const taxa  = total > 0 ? Math.round((stats.atendendo / total) * 100) : 0;
                kpiOcc.textContent = `${taxa}%`;
                const trend = document.getElementById('kpiOccTrend');
                if (trend) trend.textContent = `${taxa}%`;
            }

            const kpiSat = document.getElementById('kpiSat');
            if (kpiSat) {
                const total   = stats.total_emitidas || 0;
                const conclui = stats.concluidas     || 0;
                kpiSat.textContent = total > 0 ? `${Math.round((conclui / total) * 100)}%` : '0%';
            }
        } catch (error) {
            console.error("❌ KPIs:", error);
        }
    }

    async function atualizarTrendReal() {
        const trendEl = document.getElementById('trendAttend');
        if (!trendEl) return;
        try {
            const resp = await fetch('/api/dashboard/admin/trend', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (!resp.ok) { trendEl.textContent = '--'; return; }
            const data = await resp.json();
            const pct  = data.variacao_percentual;
            if (data.tendencia === 'alta') { trendEl.textContent = `+${pct}%`; trendEl.style.color = '#22c55e'; }
            else if (data.tendencia === 'baixa') { trendEl.textContent = `${pct}%`; trendEl.style.color = '#ef4444'; }
            else { trendEl.textContent = '~0%'; trendEl.style.color = '#6b7280'; }
            trendEl.title = `Hoje: ${data.hoje} | Ontem: ${data.ontem}`;
        } catch (_) {
            const el = document.getElementById('trendAttend');
            if (el) el.textContent = '--';
        }
    }

    /* ═══════════════════════════════════════════════════════
       FILAS EM TEMPO REAL (dados reais)
    ═══════════════════════════════════════════════════════ */
    async function atualizarFilas() {
        try {
            const [respServicos, respSenhas] = await Promise.all([
                fetch('/api/servicos'),
                fetch('/api/senhas?status=aguardando&hoje=1&page=1&per_page=200', {
                    headers: { 'Authorization': `Bearer ${store.getToken()}` }
                })
            ]);

            const servicos    = respServicos.ok ? await respServicos.json() : [];
            const dadosSenhas = respSenhas.ok   ? await respSenhas.json()  : {};
            const senhas      = Array.isArray(dadosSenhas) ? dadosSenhas : (dadosSenhas.senhas || []);

            const porServico = {};
            senhas.forEach(s => {
                const sid = s.servico_id || s.servico?.id || 'sem';
                porServico[sid] = (porServico[sid] || 0) + 1;
            });

            const queueList = document.getElementById('queueList');
            if (!queueList) return;

            const lista = Array.isArray(servicos) ? servicos : (servicos.servicos || servicos);

            if (!lista.length) {
                queueList.innerHTML = '<div class="queue-item"><div class="queue-service">A carregar...</div><div class="queue-number">–</div></div>';
                return;
            }

            const totalFilas = Object.values(porServico).reduce((a, b) => a + b, 0);

            if (totalFilas === 0) {
                queueList.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:.9rem;">
                    <div style="font-size:2rem;margin-bottom:.5rem;">✅</div>
                    Nenhuma senha aguardando de momento
                </div>`;
                return;
            }

            queueList.innerHTML = lista.map(s => `
              <div class="queue-item">
                <div>
                  <div class="queue-service">${s.icone || '📋'} ${s.nome}</div>
                  <div class="queue-count">${porServico[s.id] || 0} pessoa(s) aguardando</div>
                </div>
                <div class="queue-number" style="color:${(porServico[s.id]||0)>0?'var(--primary-brown)':'var(--text-muted)'}">
                  ${String(porServico[s.id] || 0).padStart(2,'0')}
                </div>
              </div>
            `).join('');

        } catch (error) {
            console.error('❌ Filas:', error);
        }
    }

    /* ═══════════════════════════════════════════════════════
       GRÁFICOS
    ═══════════════════════════════════════════════════════ */
    async function criarGraficos() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            if (!response.ok) return;
            const stats = await response.json();

            const pieCtx = document.getElementById('pieChart');
            if (pieCtx) {
                if (pieChart) pieChart.destroy();
                pieChart = new Chart(pieCtx, {
                    type: 'doughnut',
                    data: {
                        labels:   ['Aguardando', 'Em Atendimento', 'Concluídas', 'Canceladas'],
                        datasets: [{
                            data: [stats.aguardando||0, stats.atendendo||0, stats.concluidas||0, stats.canceladas||0],
                            backgroundColor: ['#bf9770','#6b4226','#22c55e','#ef4444'],
                            borderWidth: 0,
                            hoverOffset: 8
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false, cutout: '68%',
                        plugins: { legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 }, usePointStyle: true } } }
                    }
                });
            }

            await atualizarLineChart(periodoActivo);

        } catch (error) {
            console.error("❌ Gráficos:", error);
        }
    }

    /* Período: o HTML passa 'dia'/'semana'/'mes' directamente */
    window.changeChartPeriod = async function (periodo) {
        periodoActivo = periodo;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (event && event.target) event.target.classList.add('active');
        await atualizarLineChart(periodo);
    };

    async function atualizarLineChart(periodo) {
        const lineCtx = document.getElementById('lineChart');
        if (!lineCtx) return;
        try {
            const resp = await fetch(`/api/dashboard/admin/fluxo?periodo=${periodo}`, {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (!resp.ok) return;
            const data = await resp.json();

            if (lineChart) lineChart.destroy();
            lineChart = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: 'Atendimentos concluídos',
                        data:  data.dados,
                        borderColor:     '#6b4226',
                        backgroundColor: 'rgba(107,66,38,0.08)',
                        borderWidth: 2.5,
                        pointRadius: 4,
                        pointBackgroundColor: '#6b4226',
                        fill: true, tension: 0.35
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
                        x: { ticks: { maxTicksLimit: 12, autoSkip: true } }
                    }
                }
            });
        } catch (error) {
            console.error("❌ LineChart:", error);
        }
    }

    async function atualizarTempoPorServico() {
        const barCtx = document.getElementById('barChart');
        if (!barCtx) return;
        try {
            const resp = await fetch('/api/dashboard/admin/tempo-por-servico', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (!resp.ok) return;
            const data     = await resp.json();
            const servicos = data.servicos || [];
            if (!servicos.length) return;

            const labels       = servicos.map(s => s.nome.length > 14 ? s.nome.substring(0, 14) + '…' : s.nome);
            const temposMedios = servicos.map(s => s.tempo_medio);
            const totais       = servicos.map(s => s.total_hoje);

            if (barChart) barChart.destroy();
            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        { label: 'Tempo médio (min)', data: temposMedios, backgroundColor: '#6b4226', borderRadius: 6, yAxisID: 'y' },
                        { label: 'Total atendidos',   data: totais,       backgroundColor: 'rgba(107,66,38,0.25)', borderRadius: 6, yAxisID: 'y1' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } } },
                    scales: {
                        y:  { beginAtZero: true, position: 'left',  title: { display: true, text: 'min' }, ticks: { stepSize: 1 } },
                        y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'qtd' }, ticks: { precision: 0 } }
                    }
                }
            });
        } catch (error) {
            console.error("❌ BarChart:", error);
        }
    }

    /* ═══════════════════════════════════════════════════════
       TRABALHADORES — CRUD CORRIGIDO
       FIX: usa GET/POST /api/atendentes/ em vez de /api/auth/register
    ═══════════════════════════════════════════════════════ */
    async function atualizarTrabalhadores() {
        const perfBody    = document.getElementById('performanceBody');
        const workersBody = document.getElementById('workersBody');
        const loadingHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1rem;">A carregar...</td></tr>';

        if (perfBody)    perfBody.innerHTML    = loadingHTML;
        if (workersBody) workersBody.innerHTML = loadingHTML;

        try {
            // ✅ FIX: endpoint correcto
            const response = await fetch('/api/atendentes/', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });

            if (response.status === 401 || response.status === 403) {
                const msg = '<tr><td colspan="5" style="color:#ef4444;text-align:center;padding:1rem;">Sem permissão para listar trabalhadores</td></tr>';
                if (perfBody)    perfBody.innerHTML    = msg;
                if (workersBody) workersBody.innerHTML = msg;
                return;
            }

            if (!response.ok) {
                const msg = '<tr><td colspan="5" style="color:#ef4444;text-align:center;padding:1rem;">Erro ao carregar membros</td></tr>';
                if (perfBody)    perfBody.innerHTML    = msg;
                if (workersBody) workersBody.innerHTML = msg;
                return;
            }

            const membros = await response.json();
            const lista   = Array.isArray(membros) ? membros : [];

            if (!lista.length) {
                const msg = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:1.5rem;">Nenhum membro registado</td></tr>';
                if (perfBody)    perfBody.innerHTML    = msg;
                if (workersBody) workersBody.innerHTML = msg;
                return;
            }

            /* Tabela de desempenho */
            if (perfBody) {
                perfBody.innerHTML = lista.map(t => {
                    const atend = t.atendimentos_hoje || 0;
                    const tempo = t.tempo_medio       || 0;
                    const tipoLabel = t.tipo === 'admin' ? '👑 Admin' : '👤 Atendente';
                    const badge = atend >= 10 ? ['Excelente','badge-excellent'] : atend >= 5 ? ['Bom','badge-good'] : ['Activo','badge-good'];
                    const statusDot = t.ativo
                        ? '<span style="color:#22c55e;margin-right:4px;">●</span>'
                        : '<span style="color:#9ca3af;margin-right:4px;">●</span>';

                    return `<tr style="${!t.ativo ? 'opacity:.5;' : ''}">
                      <td>
                        <div class="employee-info">
                          <div class="employee-avatar">${getInitials(t.nome)}</div>
                          <div>
                            <div class="employee-name">${statusDot}${t.nome}</div>
                            <div class="employee-role">${tipoLabel} · ${t.departamento || 'Geral'}${t.balcao ? ` · Balcão ${t.balcao}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td><strong>${atend}</strong></td>
                      <td>${tempo} min</td>
                      <td>${t.ativo ? '<span style="color:#22c55e">Activo</span>' : '<span style="color:#9ca3af">Inactivo</span>'}</td>
                      <td><span class="performance-badge ${badge[1]}">${badge[0]}</span></td>
                    </tr>`;
                }).join('');
            }

            /* Lista de gestão */
            if (workersBody) {
                workersBody.innerHTML = lista.map(t => `
                  <tr style="${!t.ativo ? 'opacity:.5;' : ''}">
                    <td>
                      <div style="display:flex;align-items:center;gap:.5rem;">
                        <div class="employee-avatar" style="width:32px;height:32px;font-size:.75rem;">${getInitials(t.nome)}</div>
                        <span>${t.nome} ${t.tipo === 'admin' ? '👑' : ''}</span>
                      </div>
                    </td>
                    <td style="font-size:.85rem;color:var(--text-muted);">${t.email}</td>
                    <td style="font-size:.85rem;">${t.departamento || '–'}${t.balcao ? ` · Balcão ${t.balcao}` : ''}</td>
                    <td>
                      ${t.ativo
                        ? `<button class="remove-worker-btn" onclick="removerTrabalhador(${t.id}, '${t.nome.replace(/'/g, "\\'")}')">Desactivar</button>`
                        : `<span style="color:#9ca3af;font-size:.8rem;">Inactivo</span>`}
                    </td>
                  </tr>
                `).join('');
            }

        } catch (error) {
            console.error("❌ Trabalhadores:", error);
            const msg = '<tr><td colspan="5" style="color:#ef4444;text-align:center;padding:1rem;">Erro de ligação</td></tr>';
            if (perfBody)    perfBody.innerHTML    = msg;
            if (workersBody) workersBody.innerHTML = msg;
        }
    }

    /* ═══════════════════════════════════════════════════════
       ADICIONAR MEMBRO — CORRIGIDO
       FIX: usa POST /api/atendentes/ com payload correcto
    ═══════════════════════════════════════════════════════ */
    async function adicionarTrabalhador() {
        const nome  = (document.getElementById('newWorkerName')?.value  || '').trim();
        const email = (document.getElementById('newWorkerEmail')?.value || '').trim();
        const senha = (document.getElementById('newWorkerPass')?.value  || '').trim();
        const role  = (document.getElementById('newWorkerRole')?.value  || 'atendente');
        const dept  = (document.getElementById('newWorkerDept')?.value  || '');
        const msgEl = document.getElementById('workerFormMsg');
 
        function setMsg(text, ok) {
            if (!msgEl) return;
            msgEl.textContent      = text;
            msgEl.style.color      = ok ? '#22c55e' : '#ef4444';
            msgEl.style.fontWeight = '600';
        }
 
        // — Validações básicas ──────────────────────────────────
        if (!nome || !email || !senha) {
            setMsg('Nome, email e senha são obrigatórios.', false);
            return;
        }
        if (senha.length < 6) {
            setMsg('A senha deve ter pelo menos 6 caracteres.', false);
            return;
        }
 
        /* ── Mapeamento departamento → servico_id ───────────────
           O balcão NÃO é enviado — o backend calcula o próximo
           disponível automaticamente (Sprint 3).
           O servico_id continua a ser mapeado por nome. ─────── */
        const mapaServico = {
            'Secretaria Academica': 1,
            'Contabilidade':        2,
            'Direccao Pedagogica':  3,
            'Biblioteca':           4,
            'Apoio ao Cliente':     5
        };
 
        // Admins: sem balcão, sem serviço
        const servicoId = role === 'admin' ? null : (mapaServico[dept] || null);
 
        const btnAdd = document.getElementById('btnAddWorker');
        if (btnAdd) { btnAdd.disabled = true; btnAdd.textContent = 'A criar...'; }
 
        try {
            /* ✅ Sprint 3: balcao NÃO é enviado.
               O backend (atendente_controller.py) atribui automaticamente
               o próximo número de balcão livre. */
            const response = await fetch('/api/atendentes/', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${store.getToken()}`
                },
                body: JSON.stringify({
                    nome,
                    email,
                    senha,
                    tipo:       role,
                    servico_id: servicoId
                    /* balcao: omitido → auto-atribuído no backend */
                })
            });
 
            const data = await response.json().catch(() => ({}));
 
            if (response.ok) {
                // Mostrar balcão atribuído automaticamente pelo backend
                const balcaoAtribuido = data.atendente?.balcao;
                const infoBalcao      = balcaoAtribuido ? ` (Balcão ${balcaoAtribuido})` : '';
                const tipoLabel       = role === 'admin' ? 'Administrador' : 'Trabalhador';
 
                setMsg(`✅ ${tipoLabel} "${nome}" criado com sucesso!${infoBalcao}`, true);
 
                // Limpar campos do formulário
                ['newWorkerName', 'newWorkerEmail', 'newWorkerPass'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });
 
                await atualizarTrabalhadores();
                setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 6000);
 
            } else {
                setMsg(data.erro || 'Erro ao criar membro. Verifique os dados.', false);
            }
 
        } catch (error) {
            console.error('❌ Adicionar trabalhador:', error);
            setMsg('Erro de ligação ao servidor.', false);
        } finally {
            if (btnAdd) { btnAdd.disabled = false; btnAdd.textContent = 'Adicionar membro'; }
        }
    }
 

    /* ═══════════════════════════════════════════════════════
       HISTÓRICO COM PAGINAÇÃO E FILTROS DE PERÍODO
    ═══════════════════════════════════════════════════════ */

    let _filtroActivo = 'hoje'; // hoje | semana | mes | todos | intervalo

    /* Actualiza os botões de filtro visualmente */
    function _realcarFiltro(nome) {
        ['filtroHoje','filtroSemana','filtroMes','filtroTodos'].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const activo = id === 'filtro' + nome.charAt(0).toUpperCase() + nome.slice(1);
            btn.style.background = activo ? '#6b4226' : 'white';
            btn.style.color      = activo ? 'white'   : '#6b4226';
        });
    }

    /* Calcula data_de e data_ate com base no período */
    function _calcularIntervalo(periodo) {
        const hoje  = new Date();
        const pad   = n => String(n).padStart(2, '0');
        const fmt   = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const hojeStr = fmt(hoje);

        if (periodo === 'hoje')    return { de: hojeStr, ate: hojeStr };
        if (periodo === 'semana') {
            const seg = new Date(hoje); seg.setDate(hoje.getDate() - hoje.getDay() + 1);
            return { de: fmt(seg), ate: hojeStr };
        }
        if (periodo === 'mes') {
            const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            return { de: fmt(ini), ate: hojeStr };
        }
        if (periodo === 'intervalo') {
            const de  = document.getElementById('filtroDataDe')?.value  || '';
            const ate = document.getElementById('filtroDataAte')?.value || hojeStr;
            return { de, ate };
        }
        return { de: '', ate: '' }; // 'todos' — sem filtro de data
    }

    window.filtrarHistorico = function (periodo) {
        _filtroActivo = periodo;
        _realcarFiltro(periodo);
        historicoState.page = 1;
        atualizarHistorico(1);
    };

    async function atualizarHistorico(page) {
        try {
            const pg  = page || historicoState.page;
            const pp  = historicoState.perPage;
            const { de, ate } = _calcularIntervalo(_filtroActivo);

            let url = `/api/senhas?status=concluida&page=${pg}&per_page=${pp}`;
            if (de)  url += `&data_de=${de}`;
            if (ate) url += `&data_ate=${ate}`;

            const response = await fetch(url,
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );
            if (!response.ok) return;

            const data = await response.json();
            historicoState.page       = data.page        || pg;
            historicoState.total      = data.total        || 0;
            historicoState.totalPages = data.total_pages  || 1;

            const historyBody = document.getElementById('historyBody');
            if (!historyBody) return;

            const senhas = data.senhas || [];
            if (!senhas.length && pg === 1) {
                historyBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem;">Sem atendimentos no período seleccionado</td></tr>';
                renderNavegacao();
                return;
            }

            historyBody.innerHTML = senhas.map(s => {
                const servico    = s.servico?.nome   || 'Serviço';
                const atendente  = s.atendente?.nome || '–';
                const duracao    = s.tempo_atendimento_minutos || 0;
                const espera     = s.tempo_espera_minutos      || 0;
                const tsStr      = s.atendimento_concluido_em  || s.emitida_em || s.created_at;
                const dataHora   = tsStr
                    ? new Date(tsStr.endsWith('Z') ? tsStr : tsStr + 'Z')
                        .toLocaleString('pt-PT', {
                            day:'2-digit', month:'2-digit', year:'numeric',
                            hour:'2-digit', minute:'2-digit', timeZone:'Africa/Luanda'
                        })
                    : '--';
                const tipoBadge  = s.tipo === 'prioritaria'
                    ? '<span style="background:rgba(245,158,11,.15);color:#92400e;padding:2px 8px;border-radius:20px;font-size:.75rem;font-weight:700;">★ Prior.</span>'
                    : '<span style="background:rgba(107,66,38,.1);color:#6b4226;padding:2px 8px;border-radius:20px;font-size:.75rem;">Normal</span>';

                return `<tr>
                  <td><strong>${s.numero}</strong> ${tipoBadge}</td>
                  <td>${servico}</td>
                  <td>${atendente}</td>
                  <td style="font-size:.8rem;">${dataHora}</td>
                  <td>${espera ? espera + 'min' : '–'}</td>
                  <td>${duracao}min</td>
                  <td style="display:flex;gap:.4rem;align-items:center;">
                    <span class="performance-badge badge-excellent">✓ Concluído</span>
                    <button onclick="verDetalhesSenha(${s.id},'${s.numero}','${servico}')" style="
                      background:#f0e8dc;border:none;border-radius:8px;
                      padding:.25rem .6rem;font-size:.78rem;font-weight:700;
                      color:#6b4226;cursor:pointer;" title="Ver dados do pedido">
                      👁 Ver
                    </button>
                  </td>
                </tr>`;
            }).join('');

            renderNavegacao();
        } catch (error) {
            console.error("❌ Histórico:", error);
        }
    }

    function renderNavegacao() {
        const btnAnterior = document.getElementById('historyPrevBtn');
        const btnProxima  = document.getElementById('historyNextBtn');
        const pageInfo    = document.getElementById('historyPageInfo');
        const { page, totalPages, total } = historicoState;
        if (btnAnterior) { btnAnterior.disabled = (page <= 1);           btnAnterior.onclick = () => atualizarHistorico(page - 1); }
        if (btnProxima)  { btnProxima.disabled  = (page >= totalPages);  btnProxima.onclick  = () => atualizarHistorico(page + 1); }
        if (pageInfo)    pageInfo.textContent = `Página ${page} de ${totalPages} · ${total} registos`;
    }

    /* ═══════════════════════════════════════════════════════
       EXPORTAR
    ═══════════════════════════════════════════════════════ */
    /* ── Helper: carregar senhas com filtro de período ────── */
    async function _carregarSenhasParaExport(apenasConcluidas = true) {
        const { de, ate } = _calcularIntervalo(_filtroActivo);
        let url = `/api/senhas?page=1&per_page=500`;
        if (apenasConcluidas) url += `&status=concluida`;
        if (de)  url += `&data_de=${de}`;
        if (ate) url += `&data_ate=${ate}`;
        const r = await fetch(url, { headers:{ Authorization:`Bearer ${store.getToken()}` } });
        if (!r.ok) throw new Error('Erro ao carregar dados');
        const d = await r.json();
        return d.senhas || [];
    }

    /* ── Helper: label do período activo ──────────────────── */
    function _labelPeriodo() {
        const { de, ate } = _calcularIntervalo(_filtroActivo);
        return { hoje:'Hoje', semana:'Esta Semana', mes:'Este Mês',
            todos:'Todos os Registos',
            intervalo: de && ate ? `${de} a ${ate}` : de || ate || 'Intervalo'
        }[_filtroActivo] || '';
    }

    /* ── Helper: formatar timestamp para PT ───────────────── */
    function _fmtTs(iso) {
        if (!iso) return '–';
        return new Date(iso.endsWith('Z') ? iso : iso + 'Z')
            .toLocaleString('pt-PT', { timeZone:'Africa/Luanda',
                day:'2-digit', month:'2-digit', year:'numeric',
                hour:'2-digit', minute:'2-digit' });
    }

    /* ═══════════════════════════════════════════════════════
       EXPORTAR DO CABEÇALHO (usa filtro hoje + dados completos)
    ═══════════════════════════════════════════════════════ */
    window.exportData = async function () {
        const formato = document.getElementById('exportFormat')?.value || 'excel';
        try {
            /* Cabeçalho exporta sempre "hoje" com todos os dados do dia */
            const response = await fetch(
                '/api/senhas?status=concluida&hoje=1&page=1&per_page=500',
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );
            if (!response.ok) { showToast('Não foi possível carregar dados.', 'error'); return; }
            const data     = await response.json();
            const senhas   = data.senhas || [];
            if (!senhas.length) { showToast('Sem dados para exportar hoje.', 'warn'); return; }

            const agora  = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });
            const hoje   = new Date().toLocaleDateString('pt-PT', { timeZone:'Africa/Luanda' });
            const n      = senhas.length;
            const mE     = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_espera_minutos||0),0)/n) : 0;
            const mA     = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_atendimento_minutos||0),0)/n) : 0;
            const nPri   = senhas.filter(s=>s.tipo==='prioritaria').length;

            if (formato === 'excel' && window.XLSX) {
                /* Folha 1: Resumo do Dia */
                const resumo = [
                    ['IMTSB — Relatório Diário', ''],
                    ['Data', hoje],
                    ['Gerado em', agora],
                    [''],
                    ['Total de Atendimentos', n],
                    ['Prioritários', nPri],
                    ['Normais', n - nPri],
                    ['Tempo Médio de Espera (min)', mE],
                    ['Duração Média de Atendimento (min)', mA],
                ];
                /* Folha 2: Detalhe */
                const detalhe = senhas.map(s => ({
                    'Senha':              s.numero,
                    'Tipo':               s.tipo === 'prioritaria' ? 'Prioritária' : 'Normal',
                    'Serviço':            s.servico?.nome  || '–',
                    'Atendente':          s.atendente?.nome || '–',
                    'Balcão':             s.numero_balcao  || '–',
                    'Emitida em':         _fmtTs(s.emitida_em),
                    'Chamada em':         _fmtTs(s.chamada_em),
                    'Início Atendimento': _fmtTs(s.atendimento_iniciado_em),
                    'Conclusão':          _fmtTs(s.atendimento_concluido_em),
                    'Espera (min)':       s.tempo_espera_minutos      || 0,
                    'Duração (min)':      s.tempo_atendimento_minutos || 0,
                    'Contacto Utente':    s.usuario_contato || '–',
                }));

                const wb  = XLSX.utils.book_new();
                const ws1 = XLSX.utils.aoa_to_sheet(resumo);
                const ws2 = XLSX.utils.json_to_sheet(detalhe);
                ws1['!cols'] = [{wch:38},{wch:22}];
                ws2['!cols'] = [{wch:8},{wch:12},{wch:22},{wch:20},{wch:8},
                                {wch:18},{wch:18},{wch:18},{wch:18},{wch:12},{wch:12},{wch:22}];
                XLSX.utils.book_append_sheet(wb, ws1, 'Resumo do Dia');
                XLSX.utils.book_append_sheet(wb, ws2, 'Detalhe');
                XLSX.writeFile(wb, `imtsb_relatorio_${new Date().toISOString().slice(0,10)}.xlsx`);
                return;
            }

            /* PDF do dia completo */
            _gerarPdfRelatorio(senhas, 'Hoje — ' + hoje, agora, { n, nPri, mE, mA });

        } catch (error) {
            console.error('❌ Exportar:', error);
            showToast('Erro ao exportar.', 'error');
        }
    };

    /* ═══════════════════════════════════════════════════════
       EXPORTAR DO HISTÓRICO (respeita _filtroActivo)
    ═══════════════════════════════════════════════════════ */
    window.exportarHistorico = async function (formato) {
        try {
            showToast('A preparar exportação...', '');
            const senhas = await _carregarSenhasParaExport(true);
            if (!senhas.length) { showToast('Sem dados no período seleccionado.', 'warn'); return; }

            const agora  = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });
            const label  = _labelPeriodo();
            const n      = senhas.length;
            const mE     = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_espera_minutos||0),0)/n) : 0;
            const mA     = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_atendimento_minutos||0),0)/n) : 0;
            const nPri   = senhas.filter(s=>s.tipo==='prioritaria').length;

            if (formato === 'excel' && window.XLSX) {
                /* Folha 1: Resumo */
                const resumo = [
                    ['IMTSB — Relatório de Atendimentos', ''],
                    ['Período', label],
                    ['Gerado em', agora],
                    [''],
                    ['Total de Atendimentos', n],
                    ['Prioritários', nPri],
                    ['Normais', n - nPri],
                    ['Tempo Médio de Espera (min)', mE],
                    ['Duração Média de Atendimento (min)', mA],
                ];
                /* Folha 2: Detalhe completo */
                const detalhe = senhas.map(s => ({
                    'Senha':              s.numero,
                    'Tipo':               s.tipo === 'prioritaria' ? 'Prioritária' : 'Normal',
                    'Serviço':            s.servico?.nome   || '–',
                    'Atendente':          s.atendente?.nome || '–',
                    'Balcão':             s.numero_balcao   || '–',
                    'Emitida em':         _fmtTs(s.emitida_em),
                    'Chamada em':         _fmtTs(s.chamada_em),
                    'Início Atendimento': _fmtTs(s.atendimento_iniciado_em),
                    'Conclusão':          _fmtTs(s.atendimento_concluido_em),
                    'Espera (min)':       s.tempo_espera_minutos      || 0,
                    'Duração (min)':      s.tempo_atendimento_minutos || 0,
                    'Contacto Utente':    s.usuario_contato || '–',
                    'Dados do Pedido':    (s.observacoes || '')
                                            .split(' | ')
                                            .filter(p => !p.startsWith('FICHEIRO:'))
                                            .join(' | '),
                }));

                const wb  = XLSX.utils.book_new();
                const ws1 = XLSX.utils.aoa_to_sheet(resumo);
                const ws2 = XLSX.utils.json_to_sheet(detalhe);
                ws1['!cols'] = [{wch:40},{wch:24}];
                ws2['!cols'] = [{wch:8},{wch:12},{wch:22},{wch:20},{wch:8},
                                {wch:18},{wch:18},{wch:18},{wch:18},{wch:12},
                                {wch:12},{wch:22},{wch:50}];
                XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
                XLSX.utils.book_append_sheet(wb, ws2, 'Atendimentos');

                const slug = label.replace(/\s+/g,'_').replace(/\//g,'-').toLowerCase();
                XLSX.writeFile(wb, `imtsb_historico_${slug}.xlsx`);
                showToast('Excel exportado com sucesso!', 'success');
                return;
            }

            /* PDF */
            _gerarPdfRelatorio(senhas, label, agora, { n, nPri, mE, mA });

        } catch (err) {
            console.error('❌ exportarHistorico:', err);
            showToast('Erro ao exportar.', 'error');
        }
    };

    /* ── Motor de geração de PDF (partilhado pelos dois) ──── */
    function _gerarPdfRelatorio(senhas, label, agora, kpis) {
        if (!window.jspdf) { showToast('Biblioteca PDF não carregada.', 'error'); return; }

        const { jsPDF }  = window.jspdf;
        const doc        = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
        const { n, nPri, mE, mA } = kpis;

        /* Cabeçalho */
        doc.setFillColor(62, 37, 16);
        doc.roundedRect(10, 8, 277, 20, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13); doc.setFont('helvetica','bold');
        doc.text('IMTSB · Relatório de Atendimentos', 15, 17);
        doc.setFontSize(8); doc.setFont('helvetica','normal');
        doc.text(`Período: ${label}`, 15, 23);
        doc.text(`Gerado em: ${agora}`, 200, 23);

        /* KPIs */
        const kpiData = [
            ['Total', String(n)],
            ['Prioritários', String(nPri)],
            ['Média Espera', `${mE} min`],
            ['Média Atend.', `${mA} min`],
        ];
        kpiData.forEach((kpi, i) => {
            const x = 10 + i * 70;
            doc.setFillColor(253, 248, 245);
            doc.roundedRect(x, 32, 66, 16, 2, 2, 'F');
            doc.setTextColor(107, 66, 38);
            doc.setFontSize(16); doc.setFont('helvetica','bold');
            doc.text(kpi[1], x + 33, 42, { align:'center' });
            doc.setFontSize(7); doc.setFont('helvetica','normal');
            doc.setTextColor(140, 103, 70);
            doc.text(kpi[0].toUpperCase(), x + 33, 46, { align:'center' });
        });

        /* Tabela */
        const head = [['Senha','Tipo','Serviço','Atendente','Balcão',
                        'Emitida em','Conclusão','Espera','Duração']];
        const body = senhas.map(s => [
            s.numero,
            s.tipo === 'prioritaria' ? '★ Prior.' : 'Normal',
            s.servico?.nome   || '–',
            s.atendente?.nome || '–',
            s.numero_balcao ? 'B' + s.numero_balcao : '–',
            _fmtTs(s.emitida_em),
            _fmtTs(s.atendimento_concluido_em),
            s.tempo_espera_minutos      ? s.tempo_espera_minutos + ' min' : '–',
            s.tempo_atendimento_minutos ? s.tempo_atendimento_minutos + ' min' : '–',
        ]);

        doc.autoTable({
            head, body,
            startY: 52,
            margin: { left: 10, right: 10 },
            styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
            headStyles: { fillColor: [107, 66, 38], textColor: 255, fontStyle:'bold' },
            alternateRowStyles: { fillColor: [253, 248, 245] },
            columnStyles: {
                0: { cellWidth: 18 }, 1: { cellWidth: 20 }, 2: { cellWidth: 40 },
                3: { cellWidth: 35 }, 4: { cellWidth: 14 }, 5: { cellWidth: 32 },
                6: { cellWidth: 32 }, 7: { cellWidth: 18 }, 8: { cellWidth: 18 },
            },
            didDrawPage: (d) => {
                doc.setFontSize(7); doc.setTextColor(160,130,110);
                doc.text(`Sistema de Gestão de Filas · IMTSB · Pág. ${d.pageNumber}`,
                    148.5, doc.internal.pageSize.height - 5, { align:'center' });
            }
        });

        const slug = label.replace(/\s+/g,'_').replace(/\//g,'-').toLowerCase();
        doc.save(`imtsb_relatorio_${slug}.pdf`);
        showToast('PDF exportado com sucesso!', 'success');
    };

    /* ═══════════════════════════════════════════════════════
       POLLING
    ═══════════════════════════════════════════════════════ */
    function iniciarPolling() {
        pararPolling();
        pollingInterval = setInterval(async () => {
            await atualizarKPIs();
            await atualizarFilas();
        }, 15000);
    }

    function pararPolling() {
        if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; }
    }

    /* ═══════════════════════════════════════════════════════
       CONFIGURAR BOTÕES
    ═══════════════════════════════════════════════════════ */
    function configurarBotoes() {
        const btnAdd = document.getElementById('btnAddWorker');
        if (btnAdd) btnAdd.addEventListener('click', adicionarTrabalhador);

        const btnSair = document.getElementById('btnSairAdmin');
        if (btnSair) btnSair.addEventListener('click', () => {
            if (confirm("Deseja sair do sistema?")) { pararPolling(); store.logout(); window.location.href = '/login'; }
        });

        const btnReset = document.getElementById('btnResetDayAdmin');
        if (btnReset) btnReset.addEventListener('click', () => {
            alert("Funcionalidade de reset de dia em desenvolvimento.");
        });
    }

    /* ═══════════════════════════════════════════════════════
       FUNÇÕES GLOBAIS
    ═══════════════════════════════════════════════════════ */
    window.removerTrabalhador = async function (id, nome) {
        if (!confirm(`Desactivar "${nome}"?\nO histórico de atendimentos será preservado.`)) return;
        try {
            const response = await fetch(`/api/atendentes/${id}`, {
                method:  'DELETE',
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                showToast(`✅ "${nome}" desactivado com sucesso.`, 'success');
                await atualizarTrabalhadores();
            } else {
                alert(`Erro: ${data.erro || 'Não foi possível desactivar.'}`);
            }
        } catch (error) {
            console.error("❌ Remover:", error);
            alert("Erro de ligação ao servidor.");
        }
    };

    window.sair = function () {
        if (confirm("Deseja sair do sistema?")) { pararPolling(); store.logout(); window.location.href = '/login'; }
    };

    /* ═══════════════════════════════════════════════════════
       MODAL DETALHES DO PEDIDO (Histórico Admin)
    ═══════════════════════════════════════════════════════ */

    /* Estado do modal para impressão */
    let _dadosModalAdmin = null;

    window.verDetalhesSenha = async function (id, numero, servico) {
        const modal = document.getElementById('modalDetalhesAdmin');
        if (!modal) return;

        /* Abrir modal com estado de carregamento */
        document.getElementById('mda-titulo').textContent  = `Senha ${numero} · ${servico}`;
        document.getElementById('mda-form').textContent    = 'A carregar...';
        document.getElementById('mda-servico').textContent = servico;
        document.getElementById('mda-atendente').textContent = '–';
        document.getElementById('mda-hora').textContent    = '–';
        document.getElementById('mda-duracao').textContent = '–';
        document.getElementById('mda-fich-bloco').style.display = 'none';
        document.getElementById('mda-sem-fich').style.display   = 'block';
        modal.style.display = 'flex';

        try {
            const resp = await fetch(`/api/senhas/${id}`, {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (!resp.ok) {
                document.getElementById('mda-form').textContent = 'Erro ao carregar dados.';
                return;
            }
            const s = await resp.json();
            _dadosModalAdmin = s;

            /* — Meta ──────────────────────────────────────────── */
            const horaStr = s.emitida_em
                ? new Date(s.emitida_em.endsWith('Z') ? s.emitida_em : s.emitida_em + 'Z')
                    .toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', timeZone:'Africa/Luanda' })
                : '–';

            document.getElementById('mda-atendente').textContent =
                s.atendente?.nome || '–';
            document.getElementById('mda-hora').textContent     = horaStr;
            document.getElementById('mda-duracao').textContent  =
                s.tempo_atendimento_minutos ? `${s.tempo_atendimento_minutos} min` : '–';

            /* — Dados do formulário ────────────────────────────── */
            const obs    = s.observacoes || '';
            const partes = obs.split(' | ').map(p => p.trim()).filter(Boolean);
            const nomeFich   = partes.find(p => p.startsWith('FICHEIRO:'))
                                     ?.replace('FICHEIRO:', '').trim() || null;
            const linhasForm = partes
                .filter(p => !p.startsWith('FICHEIRO:'))
                .join('\n');

            document.getElementById('mda-form').textContent =
                linhasForm || 'Sem dados de formulário registados.';

            /* — Documento ─────────────────────────────────────── */
            if (nomeFich) {
                const nomeDisplay = nomeFich.split('_').slice(2).join('_') || nomeFich;
                const url = `/api/senhas/${id}/ficheiro`;
                document.getElementById('mda-fich-nome').textContent = `📎 ${nomeDisplay}`;
                document.getElementById('mda-btn-dl').href  = url;
                /* Visualizar: window.open para evitar bloqueio de popups em <a> */
                document.getElementById('mda-btn-vis').onclick = () =>
                    window.open(url, '_blank', 'noopener,noreferrer');
                document.getElementById('mda-fich-bloco').style.display = 'block';
                document.getElementById('mda-sem-fich').style.display   = 'none';
            } else {
                document.getElementById('mda-fich-bloco').style.display = 'none';
                document.getElementById('mda-sem-fich').style.display   = 'block';
            }

        } catch (err) {
            console.error('❌ verDetalhesSenha:', err);
            document.getElementById('mda-form').textContent = 'Erro de ligação.';
        }
    };

    window.fecharModalAdmin = function () {
        const modal = document.getElementById('modalDetalhesAdmin');
        if (modal) modal.style.display = 'none';
        _dadosModalAdmin = null;
    };

    /* Fechar ao clicar fora */
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('modalDetalhesAdmin');
        if (modal && e.target === modal) { window.fecharModalAdmin(); }
    });

    window.imprimirDetalheAdmin = function () {
        const s = _dadosModalAdmin;
        if (!s) return;

        const obs        = s.observacoes || '';
        const partes     = obs.split(' | ').map(p => p.trim()).filter(Boolean);
        const nomeFich   = partes.find(p => p.startsWith('FICHEIRO:'))
                                 ?.replace('FICHEIRO:', '').trim() || null;
        const linhasForm = partes.filter(p => !p.startsWith('FICHEIRO:')).join('\n');
        const agora      = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });

        const fmtData = iso => iso
            ? new Date(iso.endsWith('Z') ? iso : iso + 'Z')
                .toLocaleString('pt-PT', { timeZone:'Africa/Luanda',
                    day:'2-digit', month:'2-digit', year:'numeric',
                    hour:'2-digit', minute:'2-digit' })
            : '–';

        const ficheiroHtml = nomeFich
            ? `<div class="row full"><div class="lbl">Documento Anexado</div>
               <div class="val"><a href="/api/senhas/${s.id}/ficheiro" target="_blank">
               ${nomeFich.split('_').slice(2).join('_') || nomeFich}</a></div></div>`
            : '';

        const html = `<html><head><meta charset="UTF-8"><title>Pedido ${s.numero}</title>
          <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;padding:28px;color:#2a1a0a;max-width:600px;margin:0 auto}
            .header{background:linear-gradient(135deg,#3e2510,#6b4226);color:white;
              padding:16px 20px;border-radius:10px;margin-bottom:16px;
              display:flex;justify-content:space-between;align-items:flex-start}
            .header h2{font-size:1.15rem;margin-bottom:3px}
            .header p{opacity:.8;font-size:.76rem}
            .badge{background:rgba(255,255,255,.25);padding:3px 10px;border-radius:20px;
              font-size:.76rem;font-weight:700}
            .sec{font-size:.68rem;font-weight:700;color:#8a7060;text-transform:uppercase;
              letter-spacing:.07em;margin:12px 0 6px}
            .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
            .row{background:#fdf8f5;border-radius:7px;padding:8px 10px}
            .row.full{grid-column:span 2}
            .lbl{font-size:.67rem;color:#8a7060;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px}
            .val{font-weight:700;font-size:.87rem;color:#3e2510}
            .dados{background:#fdf8f5;border:1px solid #e8d5c4;border-radius:7px;
              padding:10px 12px;white-space:pre-wrap;font-size:.84rem;line-height:1.75}
            .footer{margin-top:14px;text-align:center;color:#9c8070;font-size:.72rem;
              border-top:1px solid #f0e8dc;padding-top:10px}
            a{color:#2563eb}
            @media print{.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
          </style></head><body>
          <div class="header">
            <div><h2>IMTSB · Relatório de Atendimento</h2>
              <p>Instituto Médio Técnico São Benedito · Luanda, Angola</p></div>
            <span class="badge">${s.tipo==='prioritaria'?'★ Prioritária':'Normal'}</span>
          </div>
          <div class="sec">Identificação</div>
          <div class="grid">
            <div class="row"><div class="lbl">Número de Senha</div><div class="val">${s.numero}</div></div>
            <div class="row"><div class="lbl">Serviço</div><div class="val">${s.servico?.nome||'–'}</div></div>
            <div class="row"><div class="lbl">Atendente</div><div class="val">${s.atendente?.nome||'–'}</div></div>
            <div class="row"><div class="lbl">Balcão</div><div class="val">${s.numero_balcao?'Balcão '+s.numero_balcao:'–'}</div></div>
          </div>
          <div class="sec">Tempos</div>
          <div class="grid">
            <div class="row"><div class="lbl">Emitida às</div><div class="val">${fmtData(s.emitida_em)}</div></div>
            <div class="row"><div class="lbl">Chamada às</div><div class="val">${fmtData(s.chamada_em)}</div></div>
            <div class="row"><div class="lbl">Início do Atendimento</div><div class="val">${fmtData(s.atendimento_iniciado_em)}</div></div>
            <div class="row"><div class="lbl">Conclusão</div><div class="val">${fmtData(s.atendimento_concluido_em)}</div></div>
            <div class="row"><div class="lbl">Tempo de Espera</div><div class="val">${s.tempo_espera_minutos?s.tempo_espera_minutos+' min':'–'}</div></div>
            <div class="row"><div class="lbl">Duração do Atendimento</div><div class="val">${s.tempo_atendimento_minutos?s.tempo_atendimento_minutos+' min':'–'}</div></div>
          </div>
          ${s.usuario_contato?`<div class="sec">Contacto do Utente</div>
          <div class="grid"><div class="row full"><div class="lbl">Email / Telefone</div>
          <div class="val">${s.usuario_contato}</div></div></div>`:''}
          ${ficheiroHtml?`<div class="sec">Documento</div><div class="grid">${ficheiroHtml}</div>`:''}
          <div class="sec">Dados do Pedido</div>
          <div class="dados">${linhasForm||'Sem dados de formulário registados.'}</div>
          <div class="footer">Impresso em ${agora} · Sistema de Gestão de Filas · IMTSB</div>
          <script>window.onload=()=>window.print();<\/script>
          </body></html>`;

        const w = window.open('', '_blank', 'width=680,height=820');
        if (!w) { showToast('Permita popups para imprimir.', 'error'); return; }
        w.document.write(html); w.document.close();
    };

    /* ── Relatório geral do período ────────────────────────── */
    window.imprimirRelatorioCompleto = async function () {
        const { de, ate } = _calcularIntervalo(_filtroActivo);
        const labelPeriodo = {
            hoje:'Hoje', semana:'Esta Semana', mes:'Este Mês',
            todos:'Todos os Registos', intervalo: de && ate ? `${de} a ${ate}` : de || ate || 'Intervalo'
        }[_filtroActivo] || '';

        let url = `/api/senhas?status=concluida&page=1&per_page=100`;
        if (de)  url += `&data_de=${de}`;
        if (ate) url += `&data_ate=${ate}`;

        let senhas = [];
        try {
            const r = await fetch(url, { headers:{ Authorization:`Bearer ${store.getToken()}` } });
            const d = await r.json();
            senhas  = d.senhas || [];
        } catch(e) { showToast('Erro ao carregar dados.', 'error'); return; }

        const agora = new Date().toLocaleString('pt-PT', { timeZone:'Africa/Luanda' });
        const fmtH  = iso => iso
            ? new Date(iso.endsWith('Z')?iso:iso+'Z')
                .toLocaleString('pt-PT', { timeZone:'Africa/Luanda',
                    day:'2-digit', month:'2-digit', year:'numeric',
                    hour:'2-digit', minute:'2-digit' })
            : '–';

        const linhas = senhas.map(s => `
            <tr>
              <td>${s.numero}${s.tipo==='prioritaria'?' ★':''}</td>
              <td>${s.servico?.nome||'–'}</td>
              <td>${s.atendente?.nome||'–'}</td>
              <td style="font-size:.78rem">${fmtH(s.atendimento_concluido_em||s.emitida_em)}</td>
              <td>${s.tempo_espera_minutos||'–'}</td>
              <td>${s.tempo_atendimento_minutos||'–'}</td>
            </tr>`).join('');

        const n    = senhas.length;
        const mE   = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_espera_minutos||0),0)/n) : 0;
        const mA   = n ? Math.round(senhas.reduce((a,s)=>a+(s.tempo_atendimento_minutos||0),0)/n) : 0;
        const nPri = senhas.filter(s=>s.tipo==='prioritaria').length;

        const html = `<html><head><meta charset="UTF-8"><title>Relatório IMTSB</title>
          <style>
            *{box-sizing:border-box;margin:0;padding:0}
            body{font-family:'Segoe UI',Arial,sans-serif;padding:22px;color:#2a1a0a}
            .header{background:linear-gradient(135deg,#3e2510,#6b4226);color:white;
              padding:14px 18px;border-radius:9px;margin-bottom:14px;
              display:flex;justify-content:space-between;align-items:center}
            .header h2{font-size:1.1rem;margin-bottom:2px}
            .header p{opacity:.8;font-size:.74rem}
            .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:14px}
            .kpi{background:#fdf8f5;border:1px solid #e8d5c4;border-radius:7px;padding:9px;text-align:center}
            .kpi .n{font-size:1.35rem;font-weight:800;color:#6b4226}
            .kpi .l{font-size:.67rem;color:#8a7060;text-transform:uppercase;letter-spacing:.05em}
            table{width:100%;border-collapse:collapse;font-size:.81rem}
            th{background:#f3ece6;color:#6b4226;padding:7px 9px;text-align:left;
               font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
            td{padding:6px 9px;border-bottom:1px solid #f0e8dc}
            tr:nth-child(even) td{background:#fdfaf8}
            .footer{margin-top:14px;text-align:center;color:#9c8070;font-size:.72rem;
              border-top:1px solid #f0e8dc;padding-top:9px}
            @media print{.header,.kpi{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
          </style></head><body>
          <div class="header">
            <div><h2>IMTSB · Relatório de Atendimentos</h2>
              <p>Instituto Médio Técnico São Benedito · Período: ${labelPeriodo}</p></div>
            <div style="opacity:.85;font-size:.76rem;text-align:right">Impresso em<br>${agora}</div>
          </div>
          <div class="kpis">
            <div class="kpi"><div class="n">${n}</div><div class="l">Total</div></div>
            <div class="kpi"><div class="n">${nPri}</div><div class="l">Prioritários</div></div>
            <div class="kpi"><div class="n">${mE} min</div><div class="l">Média Espera</div></div>
            <div class="kpi"><div class="n">${mA} min</div><div class="l">Média Atendimento</div></div>
          </div>
          <table>
            <thead><tr>
              <th>Senha</th><th>Serviço</th><th>Atendente</th>
              <th>Data / Hora</th><th>Espera</th><th>Duração</th>
            </tr></thead>
            <tbody>${linhas||'<tr><td colspan="6" style="text-align:center;padding:14px;color:#9c8070;">Sem registos no período.</td></tr>'}</tbody>
          </table>
          <div class="footer">Sistema de Gestão de Filas · IMTSB · ${agora}</div>
          <script>window.onload=()=>window.print();<\/script>
          </body></html>`;

        const w = window.open('', '_blank', 'width=860,height=720');
        if (!w) { showToast('Permita popups para imprimir.', 'error'); return; }
        w.document.write(html); w.document.close();
    };

    /* ═══════════════════════════════════════════════════════
       AUXILIARES
    ═══════════════════════════════════════════════════════ */
    function atualizarHeader() {
        const user      = store.getUser();
        const adminName = document.getElementById('adminProfileName');
        const adminInit = document.getElementById('adminInitials');
        if (adminName) adminName.textContent = user.name || 'Administrador';
        if (adminInit) adminInit.textContent  = getInitials(user.name || 'AD');
    }

    function getInitials(nome) {
        return (nome || 'AD').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }

    function showToast(message, type) {
        const toast = document.createElement('div');
        const bg    = type === 'success' ? '#22c55e' : '#ef4444';
        toast.style.cssText = `
            position:fixed;bottom:2rem;right:2rem;background:${bg};color:white;
            padding:.85rem 1.5rem;border-radius:12px;font-weight:600;
            z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.2);
            animation:fadeInUp .3s ease-out;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

})();