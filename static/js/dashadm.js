/**
 * static/js/dashadm.js — SPRINT 1
 * ═══════════════════════════════════════════════════════════════
 * Dashboard Administrativo.
 *
 * CORRECÇÕES:
 *   ✅ Trend usa endpoint real /admin/trend (elimina "+12%" fixo).
 *   ✅ Histórico com paginação server-side + botões Anterior/Próxima.
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const store = window.IMTSBStore;

    let pieChart  = null;
    let lineChart = null;
    let barChart  = null;
    let pollingInterval = null;

    // Estado de paginação do histórico
    const historicoState = {
        page:       1,
        perPage:    15,
        total:      0,
        totalPages: 1
    };


    // ═══════════════════════════════════════════════════════════
    // 🎬 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', async () => {
        console.log("✅ Dashboard admin carregado (Sprint 1)");

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

        atualizarHeader();
        await carregarDashboard();
        iniciarPolling();
        configurarBotoes();
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
            criarGraficos()
        ]);
    }


    // ═══════════════════════════════════════════════════════════
    // 📈 ATUALIZAR KPIs
    // ═══════════════════════════════════════════════════════════

    async function atualizarKPIs() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            const kpiAttend = document.getElementById('kpiAttend');
            if (kpiAttend) kpiAttend.textContent = stats.concluidas || 0;

            // SPRINT 1: trend real em vez de "+12%" fixo
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

            const kpiFila = document.getElementById('kpiFila');
            if (kpiFila) kpiFila.textContent = stats.aguardando || 0;

        } catch (error) {
            console.error("❌ Erro ao atualizar KPIs:", error);
        }
    }


    // ─────────────────────────────────────────────────────────
    // SPRINT 1: Trend real (substitui "+12%" hardcoded)
    // ─────────────────────────────────────────────────────────

    async function atualizarTrendReal() {
        const trendEl = document.getElementById('trendAttend');
        if (!trendEl) return;

        try {
            const resp = await fetch('/api/dashboard/admin/trend', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });

            if (!resp.ok) {
                trendEl.textContent = '--';
                return;
            }

            const data = await resp.json();
            const pct  = data.variacao_percentual;

            let texto, cor;
            if (data.tendencia === 'alta') {
                texto = `+${pct}%`;
                cor   = '#22c55e';
            } else if (data.tendencia === 'baixa') {
                texto = `${pct}%`;
                cor   = '#ef4444';
            } else {
                texto = '~0%';
                cor   = '#6b7280';
            }

            trendEl.textContent = texto;
            trendEl.style.color = cor;
            trendEl.title       =
                `Hoje: ${data.hoje} atendimentos | Ontem: ${data.ontem}`;

        } catch (error) {
            console.error("❌ Erro ao buscar trend:", error);
            if (trendEl) trendEl.textContent = '--';
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 🏢 ATUALIZAR FILAS
    // ═══════════════════════════════════════════════════════════

    async function atualizarFilas() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            const queueNormal    = document.getElementById('queueNormal');
            const queueAttending = document.getElementById('queueAttending');

            if (queueNormal)    queueNormal.textContent    = stats.aguardando || 0;
            if (queueAttending) queueAttending.textContent = stats.atendendo  || 0;

        } catch (error) {
            console.error("❌ Erro ao atualizar filas:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 👥 ATUALIZAR TRABALHADORES
    // ═══════════════════════════════════════════════════════════

    async function atualizarTrabalhadores() {
        try {
            const response = await fetch('/api/dashboard/atendentes', {
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (!response.ok) return;

            const trabalhadores = await response.json();

            // Tabela de desempenho
            const perfBody = document.getElementById('perfBody');
            if (perfBody) {
                perfBody.innerHTML = trabalhadores.map(t => `
                  <tr>
                    <td>
                      <div class="employee-info">
                        <div class="employee-avatar">${getInitials(t.nome)}</div>
                        <div>
                          <div class="employee-name">${t.nome}</div>
                          <div class="employee-role">
                            ${t.departamento || 'Atendimento'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>${t.atendimentos_hoje || 0}</td>
                    <td>${t.tempo_medio || 0} min</td>
                    <td>–</td>
                    <td>
                      <span class="performance-badge badge-excellent">
                        Activo
                      </span>
                    </td>
                  </tr>
                `).join('');
            }

            // Lista de gestão
            const workersBody = document.getElementById('workersBody');
            if (workersBody) {
                workersBody.innerHTML = trabalhadores.map(t => `
                  <tr>
                    <td>${t.nome}</td>
                    <td>${t.email}</td>
                    <td>${t.departamento || '–'}</td>
                    <td>
                      <button class="remove-worker-btn"
                        onclick="removerTrabalhador(${t.id})">
                        Remover
                      </button>
                    </td>
                  </tr>
                `).join('');
            }

        } catch (error) {
            console.error("❌ Erro ao atualizar trabalhadores:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 📜 HISTÓRICO COM PAGINAÇÃO — SPRINT 1
    // ═══════════════════════════════════════════════════════════

    async function atualizarHistorico(page) {
        /**
         * SPRINT 1: paginação server-side.
         * Resposta: { senhas, total, page, per_page, total_pages }
         */
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

            if (senhas.length === 0 && pg === 1) {
                historyBody.innerHTML =
                    '<tr><td colspan="6">Nenhum atendimento concluído</td></tr>';
                renderNavegacao();
                return;
            }

            historyBody.innerHTML = senhas.map(s => {
                const servico  = s.servico?.nome   || 'Serviço Geral';
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
                      <span class="status-badge status-concluida">
                        Concluído
                      </span>
                    </td>
                </tr>`;
            }).join('');

            renderNavegacao();

        } catch (error) {
            console.error("❌ Erro ao atualizar histórico:", error);
        }
    }

    function renderNavegacao() {
        /**
         * Actualiza botões Anterior/Próxima e indicador de página.
         * Elementos esperados no HTML:
         *   id="historyPrevBtn"   – botão Anterior
         *   id="historyNextBtn"   – botão Próxima
         *   id="historyPageInfo"  – texto "Página X de Y · N registos"
         */
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
    // 📊 GRÁFICOS Chart.js
    // ═══════════════════════════════════════════════════════════

    async function criarGraficos() {
        try {
            const response = await fetch('/api/senhas/estatisticas');
            const stats    = await response.json();

            // Gráfico de donut — distribuição de estados
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
                        responsive:          true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }

            // Gráfico de barras — distribuição por hora (estimada)
            // Sprint 2 substituirá por dados reais de /admin/fluxo
            const barCtx = document.getElementById('barChart');
            if (barCtx) {
                if (barChart) barChart.destroy();

                const horas  = ['08h','09h','10h','11h','12h',
                                 '13h','14h','15h','16h','17h'];
                const pesos  = [0.05,0.10,0.14,0.13,0.08,
                                0.10,0.14,0.13,0.08,0.05];
                const total  = stats.concluidas || 0;
                const dados  = pesos.map(p => Math.round(total * p));

                barChart = new Chart(barCtx, {
                    type: 'bar',
                    data: {
                        labels: horas,
                        datasets: [{
                            label: 'Atendimentos',
                            data:  dados,
                            backgroundColor: '#3b82f6',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive:          true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: { beginAtZero: true, ticks: { stepSize: 1 } }
                        }
                    }
                });
            }

        } catch (error) {
            console.error("❌ Erro ao criar gráficos:", error);
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
    // 🔧 AUXILIARES
    // ═══════════════════════════════════════════════════════════

    function atualizarHeader() {
        const user        = store.getUser();
        const adminName   = document.getElementById('adminName');
        const adminAvatar = document.getElementById('adminAvatar');
        if (adminName)   adminName.textContent   = user.name || 'Administrador';
        if (adminAvatar) adminAvatar.textContent  = getInitials(user.name || 'A');
    }

    function getInitials(nome) {
        return (nome || 'A')
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    function configurarBotoes() {
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                alert("Exportação de relatório — Sprint 3");
            });
        }
        const addWorkerBtn = document.getElementById('addWorkerBtn');
        if (addWorkerBtn) {
            addWorkerBtn.addEventListener('click', () => {
                alert("Gestão de trabalhadores — Sprint 2");
            });
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 🌐 FUNÇÕES GLOBAIS
    // ═══════════════════════════════════════════════════════════

    window.removerTrabalhador = async function (id) {
        if (!confirm(`Confirma remoção do trabalhador ID ${id}?`)) return;
        try {
            const response = await fetch(`/api/dashboard/atendentes/${id}`, {
                method:  'DELETE',
                headers: { 'Authorization': `Bearer ${store.getToken()}` }
            });
            if (response.ok) {
                alert("Trabalhador removido");
                await atualizarTrabalhadores();
            } else {
                alert("Erro ao remover trabalhador");
            }
        } catch (error) {
            console.error("❌ Erro:", error);
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
