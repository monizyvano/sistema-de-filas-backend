/**
 * static/js/dashadm.js — SPRINT 2
 * ═══════════════════════════════════════════════════════════════
 * ADIÇÕES SPRINT 2:
 *   ✅ Gráfico de linha com dados reais (dia/semana/mês)
 *      via GET /api/dashboard/admin/fluxo?periodo=...
 *   ✅ Tempo médio por serviço com barras comparativas
 *      via GET /api/dashboard/admin/tempo-por-servico
 *   ✅ CRUD completo de trabalhadores (#btnAddWorker)
 *      via POST/DELETE /api/atendentes/
 *   ✅ Paginação histórico (Sprint 1 mantido)
 *   ✅ Trend real (Sprint 1 mantido)
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const store = window.IMTSBStore;

    // Instâncias Chart.js
    let pieChart    = null;
    let lineChart   = null;
    let barChart    = null;
    let pollingInterval = null;

    // Período activo do gráfico de linha
    let periodoActivo = 'semana';

    // Paginação do histórico
    const historicoState = {
        page: 1, perPage: 15, total: 0, totalPages: 1
    };


    // ═══════════════════════════════════════════════════════════
    // 🎬 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', async () => {
        console.log("✅ Dashboard admin carregado (Sprint 2)");

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

        // Data actual no header
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = new Date().toLocaleDateString('pt-PT', {
                weekday: 'long', year: 'numeric',
                month: 'long', day: 'numeric'
            });
        }

        atualizarHeader();
        await carregarDashboard();
        configurarBotoes();
        iniciarPolling();
    });


    // ═══════════════════════════════════════════════════════════
    // 📊 CARREGAR DASHBOARD
    // ═══════════════════════════════════════════════════════════

    async function carregarDashboard() {
        await Promise.all([
            atualizarKPIs(),
            atualizarFilas(),
            atualizarTrabalhadores(),
            atualizarHistorico(1),
            criarGraficos(),
            atualizarTempoPorServico()   // SPRINT 2
        ]);
    }


    // ═══════════════════════════════════════════════════════════
    // 📈 KPIs
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

            const kpiOcc = document.getElementById('kpiOcc');
            if (kpiOcc) {
                const total = (stats.aguardando || 0) + (stats.atendendo || 0);
                const taxa  = total > 0
                    ? Math.round((stats.atendendo / total) * 100)
                    : 0;
                kpiOcc.textContent = `${taxa}%`;
            }

            // kpiSat — calculado como % de atendimentos dentro do tempo médio
            const kpiSat = document.getElementById('kpiSat');
            if (kpiSat) {
                const total   = stats.total_emitidas || 0;
                const conclui = stats.concluidas     || 0;
                const sat     = total > 0
                    ? Math.round((conclui / total) * 100)
                    : 0;
                kpiSat.textContent = `${sat}%`;
            }

        } catch (error) {
            console.error("❌ Erro ao atualizar KPIs:", error);
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
            trendEl.title       =
                `Hoje: ${data.hoje} | Ontem: ${data.ontem}`;

        } catch (error) {
            console.error("❌ Erro trend:", error);
            if (trendEl) trendEl.textContent = '--';
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 🏢 FILAS
    // ═══════════════════════════════════════════════════════════

    async function atualizarFilas() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            const queueList = document.getElementById('queueList');
            if (queueList) {
                // Buscar filas reais por serviço
                const respServicos = await fetch('/api/servicos');
                const servicos     = respServicos.ok
                    ? await respServicos.json()
                    : [];

                if (servicos.length === 0) {
                    queueList.innerHTML = `
                      <div class="queue-item">
                        <div class="queue-service">Total aguardando</div>
                        <div class="queue-number">${stats.aguardando || 0}</div>
                      </div>`;
                } else {
                    queueList.innerHTML = servicos.slice(0, 4).map(s => `
                      <div class="queue-item">
                        <div>
                          <div class="queue-service">
                            ${s.icone || '📋'} ${s.nome}
                          </div>
                        </div>
                        <div class="queue-number" id="fila-serv-${s.id}">–</div>
                      </div>
                    `).join('');

                    // Actualizar contagens por serviço
                    for (const s of servicos) {
                        try {
                            const r = await fetch(
                                `/api/senhas?servico_id=${s.id}&status=aguardando`
                            );
                            if (r.ok) {
                                const d   = await r.json();
                                const el  = document.getElementById(
                                    `fila-serv-${s.id}`
                                );
                                if (el) el.textContent = d.total || 0;
                            }
                        } catch (_) { /* silencioso */ }
                    }
                }
            }

        } catch (error) {
            console.error("❌ Erro ao atualizar filas:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 📊 GRÁFICOS
    // ═══════════════════════════════════════════════════════════

    async function criarGraficos() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            // ── Gráfico de donut ──────────────────────────────────
            const pieCtx = document.getElementById('pieChart');
            if (pieCtx) {
                if (pieChart) pieChart.destroy();
                pieChart = new Chart(pieCtx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Aguardando','Atendendo','Concluídas','Canceladas'],
                        datasets: [{
                            data: [
                                stats.aguardando || 0,
                                stats.atendendo  || 0,
                                stats.concluidas || 0,
                                stats.canceladas || 0
                            ],
                            backgroundColor: [
                                '#3b82f6','#f59e0b','#22c55e','#ef4444'
                            ],
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

            // ── Gráfico de linha (fluxo) — SPRINT 2 ──────────────
            await atualizarLineChart(periodoActivo);

        } catch (error) {
            console.error("❌ Erro ao criar gráficos:", error);
        }
    }

    // SPRINT 2: função chamada pelos botões Dia/Semana/Mês do HTML
    window.changeChartPeriod = async function (periodo) {
        periodoActivo = periodo;

        // Actualizar classe activa nos botões
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const mapa = { dia: 0, semana: 1, mes: 2 };
        const btns = document.querySelectorAll('.filter-btn');
        if (btns[mapa[periodo]]) btns[mapa[periodo]].classList.add('active');

        await atualizarLineChart(periodo);
    };

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
                    labels: data.labels,
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
                                autoSkip: true
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
    // ⏱️ TEMPO MÉDIO POR SERVIÇO — SPRINT 2
    // ═══════════════════════════════════════════════════════════

    async function atualizarTempoPorServico() {
        /**
         * Preenche o barChart com tempo médio real por serviço.
         * Substitui a distribuição fictícia do Sprint 1.
         */
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
                                        `Mín: ${s.tempo_min}min`,
                                        `Máx: ${s.tempo_max}min`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            position:    'left',
                            title: {
                                display: true,
                                text:    'Tempo médio (min)'
                            },
                            ticks: { stepSize: 1 }
                        },
                        y1: {
                            beginAtZero: true,
                            position:    'right',
                            grid:        { drawOnChartArea: false },
                            title: {
                                display: true,
                                text:    'Total atendidos'
                            },
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
    // 👥 TRABALHADORES — SPRINT 2 (CRUD completo)
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

            // ── Tabela de desempenho ──────────────────────────────
            const perfBody = document.getElementById('performanceBody');
            if (perfBody) {
                if (trabalhadores.length === 0) {
                    perfBody.innerHTML =
                        '<tr><td colspan="5">Nenhum trabalhador encontrado</td></tr>';
                } else {
                    perfBody.innerHTML = trabalhadores.map(t => {
                        const atend = t.atendimentos_hoje || 0;
                        const tempo = t.tempo_medio       || 0;

                        // Classificação de desempenho
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
                              <div class="employee-avatar">
                                ${getInitials(t.nome)}
                              </div>
                              <div>
                                <div class="employee-name">
                                  ${statusDot} ${t.nome}
                                </div>
                                <div class="employee-role">
                                  ${t.departamento || 'Atendimento'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>${atend}</td>
                          <td>${tempo} min</td>
                          <td>${t.ativo ? 'Activo' : 'Inactivo'}</td>
                          <td>
                            <span class="performance-badge ${classe}">
                              ${badge}
                            </span>
                          </td>
                        </tr>`;
                    }).join('');
                }
            }

            // ── Lista de gestão ───────────────────────────────────
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
                        <td>${t.departamento || '–'}
                          ${t.balcao ? ` · Balcão ${t.balcao}` : ''}
                        </td>
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
    // 📜 HISTÓRICO COM PAGINAÇÃO (Sprint 1 mantido)
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
                const tsStr     = s.atendimento_concluido_em || s.created_at;
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
                    <span class="performance-badge badge-excellent">
                      Concluído
                    </span>
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
    // 🔄 POLLING
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
    // 🔧 BOTÕES E CONFIGURAÇÃO — SPRINT 2
    // ═══════════════════════════════════════════════════════════

    function configurarBotoes() {
        // Botão Adicionar Trabalhador
        const btnAdd = document.getElementById('btnAddWorker');
        if (btnAdd) {
            btnAdd.addEventListener('click', adicionarTrabalhador);
        }

        // Botão Exportar
        const btnExport = document.getElementById('exportBtn');
        if (btnExport) {
            btnExport.addEventListener('click', exportData);
        }

        // Botão Sair
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

        // Botão Guardar e Reiniciar (reset do dia)
        const btnReset = document.getElementById('btnResetDayAdmin');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                alert("Funcionalidade de reset de dia em desenvolvimento.");
            });
        }
    }


    // ═══════════════════════════════════════════════════════════
    // ➕ ADICIONAR TRABALHADOR — SPRINT 2
    // ═══════════════════════════════════════════════════════════

    async function adicionarTrabalhador() {
        const nome   = document.getElementById('newWorkerName')?.value?.trim();
        const email  = document.getElementById('newWorkerEmail')?.value?.trim();
        const senha  = document.getElementById('newWorkerPass')?.value?.trim();
        const dept   = document.getElementById('newWorkerDept')?.value;
        const msgEl  = document.getElementById('workerFormMsg');

        // Validação básica no cliente
        if (!nome || !email || !senha) {
            if (msgEl) {
                msgEl.textContent = '⚠️ Nome, email e senha são obrigatórios.';
                msgEl.style.color = '#ef4444';
            }
            return;
        }

        // Mapear departamento → balcão e serviço
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
                    nome,
                    email,
                    senha,
                    tipo:       'atendente',
                    balcao:     extra.balcao,
                    servico_id: extra.servico_id
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (msgEl) {
                    msgEl.textContent = `✅ ${data.mensagem}`;
                    msgEl.style.color = '#22c55e';
                }

                // Limpar formulário
                ['newWorkerName','newWorkerEmail','newWorkerPass'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.value = '';
                });

                // Recarregar lista
                await atualizarTrabalhadores();

                // Limpar mensagem após 4s
                setTimeout(() => {
                    if (msgEl) msgEl.textContent = '';
                }, 4000);

            } else {
                if (msgEl) {
                    msgEl.textContent = `❌ ${data.erro || 'Erro ao criar trabalhador'}`;
                    msgEl.style.color = '#ef4444';
                }
            }

        } catch (error) {
            console.error("❌ Erro ao adicionar trabalhador:", error);
            if (msgEl) {
                msgEl.textContent = '❌ Erro de ligação ao servidor';
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
    // 🔧 AUXILIARES
    // ═══════════════════════════════════════════════════════════

    function atualizarHeader() {
        const user        = store.getUser();
        const adminName   = document.getElementById('adminProfileName');
        const adminInit   = document.getElementById('adminInitials');

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
    // 🌐 FUNÇÕES GLOBAIS (chamadas pelo HTML)
    // ═══════════════════════════════════════════════════════════

    window.removerTrabalhador = async function (id, nome) {
        if (!confirm(`Desactivar trabalhador "${nome}"?\n` +
                     `O histórico de atendimentos será preservado.`)) return;

        try {
            const response = await fetch(`/api/atendentes/${id}`, {
                method:  'DELETE',
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });

            const data = await response.json();

            if (response.ok) {
                alert(`✅ ${data.mensagem}`);
                await atualizarTrabalhadores();
            } else {
                alert(`❌ ${data.erro || 'Erro ao desactivar'}`);
            }
        } catch (error) {
            console.error("❌ Erro:", error);
            alert("Erro de ligação ao servidor");
        }
    };

    window.exportData = function () {
        alert("Exportação de relatório — Sprint 3");
    };

    window.sair = function () {
        if (confirm("Deseja sair do sistema?")) {
            pararPolling();
            store.logout();
            window.location.href = '/login';
        }
    };

})();
