/**
 * static/js/dashadm.js — Sprint 1 (corrigido)
 * ═══════════════════════════════════════════════════════════════
 * Dashboard do Administrador.
 *
 * CORRECÇÕES SPRINT 1:
 *   ✅ exportData() chama GET /api/dashboard/admin/exportar
 *      e faz download real do CSV (era apenas alert)
 *   ✅ changeChartPeriod() usa params correctos:
 *      'day'→'dia', 'week'→'semana', 'month'→'mes'
 *      (o backend espera em português, o HTML passava em inglês)
 *   ✅ CRUD de trabalhadores mantido (Sprint 2 do plano anterior)
 *   ✅ Gráfico de linha e barras com dados reais mantidos
 *   ✅ Paginação do histórico mantida
 *   ✅ Toda documentação em pt-pt
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const store = window.IMTSBStore;

    // Instâncias Chart.js (guardadas para destruir antes de recriar)
    let pieChart  = null;
    let lineChart = null;
    let barChart  = null;

    /** ID do intervalo de polling de KPIs */
    let pollingInterval = null;

    /** Período activo no gráfico de linha */
    let periodoActivo = 'semana';

    /** Estado de paginação do histórico */
    const historicoState = {
        page: 1, perPage: 15, total: 0, totalPages: 1
    };


    // ═══════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', async () => {
        console.log("✅ Dashboard admin carregado — Sprint 1");

        if (!store.isLoggedIn()) {
            window.location.href = '/login';
            return;
        }

        const user = store.getUser();
        if (user.role !== 'admin') {
            alert("Acesso negado. Apenas administradores.");
            window.location.href = '/';
            return;
        }

        // Data actual no cabeçalho
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('pt-PT', {
                weekday: 'long', year: 'numeric',
                month:   'long', day:  'numeric'
            });
        }

        atualizarHeader();
        await carregarDashboard();
        configurarBotoes();
        iniciarPolling();
    });


    // ═══════════════════════════════════════════════════════════
    // CARREGAR DASHBOARD — orquestra todas as secções
    // ═══════════════════════════════════════════════════════════

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


    // ═══════════════════════════════════════════════════════════
    // KPIs — métricas do dia
    // ═══════════════════════════════════════════════════════════

    async function atualizarKPIs() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            const kpiAttend = document.getElementById('kpiAttend');
            if (kpiAttend) kpiAttend.textContent = stats.concluidas || 0;

            await atualizarTrendReal();

            const kpiWait = document.getElementById('kpiWait');
            if (kpiWait)
                kpiWait.textContent = `${stats.tempo_medio_espera || 0}min`;

            // Taxa de ocupação = atendendo / (aguardando + atendendo)
            const kpiOcc = document.getElementById('kpiOcc');
            if (kpiOcc) {
                const total = (stats.aguardando || 0) + (stats.atendendo || 0);
                const taxa  = total > 0
                    ? Math.round((stats.atendendo / total) * 100)
                    : 0;
                kpiOcc.textContent = `${taxa}%`;
            }

            // Taxa de conclusão = concluidas / total_emitidas
            // NOTA: renomeado internamente de "Satisfação" para ser honesto
            // O KPI no HTML continua como "Satisfação" até ao Sprint 3
            const kpiSat = document.getElementById('kpiSat');
            if (kpiSat) {
                const total   = stats.total_emitidas || 0;
                const conclui = stats.concluidas     || 0;
                const taxa    = total > 0
                    ? Math.round((conclui / total) * 100)
                    : 0;
                kpiSat.textContent = `${taxa}%`;
            }

        } catch (error) {
            console.error("❌ Erro ao actualizar KPIs:", error);
        }
    }

    /** Busca variação de hoje vs ontem e actualiza badge de trend. */
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

            let texto, cor;
            if (data.tendencia === 'alta') {
                texto = `+${pct}%`; cor = '#22c55e';
            } else if (data.tendencia === 'baixa') {
                texto = `${pct}%`;  cor = '#ef4444';
            } else {
                texto = '~0%';      cor = '#6b7280';
            }

            trendEl.textContent = texto;
            trendEl.style.color = cor;
            trendEl.title       = `Hoje: ${data.hoje} | Ontem: ${data.ontem}`;

        } catch (error) {
            console.error("❌ Erro ao buscar trend:", error);
            const el = document.getElementById('trendAttend');
            if (el) el.textContent = '--';
        }
    }


    // ═══════════════════════════════════════════════════════════
    // FILAS POR SERVIÇO
    // ═══════════════════════════════════════════════════════════

    async function atualizarFilas() {
        try {
            const respStats   = await fetch('/api/senhas/estatisticas');
            const stats       = await respStats.json();
            const respServicos = await fetch('/api/servicos');
            const servicos    = respServicos.ok ? await respServicos.json() : [];

            const queueList = document.getElementById('queueList');
            if (!queueList) return;

            if (servicos.length === 0) {
                queueList.innerHTML = `
                  <div class="queue-item">
                    <div class="queue-service">Total aguardando</div>
                    <div class="queue-number">${stats.aguardando || 0}</div>
                  </div>`;
                return;
            }

            // Renderizar linha por serviço com placeholder
            queueList.innerHTML = servicos.slice(0, 4).map(s => `
              <div class="queue-item">
                <div>
                  <div class="queue-service">${s.icone || '📋'} ${s.nome}</div>
                </div>
                <div class="queue-number" id="fila-serv-${s.id}">–</div>
              </div>
            `).join('');

            // Actualizar contagem real por serviço
            for (const s of servicos) {
                try {
                    const r = await fetch(
                        `/api/senhas?servico_id=${s.id}&status=aguardando`
                    );
                    if (r.ok) {
                        const d  = await r.json();
                        const el = document.getElementById(`fila-serv-${s.id}`);
                        if (el) el.textContent = d.total || 0;
                    }
                } catch (_) { /* silencioso */ }
            }

        } catch (error) {
            console.error("❌ Erro ao actualizar filas:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // GRÁFICOS
    // ═══════════════════════════════════════════════════════════

    async function criarGraficos() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            // Gráfico donut — distribuição por estado
            const pieCtx = document.getElementById('pieChart');
            if (pieCtx) {
                if (pieChart) pieChart.destroy();
                pieChart = new Chart(pieCtx, {
                    type: 'doughnut',
                    data: {
                        labels:   ['Aguardando', 'Atendendo', 'Concluídas', 'Canceladas'],
                        datasets: [{
                            data: [
                                stats.aguardando || 0,
                                stats.atendendo  || 0,
                                stats.concluidas || 0,
                                stats.canceladas || 0
                            ],
                            backgroundColor: ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { padding: 16 } }
                        }
                    }
                });
            }

            // Gráfico de linha — fluxo por período
            await atualizarLineChart(periodoActivo);

        } catch (error) {
            console.error("❌ Erro ao criar gráficos:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // GRÁFICO DE LINHA — correcção dos parâmetros
    // ═══════════════════════════════════════════════════════════

    /**
     * Altera o período do gráfico de linha.
     * CORRECÇÃO SPRINT 1: mapeia os valores do HTML ('day','week','month')
     * para os valores que o backend espera ('dia','semana','mes').
     *
     * @param {string} periodoHtml - Valor passado pelo onclick no HTML
     */
    window.changeChartPeriod = async function (periodoHtml) {
        // Mapeamento: HTML → backend
        const mapa = {
            day:    'dia',
            week:   'semana',
            month:  'mes',
            // Também aceita já em português (defensivo)
            dia:    'dia',
            semana: 'semana',
            mes:    'mes'
        };

        const periodoBackend = mapa[periodoHtml] || 'semana';
        periodoActivo = periodoBackend;

        // Actualizar classe activa nos botões de filtro
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Activar o botão correspondente
        const mapaIndex = { day: 0, dia: 0, week: 1, semana: 1, month: 2, mes: 2 };
        const btns      = document.querySelectorAll('.filter-btn');
        const idx       = mapaIndex[periodoHtml] ?? 1;
        if (btns[idx]) btns[idx].classList.add('active');

        await atualizarLineChart(periodoBackend);
    };

    /**
     * Busca dados reais do fluxo e renderiza o gráfico de linha.
     * @param {string} periodo - 'dia', 'semana' ou 'mes'
     */
    async function atualizarLineChart(periodo) {
        const lineCtx = document.getElementById('lineChart');
        if (!lineCtx) return;

        try {
            const resp = await fetch(
                `/api/dashboard/admin/fluxo?periodo=${periodo}`,
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );

            if (!resp.ok) {
                console.error("Erro ao buscar fluxo:", resp.status);
                return;
            }

            const data = await resp.json();

            if (lineChart) lineChart.destroy();

            lineChart = new Chart(lineCtx, {
                type: 'line',
                data: {
                    labels:   data.labels,
                    datasets: [{
                        label:           'Atendimentos concluídos',
                        data:            data.dados,
                        borderColor:     '#6b4226',
                        backgroundColor: 'rgba(107,66,38,0.08)',
                        borderWidth:     2,
                        pointRadius:     4,
                        pointBackgroundColor: '#6b4226',
                        fill:            true,
                        tension:         0.3
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { stepSize: 1, precision: 0 }
                        },
                        x: {
                            ticks: {
                                maxTicksLimit: periodo === 'dia' ? 12 : 10,
                                autoSkip:      true
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("❌ Erro ao actualizar lineChart:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // TEMPO MÉDIO POR SERVIÇO — gráfico de barras
    // ═══════════════════════════════════════════════════════════

    async function atualizarTempoPorServico() {
        const barCtx = document.getElementById('barChart');
        if (!barCtx) return;

        try {
            const resp = await fetch(
                '/api/dashboard/admin/tempo-por-servico',
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );

            if (!resp.ok) return;

            const data     = await resp.json();
            const servicos = data.servicos || [];
            if (servicos.length === 0) return;

            const labels         = servicos.map(s =>
                s.nome.length > 14 ? s.nome.substring(0, 14) + '…' : s.nome
            );
            const temposMedios   = servicos.map(s => s.tempo_medio);
            const totalAtendidos = servicos.map(s => s.total_hoje);

            if (barChart) barChart.destroy();

            barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [
                        {
                            label:           'Tempo médio (min)',
                            data:            temposMedios,
                            backgroundColor: '#6b4226',
                            borderRadius:    4,
                            yAxisID:         'y'
                        },
                        {
                            label:           'Total atendidos',
                            data:            totalAtendidos,
                            backgroundColor: 'rgba(107,66,38,0.25)',
                            borderRadius:    4,
                            yAxisID:         'y1'
                        }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels:   { padding: 12, font: { size: 12 } }
                        },
                        tooltip: {
                            callbacks: {
                                afterBody(ctx) {
                                    const idx = ctx[0].dataIndex;
                                    const s   = servicos[idx];
                                    return [
                                        `Mínimo: ${s.tempo_min}min`,
                                        `Máximo: ${s.tempo_max}min`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            position: 'left',
                            title: { display: true, text: 'Tempo médio (min)' },
                            ticks: { stepSize: 1 }
                        },
                        y1: {
                            beginAtZero: true,
                            position: 'right',
                            grid:     { drawOnChartArea: false },
                            title: { display: true, text: 'Total atendidos' },
                            ticks: { stepSize: 1, precision: 0 }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("❌ Erro ao actualizar tempoPorServico:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // TRABALHADORES — CRUD completo
    // ═══════════════════════════════════════════════════════════

    async function atualizarTrabalhadores() {
        try {
            const response = await fetch('/api/atendentes/', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });

            if (!response.ok) {
                console.error("Erro ao buscar trabalhadores:", response.status);
                return;
            }

            const trabalhadores = await response.json();

            // Tabela de desempenho
            const perfBody = document.getElementById('performanceBody');
            if (perfBody) {
                if (trabalhadores.length === 0) {
                    perfBody.innerHTML =
                        '<tr><td colspan="5">Nenhum trabalhador encontrado</td></tr>';
                } else {
                    perfBody.innerHTML = trabalhadores.map(t => {
                        const atend = t.atendimentos_hoje || 0;
                        const tempo = t.tempo_medio       || 0;

                        let badge, classe;
                        if (atend >= 10) {
                            badge = 'Excelente'; classe = 'badge-excellent';
                        } else if (atend >= 5) {
                            badge = 'Bom';       classe = 'badge-good';
                        } else {
                            badge = 'Activo';    classe = 'badge-good';
                        }

                        const statusDot = t.ativo
                            ? '<span style="color:#22c55e">●</span>'
                            : '<span style="color:#9ca3af">●</span>';

                        return `<tr>
                          <td>
                            <div class="employee-info">
                              <div class="employee-avatar">${getInitials(t.nome)}</div>
                              <div>
                                <div class="employee-name">${statusDot} ${t.nome}</div>
                                <div class="employee-role">${t.departamento || 'Atendimento'}</div>
                              </div>
                            </div>
                          </td>
                          <td>${atend}</td>
                          <td>${tempo} min</td>
                          <td>${t.ativo ? 'Activo' : 'Inactivo'}</td>
                          <td>
                            <span class="performance-badge ${classe}">${badge}</span>
                          </td>
                        </tr>`;
                    }).join('');
                }
            }

            // Lista de gestão com botão desactivar
            const workersBody = document.getElementById('workersBody');
            if (workersBody) {
                if (trabalhadores.length === 0) {
                    workersBody.innerHTML =
                        '<tr><td colspan="4">Nenhum trabalhador</td></tr>';
                } else {
                    workersBody.innerHTML = trabalhadores.map(t => `
                      <tr style="${!t.ativo ? 'opacity:0.5' : ''}">
                        <td>${t.nome}</td>
                        <td>${t.email}</td>
                        <td>${t.departamento || '–'}${t.balcao ? ` · Balcão ${t.balcao}` : ''}</td>
                        <td>
                          ${t.ativo
                            ? `<button class="remove-worker-btn"
                                 onclick="removerTrabalhador(${t.id}, '${t.nome}')">
                                 Desactivar
                               </button>`
                            : '<span style="color:#9ca3af;font-size:12px">Inactivo</span>'
                          }
                        </td>
                      </tr>
                    `).join('');
                }
            }

        } catch (error) {
            console.error("❌ Erro ao actualizar trabalhadores:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // HISTÓRICO COM PAGINAÇÃO
    // ═══════════════════════════════════════════════════════════

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

            historicoState.page       = data.page       || pg;
            historicoState.total      = data.total       || 0;
            historicoState.totalPages = data.total_pages || 1;

            const historyBody = document.getElementById('historyBody');
            if (!historyBody) return;

            const senhas = data.senhas || [];

            if (senhas.length === 0 && pg === 1) {
                historyBody.innerHTML =
                    '<tr><td colspan="6">Nenhum atendimento concluído</td></tr>';
                renderNavegacao();
                return;
            }

            historyBody.innerHTML = senhas.map(s => {
                const servico   = s.servico?.nome   || 'Serviço Geral';
                const atendente = s.atendente?.nome || '–';
                const duracao   = s.tempo_atendimento_minutos || 0;
                const tsStr     = s.atendimento_concluido_em  || s.created_at;
                const hora      = tsStr
                    ? new Date(tsStr).toLocaleTimeString('pt-PT',
                        { hour: '2-digit', minute: '2-digit' })
                    : '--:--';

                return `<tr>
                  <td><strong>${s.numero}</strong></td>
                  <td>${servico}</td>
                  <td>${atendente}</td>
                  <td>${hora}</td>
                  <td>${duracao}min</td>
                  <td>
                    <span class="performance-badge badge-excellent">Concluído</span>
                  </td>
                </tr>`;
            }).join('');

            renderNavegacao();

        } catch (error) {
            console.error("❌ Erro ao actualizar histórico:", error);
        }
    }

    function renderNavegacao() {
        const btnAnterior = document.getElementById('historyPrevBtn');
        const btnProxima  = document.getElementById('historyNextBtn');
        const pageInfo    = document.getElementById('historyPageInfo');

        const { page, totalPages, total } = historicoState;

        if (btnAnterior) {
            btnAnterior.disabled = (page <= 1);
            btnAnterior.onclick  = () => atualizarHistorico(page - 1);
        }
        if (btnProxima) {
            btnProxima.disabled = (page >= totalPages);
            btnProxima.onclick  = () => atualizarHistorico(page + 1);
        }
        if (pageInfo) {
            pageInfo.textContent =
                `Página ${page} de ${totalPages} · ${total} registos`;
        }
    }


    // ═══════════════════════════════════════════════════════════
    // EXPORTAR CSV — CORRECÇÃO SPRINT 1
    // ═══════════════════════════════════════════════════════════

    /**
     * Exporta o histórico de atendimentos em CSV.
     *
     * CORRECÇÃO SPRINT 1:
     * Antes: apenas mostrava alert("Exportação — Sprint 3")
     * Agora: chama GET /api/dashboard/admin/exportar e faz download real.
     *
     * O backend já gera o CSV com datas configuráveis;
     * aqui usamos o intervalo do último mês por defeito.
     */
    window.exportData = async function () {
        const formatoEl = document.getElementById('exportFormat');
        const formato   = formatoEl ? formatoEl.value : 'excel';

        // Calcular intervalo: último mês
        const hoje    = new Date();
        const umMesAtras = new Date();
        umMesAtras.setMonth(hoje.getMonth() - 1);

        const dataInicio = umMesAtras.toISOString().split('T')[0];
        const dataFim    = hoje.toISOString().split('T')[0];

        // Mostrar feedback ao utilizador
        const btnExport = document.getElementById('exportBtn');
        if (btnExport) {
            btnExport.disabled    = true;
            btnExport.textContent = 'A exportar...';
        }

        try {
            const response = await fetch(
                `/api/dashboard/admin/exportar?data_inicio=${dataInicio}&data_fim=${dataFim}`,
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );

            if (!response.ok) {
                const erro = await response.json().catch(() => ({}));
                alert(`Erro ao exportar: ${erro.erro || response.status}`);
                return;
            }

            // Obter o blob do CSV e forçar download
            const blob     = await response.blob();
            const url       = window.URL.createObjectURL(blob);
            const link      = document.createElement('a');
            link.href       = url;
            link.download   = `relatorio_${dataInicio}_${dataFim}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            console.log(`✅ CSV exportado: ${dataInicio} → ${dataFim}`);

        } catch (error) {
            console.error("❌ Erro ao exportar:", error);
            alert("Erro de ligação ao servidor. Tente novamente.");
        } finally {
            if (btnExport) {
                btnExport.disabled    = false;
                btnExport.textContent = 'Exportar';
            }
        }
    };


    // ═══════════════════════════════════════════════════════════
    // ADICIONAR TRABALHADOR
    // ═══════════════════════════════════════════════════════════

    async function adicionarTrabalhador() {
        const nome   = document.getElementById('newWorkerName')?.value?.trim();
        const email  = document.getElementById('newWorkerEmail')?.value?.trim();
        const senha  = document.getElementById('newWorkerPass')?.value?.trim();
        const dept   = document.getElementById('newWorkerDept')?.value;
        const msgEl  = document.getElementById('workerFormMsg');

        if (!nome || !email || !senha) {
            if (msgEl) {
                msgEl.textContent = 'Nome, email e senha são obrigatórios.';
                msgEl.style.color = '#ef4444';
            }
            return;
        }

        const mapa = {
            'Secretaria Academica': { balcao: 1, servico_id: 1 },
            'Contabilidade':        { balcao: 2, servico_id: 2 },
            'Apoio ao Cliente':     { balcao: 3, servico_id: 5 }
        };
        const extra = mapa[dept] || { balcao: null, servico_id: null };

        const btnAdd = document.getElementById('btnAddWorker');
        if (btnAdd) { btnAdd.disabled = true; btnAdd.textContent = 'A criar...'; }

        try {
            const response = await fetch('/api/atendentes/', {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${store.getToken()}`
                },
                body: JSON.stringify({
                    nome, email, senha,
                    tipo:       'atendente',
                    balcao:     extra.balcao,
                    servico_id: extra.servico_id
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (msgEl) {
                    msgEl.textContent = `Trabalhador criado com sucesso.`;
                    msgEl.style.color = '#22c55e';
                }

                ['newWorkerName', 'newWorkerEmail', 'newWorkerPass'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

                await atualizarTrabalhadores();

                setTimeout(() => {
                    if (msgEl) msgEl.textContent = '';
                }, 4000);

            } else {
                if (msgEl) {
                    msgEl.textContent = data.erro || 'Erro ao criar trabalhador.';
                    msgEl.style.color = '#ef4444';
                }
            }

        } catch (error) {
            console.error("❌ Erro ao adicionar trabalhador:", error);
            if (msgEl) {
                msgEl.textContent = 'Erro de ligação ao servidor.';
                msgEl.style.color = '#ef4444';
            }
        } finally {
            if (btnAdd) {
                btnAdd.disabled    = false;
                btnAdd.textContent = 'Adicionar Trabalhador';
            }
        }
    }


    // ═══════════════════════════════════════════════════════════
    // POLLING
    // ═══════════════════════════════════════════════════════════

    function iniciarPolling() {
        pararPolling();
        pollingInterval = setInterval(async () => {
            await atualizarKPIs();
            await atualizarFilas();
        }, 15000);
    }

    function pararPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }


    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÃO DE BOTÕES
    // ═══════════════════════════════════════════════════════════

    function configurarBotoes() {
        const btnAdd = document.getElementById('btnAddWorker');
        if (btnAdd) btnAdd.addEventListener('click', adicionarTrabalhador);

        const btnExport = document.getElementById('exportBtn');
        if (btnExport) btnExport.addEventListener('click', exportData);

        const btnSair = document.getElementById('btnSairAdmin');
        if (btnSair) {
            btnSair.addEventListener('click', () => {
                if (confirm("Deseja sair do sistema?")) {
                    pararPolling();
                    store.logout();
                    window.location.href = '/login';
                }
            });
        }

        const btnReset = document.getElementById('btnResetDayAdmin');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                alert("Funcionalidade de reset de dia em desenvolvimento.");
            });
        }
    }


    // ═══════════════════════════════════════════════════════════
    // AUXILIARES
    // ═══════════════════════════════════════════════════════════

    function atualizarHeader() {
        const user      = store.getUser();
        const adminName = document.getElementById('adminProfileName');
        const adminInit = document.getElementById('adminInitials');

        if (adminName) adminName.textContent = user.name || 'Administrador';
        if (adminInit) adminInit.textContent  = getInitials(user.name || 'AD');
    }

    function getInitials(nome) {
        return (nome || 'AD')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }


    // ═══════════════════════════════════════════════════════════
    // FUNÇÕES GLOBAIS — chamadas pelo HTML
    // ═══════════════════════════════════════════════════════════

    window.removerTrabalhador = async function (id, nome) {
        if (!confirm(
            `Desactivar trabalhador "${nome}"?\n` +
            `O histórico de atendimentos será preservado.`
        )) return;

        try {
            const response = await fetch(`/api/atendentes/${id}`, {
                method:  'DELETE',
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });

            const data = await response.json();

            if (response.ok) {
                alert(`Trabalhador desactivado com sucesso.`);
                await atualizarTrabalhadores();
            } else {
                alert(`Erro: ${data.erro || 'Não foi possível desactivar.'}`);
            }
        } catch (error) {
            console.error("❌ Erro ao remover:", error);
            alert("Erro de ligação ao servidor.");
        }
    };

    window.sair = function () {
        if (confirm("Deseja sair do sistema?")) {
            pararPolling();
            store.logout();
            window.location.href = '/login';
        }
    };

})();
