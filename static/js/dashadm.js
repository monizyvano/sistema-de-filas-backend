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
       HISTÓRICO COM PAGINAÇÃO
    ═══════════════════════════════════════════════════════ */
    async function atualizarHistorico(page) {
        try {
            const pg = page || historicoState.page;
            const pp = historicoState.perPage;

            const response = await fetch(
                `/api/senhas?status=concluida&page=${pg}&per_page=${pp}`,
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
                historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem;">Sem atendimentos concluídos hoje</td></tr>';
                renderNavegacao();
                return;
            }

            historyBody.innerHTML = senhas.map(s => {
                const servico   = s.servico?.nome   || 'Serviço';
                const atendente = s.atendente?.nome || '–';
                const duracao   = s.tempo_atendimento_minutos || 0;
                const tsStr     = s.atendimento_concluido_em || s.created_at;
                const hora      = tsStr ? new Date(tsStr).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit', timeZone:'Africa/Luanda' }) : '--:--';
                const tipoBadge = s.tipo === 'prioritaria'
                    ? '<span style="background:rgba(245,158,11,.15);color:#92400e;padding:2px 8px;border-radius:20px;font-size:.75rem;font-weight:700;">★ Prior.</span>'
                    : '<span style="background:rgba(107,66,38,.1);color:#6b4226;padding:2px 8px;border-radius:20px;font-size:.75rem;">Normal</span>';

                return `<tr>
                  <td><strong>${s.numero}</strong> ${tipoBadge}</td>
                  <td>${servico}</td>
                  <td>${atendente}</td>
                  <td>${hora}</td>
                  <td>${duracao}min</td>
                  <td><span class="performance-badge badge-excellent">✓ Concluído</span></td>
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
    window.exportData = async function () {
        const formato = document.getElementById('exportFormat')?.value || 'excel';
        try {
            const response = await fetch('/api/senhas?status=concluida&page=1&per_page=500', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (!response.ok) { alert('Não foi possível carregar dados.'); return; }
            const data = await response.json();
            const rows = (data.senhas || []).map(s => ({
                Senha: s.numero, Serviço: s.servico?.nome || '—',
                Atendente: s.atendente?.nome || '—', Estado: s.status,
                Duração_min: s.tempo_atendimento_minutos || 0,
                Concluída_em: s.atendimento_concluido_em || ''
            }));
            if (!rows.length) { alert('Sem dados para exportar.'); return; }

            if (formato === 'excel' && window.XLSX) {
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
                XLSX.writeFile(wb, `relatorio_imtsb_${new Date().toISOString().slice(0,10)}.xlsx`);
                return;
            }

            /* PDF / impressão */
            const tableRows = rows.map(r =>
                `<tr><td>${r.Senha}</td><td>${r.Serviço}</td><td>${r.Atendente}</td><td>${r.Estado}</td><td>${r.Duração_min}min</td></tr>`
            ).join('');
            const html = `<html><head><title>Relatório IMTSB</title><style>
                body{font-family:Arial;padding:20px;font-size:13px}
                h2{margin-bottom:12px}
                table{width:100%;border-collapse:collapse}
                th,td{border:1px solid #ddd;padding:8px;text-align:left}
                th{background:#6b4226;color:white}
                tr:nth-child(even){background:#f9f6f3}
            </style></head><body>
                <h2>Relatório de Atendimentos — IMTSB</h2>
                <p style="color:#888;margin-bottom:12px">Gerado em ${new Date().toLocaleString('pt-PT')}</p>
                <table><thead><tr><th>Senha</th><th>Serviço</th><th>Atendente</th><th>Estado</th><th>Duração</th></tr></thead>
                <tbody>${tableRows}</tbody></table>
                <script>window.onload=()=>window.print();</script></body></html>`;
            const w = window.open('','_blank','width=1000,height=700');
            if (!w) { alert('Permita popups para exportar.'); return; }
            w.document.write(html);
            w.document.close();
        } catch (error) {
            console.error('❌ Exportar:', error);
            alert('Erro de ligação ao servidor.');
        }
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