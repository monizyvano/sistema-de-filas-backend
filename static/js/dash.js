/**
 * static/js/dash.js — SPRINT 1
 * ═══════════════════════════════════════════════════════════════
 * Dashboard do Trabalhador (atendente).
 *
 * CORRECÇÕES:
 *   ✅ callNext usa user.servico_id real (não fixo = 1).
 *      Fallback para 1 apenas se servico_id for null.
 *   ✅ Histórico usa paginação server-side (per_page=10).
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const store     = window.IMTSBStore;
    const ApiClient = window.ApiClient;

    let senhaAtual      = null;
    let timerInterval   = null;
    let pollingInterval = null;


    // ═══════════════════════════════════════════════════════════
    // 🎬 INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', async () => {
        console.log("✅ Dashboard trabalhador carregado (Sprint 1)");

        if (!store.isLoggedIn()) {
            window.location.href = '/login';
            return;
        }

        const user = store.getUser();
        if (user.role !== 'trabalhador' && user.role !== 'admin') {
            alert("Acesso negado. Apenas trabalhadores podem aceder.");
            window.location.href = '/';
            return;
        }

        await carregarDadosTrabalhador();
        await atualizarEstatisticas();
        await atualizarHistorico();
        iniciarPolling();
    });


    // ═══════════════════════════════════════════════════════════
    // 👤 CARREGAR DADOS DO TRABALHADOR
    // ═══════════════════════════════════════════════════════════

    async function carregarDadosTrabalhador() {
        const user = store.getUser();

        const workerName   = document.getElementById('workerName');
        const workerDept   = document.getElementById('workerDept');
        const workerAvatar = document.getElementById('workerAvatar');
        const counterBadge = document.getElementById('counterBadge');

        if (workerName)   workerName.textContent   = user.name || 'Trabalhador';
        if (workerDept)   workerDept.textContent   = user.departamento || 'Atendimento';

        if (workerAvatar) {
            const initials = (user.name || 'T')
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            workerAvatar.textContent = initials;
        }

        if (counterBadge) {
            counterBadge.textContent =
                `Balcão ${user.balcao || user.numero_balcao || 1}`;
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 📊 ATUALIZAR ESTATÍSTICAS
    // ═══════════════════════════════════════════════════════════

    async function atualizarEstatisticas() {
        try {
            const response = await fetch(
                '/api/dashboard/trabalhador/estatisticas',
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );

            if (response.status === 401) {
                store.logout();
                window.location.href = '/login';
                return;
            }
            if (!response.ok) return;

            const stats = await response.json();

            const waitingCount = document.getElementById('waitingCount');
            const servedToday  = document.getElementById('servedToday');
            const avgTime      = document.getElementById('avgTime');

            if (waitingCount) waitingCount.textContent = stats.aguardando       || '0';
            if (servedToday)  servedToday.textContent  = stats.atendidos_hoje   || '0';
            if (avgTime)      avgTime.textContent       =
                `~${stats.tempo_medio_atendimento || 0}min`;

        } catch (error) {
            console.error("❌ Erro ao atualizar estatísticas:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 📜 HISTÓRICO — paginação server-side (SPRINT 1)
    // ═══════════════════════════════════════════════════════════

    async function atualizarHistorico() {
        /**
         * SPRINT 1: pede apenas as últimas 10 senhas do atendente logado.
         * Usa page=1&per_page=10 — server-side, não carrega tudo.
         */
        try {
            const user = store.getUser();

            const response = await fetch(
                `/api/senhas?atendente_id=${user.id}&status=concluida&page=1&per_page=10`,
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );

            if (response.status === 401) {
                store.logout();
                window.location.href = '/login';
                return;
            }
            if (!response.ok) return;

            const data   = await response.json();
            const senhas = data.senhas || [];

            const activityLog = document.getElementById('activityLog');
            if (!activityLog) return;

            if (senhas.length === 0) {
                activityLog.innerHTML =
                    '<div class="log-item">' +
                    '<div class="log-password">Nenhum atendimento hoje</div>' +
                    '</div>';
                return;
            }

            activityLog.innerHTML = senhas.map(senha => {
                const tsStr = senha.atendimento_concluido_em || senha.created_at;
                const hora  = tsStr
                    ? new Date(tsStr).toLocaleTimeString('pt-PT',
                        { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                const duracao = senha.tempo_atendimento_minutos || 0;

                return `<div class="log-item completed">
                    <div class="log-password">Senha ${senha.numero}</div>
                    <div class="log-time">${hora} · ${duracao}min</div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error("❌ Erro ao atualizar histórico:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 📞 CHAMAR PRÓXIMA — SPRINT 1 (corrigido)
    // ═══════════════════════════════════════════════════════════

    window.callNextCustomer = async function () {
        /**
         * SPRINT 1: usa user.servico_id real.
         *
         * ANTES:  store.callNext(1, balcao)  ← BUG: fixo em 1
         * AGORA:  store.callNext(servicoReal, balcao)
         */
        const user    = store.getUser();
        const btnNext = document.querySelector('.btn-next');

        // Ler servico_id real do utilizador autenticado
        const servicoId = user.servico_id || 1;
        const balcao    = user.balcao || user.numero_balcao || 1;

        console.log(`[callNext] servico_id=${servicoId} | balcao=${balcao}`);

        if (btnNext) {
            btnNext.disabled    = true;
            btnNext.textContent = 'A chamar...';
        }

        try {
            const result = await store.callNext(servicoId, balcao);

            if (result.ok && result.senha) {
                senhaAtual = result.senha;
                atualizarDisplayAtual(senhaAtual);
                iniciarTimer();
                await atualizarHistorico();
                console.log(`[SUCCESS] Senha ${senhaAtual.numero} chamada!`);
            } else {
                alert(result.message || "Nenhuma senha aguardando");
            }

        } catch (error) {
            console.error("❌ Erro ao chamar próxima:", error);
            alert("Erro ao chamar próxima senha");
        } finally {
            if (btnNext) {
                btnNext.disabled    = false;
                btnNext.textContent = 'Chamar Próximo';
            }
        }
    };


    // ═══════════════════════════════════════════════════════════
    // 📺 ATUALIZAR DISPLAY ATUAL
    // ═══════════════════════════════════════════════════════════

    function atualizarDisplayAtual(senha) {
    // Número da senha
    const currentPassword = document.getElementById('currentPassword');
    if (currentPassword) {
        currentPassword.textContent     = senha.numero;
        currentPassword.style.animation = 'none';
        void currentPassword.offsetWidth;
        currentPassword.style.animation = 'pulse 1s';
    }

    // Tipo (id correcto do HTML: passwordType)
    const passwordType = document.getElementById('passwordType');
    if (passwordType) {
        passwordType.textContent = senha.tipo === 'prioritaria'
            ? 'Atendimento Prioritário'
            : 'Atendimento Normal';
    }

    // Serviço solicitado
    const serviceValue = document.getElementById('serviceValue');
    if (serviceValue) {
        serviceValue.textContent = senha.servico?.nome || 'Serviço Geral';
    }

    // Tempo de espera
    const waitTime = document.getElementById('waitTime');
    if (waitTime) {
        const tempo = senha.tempo_espera_minutos || 0;
        waitTime.textContent = `${tempo} min`;
    }

    // Hora de emissão
    const issuedAt = document.getElementById('issuedAt');
    if (issuedAt && senha.emitida_em) {
        const hora = new Date(senha.emitida_em).toLocaleTimeString('pt-PT', {
            hour: '2-digit', minute: '2-digit'
        });
        issuedAt.textContent = hora;
    }

    // Observações
    const obsValue = document.getElementById('obsValue');
    if (obsValue) {
        obsValue.textContent = senha.observacoes || 'Sem observações';
    }

    // Balcão no badge do header
    const counterBadge = document.getElementById('counterBadge');
    if (counterBadge) {
        const user = store.getUser();
        counterBadge.textContent = `Balcão ${user.balcao || user.numero_balcao || 1}`;
    }

    // Reiniciar timer
    pararTimer();
    iniciarTimer();
}


// ═══════════════════════════════════════════════════════════
// ⏱️ TIMER — usa id="timer" (correcto para dashtrabalho.html)
// ═══════════════════════════════════════════════════════════

function iniciarTimer() {
    pararTimer();
    let segundos = 0;

    timerInterval = setInterval(() => {
        segundos++;
        const min = Math.floor(segundos / 60);
        const seg = segundos % 60;
        const display = `${String(min).padStart(2,'0')}:${String(seg).padStart(2,'0')}`;

        // ✅ id="timer" — conforme dashtrabalho.html
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = display;
    }, 1000);
}

function pararTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}


    // ═══════════════════════════════════════════════════════════
    // 🔄 POLLING
    // ═══════════════════════════════════════════════════════════

    function iniciarPolling() {
        pararPolling();
        pollingInterval = setInterval(async () => {
            await atualizarEstatisticas();
        }, 10000);
    }

    function pararPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }


    // ═══════════════════════════════════════════════════════════
    // 🌐 FUNÇÕES GLOBAIS (chamadas pelo HTML)
    // ═══════════════════════════════════════════════════════════

    window.togglePause = function () {
        const pauseBtn = document.getElementById('pauseBtn');
        if (!pauseBtn) return;
        const isPaused = pauseBtn.textContent.trim() === 'Retomar';
        if (isPaused) {
            pauseBtn.textContent = 'Pausar';
            iniciarPolling();
        } else {
            pauseBtn.textContent = 'Retomar';
            pararPolling();
            pararTimer();
        }
    };

    window.redirectCustomer = function () {
        if (!senhaAtual) { alert("Nenhuma senha em atendimento"); return; }
        const novoBalcao = prompt(
            `Reencaminhar senha ${senhaAtual.numero} para qual balcão?`);
        if (novoBalcao) {
            alert(`Senha ${senhaAtual.numero} reencaminhada para balcão ${novoBalcao}`);
            // TODO Sprint 2: endpoint de reencaminhamento
        }
    };

    window.addObservation = function () {
        if (!senhaAtual) { alert("Nenhuma senha em atendimento"); return; }
        const obs = prompt("Adicionar observação:");
        if (obs) {
            senhaAtual.observacoes = obs;
            const obsValue = document.getElementById('obsValue');
            if (obsValue) obsValue.textContent = obs;
        }
    };

    window.requestDocuments = function () {
        alert("Função de documentos em desenvolvimento");
    };

    window.sendReceipt = function () {
        if (!senhaAtual) { alert("Nenhuma senha em atendimento"); return; }
        const format = document.getElementById('receiptFormat')?.value || 'pdf';
        alert(`Recibo gerado em formato ${format.toUpperCase()}`);
    };

    window.showStatistics = function () {
        alert("Estatísticas detalhadas em desenvolvimento");
    };

    window.sair = function () {
        if (confirm("Deseja sair do sistema?")) {
            pararPolling();
            pararTimer();
            store.logout();
            window.location.href = '/login';
        }
    };

})();
