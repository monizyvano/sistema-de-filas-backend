/**
 * static/js/dash.js — Sprint 1 (corrigido)
 * ═══════════════════════════════════════════════════════════════
 * Dashboard do Trabalhador (atendente).
 *
 * CORRECÇÕES SPRINT 1:
 *   ✅ concludeAttendance() ligado a PUT /api/filas/concluir/:id
 *   ✅ Botão Concluir activa/desactiva conforme estado da senha
 *   ✅ Removido fallback perigoso user.servico_id || 1
 *      — agora mostra erro claro se atendente mal configurado
 *   ✅ Histórico usa paginação server-side (per_page=10)
 *   ✅ Toda documentação em pt-pt
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const store     = window.IMTSBStore;
    const ApiClient = window.ApiClient;

    /** Senha actualmente em atendimento (objecto completo do backend) */
    let senhaAtual      = null;

    /** ID do intervalo do cronómetro de atendimento */
    let timerInterval   = null;

    /** ID do intervalo de polling de estatísticas */
    let pollingInterval = null;


    // ═══════════════════════════════════════════════════════════
    // INICIALIZAÇÃO
    // ═══════════════════════════════════════════════════════════

    document.addEventListener('DOMContentLoaded', async () => {
        console.log("✅ Dashboard trabalhador carregado — Sprint 1");

        if (!store.isLoggedIn()) {
            window.location.href = '/login';
            return;
        }

        const user = store.getUser();
        if (user.role !== 'trabalhador' && user.role !== 'admin') {
            alert("Acesso negado. Apenas trabalhadores podem aceder a este painel.");
            window.location.href = '/';
            return;
        }

        await carregarDadosTrabalhador();
        await atualizarEstatisticas();
        await atualizarHistorico();
        iniciarPolling();
        actualizarBotaoConcluir(); // garante estado inicial correcto
    });


    // ═══════════════════════════════════════════════════════════
    // CARREGAR DADOS DO TRABALHADOR
    // ═══════════════════════════════════════════════════════════

    /**
     * Preenche o cabeçalho com dados do utilizador autenticado.
     * Usa JWT claims: nome, balcao, departamento.
     */
    async function carregarDadosTrabalhador() {
        const user = store.getUser();

        const workerName   = document.getElementById('workerName');
        const workerDept   = document.getElementById('workerDept');
        const workerAvatar = document.getElementById('workerAvatar');
        const counterBadge = document.getElementById('counterBadge');

        if (workerName)   workerName.textContent   = user.name || 'Trabalhador';
        if (workerDept)   workerDept.textContent   = user.departamento || 'Atendimento';

        if (workerAvatar) {
            // Iniciais do nome: "João Silva" → "JS"
            const iniciais = (user.name || 'T')
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
            workerAvatar.textContent = iniciais;
        }

        if (counterBadge) {
            const balcao = user.balcao || user.numero_balcao;
            counterBadge.textContent = balcao
                ? `Balcão ${balcao}`
                : 'Sem balcão';
        }
    }


    // ═══════════════════════════════════════════════════════════
    // ACTUALIZAR ESTATÍSTICAS
    // ═══════════════════════════════════════════════════════════

    /**
     * Busca estatísticas do trabalhador via endpoint autenticado.
     * Em caso de 401, faz logout automático.
     */
    async function atualizarEstatisticas() {
        try {
            const response = await fetch(
                '/api/dashboard/trabalhador/estatisticas',
                { headers: { 'Authorization': `Bearer ${store.getToken()}` } }
            );

            if (response.status === 401) {
                console.warn("Token expirado — redirecionando para login");
                store.logout();
                window.location.href = '/login';
                return;
            }

            if (!response.ok) {
                console.warn("Erro ao buscar estatísticas:", response.status);
                return;
            }

            const stats = await response.json();

            const waitingCount = document.getElementById('waitingCount');
            const servedToday  = document.getElementById('servedToday');
            const avgTime      = document.getElementById('avgTime');

            if (waitingCount) waitingCount.textContent = stats.aguardando        || '0';
            if (servedToday)  servedToday.textContent  = stats.atendidos_hoje    || '0';
            if (avgTime)      avgTime.textContent       =
                `~${stats.tempo_medio_atendimento || 0}min`;

        } catch (error) {
            console.error("❌ Erro ao actualizar estatísticas:", error);
        }
    }


    // ═══════════════════════════════════════════════════════════
    // HISTÓRICO — paginação server-side
    // ═══════════════════════════════════════════════════════════

    /**
     * Carrega as últimas 10 senhas concluídas pelo atendente logado.
     * Usa page=1&per_page=10 — não carrega o histórico todo.
     */
    async function atualizarHistorico() {
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
                const tsStr  = senha.atendimento_concluido_em || senha.created_at;
                const hora   = tsStr
                    ? new Date(tsStr).toLocaleTimeString('pt-PT',
                        { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                const duracao = senha.tempo_atendimento_minutos || 0;
                const servico = senha.servico?.nome || '';

                return `<div class="log-item completed">
                    <div class="log-password">${senha.numero} ${servico ? '— ' + servico : ''}</div>
                    <div class="log-time">${hora} · ${duracao}min</div>
                </div>`;
            }).join('');

        } catch (error) {
            console.error("❌ Erro ao actualizar histórico:", error);
        }
    }
  } else if (window.IMTSBStore) {
    result = await window.IMTSBStore.callNext(servicoId, balcao);
  } else {
    result = { ok: false, message: "API não disponível" };
  }


    // ═══════════════════════════════════════════════════════════
    // CHAMAR PRÓXIMA — Sprint 1 (sem fallback perigoso)
    // ═══════════════════════════════════════════════════════════

    /**
     * Chama a próxima senha da fila para este atendente.
     *
     * CORRECÇÃO SPRINT 1:
     * Removido o fallback user.servico_id || 1.
     * Se o atendente não tiver servico_id configurado, mostra
     * mensagem de erro clara em vez de chamar o serviço 1 por engano.
     */
    window.callNextCustomer = async function () {
        const user    = store.getUser();
        const btnNext = document.querySelector('.btn-next');

        // ── Validação: atendente deve ter servico_id configurado ──────
        const servicoId = user.servico_id;
        if (!servicoId) {
            alert(
                "Este atendente não tem serviço configurado.\n\n" +
                "Contacte o administrador para atribuir um serviço ao seu perfil."
            );
            return;
        }

        // ── Validação: atendente deve ter balcão configurado ──────────
        const balcao = user.balcao || user.numero_balcao;
        if (!balcao) {
            alert(
                "Este atendente não tem balcão configurado.\n\n" +
                "Contacte o administrador para atribuir um balcão ao seu perfil."
            );
            return;
        }

        console.log(`[callNext] servico_id=${servicoId} | balcao=${balcao}`);

        if (btnNext) {
            btnNext.disabled    = true;
            btnNext.textContent = 'A chamar...';
        }

        try {
            const result = await store.callNext(servicoId, balcao);

            if (result.ok && result.senha) {
                senhaAtual = result.senha;

                // Guardar ID da senha no campo oculto para o botão Concluir
                const campoId = document.getElementById('currentSenhaId');
                if (campoId) campoId.value = senhaAtual.id || '';

                atualizarDisplayAtual(senhaAtual);
                actualizarBotaoConcluir();
                pararTimer();
                iniciarTimer();

                await atualizarHistorico();
                await atualizarEstatisticas();

                console.log(`✅ Senha ${senhaAtual.numero} chamada com sucesso!`);

            } else {
                alert(result.message || "Não há senhas a aguardar para este serviço.");
            }

        } catch (error) {
            console.error("❌ Erro ao chamar próxima:", error);
            alert("Erro ao chamar próxima senha. Tente novamente.");
        } finally {
            if (btnNext) {
                btnNext.disabled    = false;
                btnNext.textContent = 'Chamar Próximo';
            }
        }
    };


    // ═══════════════════════════════════════════════════════════
    // CONCLUIR ATENDIMENTO — NOVO Sprint 1
    // ═══════════════════════════════════════════════════════════

    /**
     * Conclui o atendimento da senha actualmente em curso.
     *
     * Chama PUT /api/filas/concluir/:id com o token JWT.
     * Após conclusão, limpa o display e actualiza estatísticas.
     */
    window.concludeAttendance = async function () {
        const campoId  = document.getElementById('currentSenhaId');
        const senhaId  = campoId ? campoId.value : null;
        const btnConc  = document.getElementById('btnConcluir');

        if (!senhaId) {
            alert("Nenhuma senha em atendimento para concluir.");
            return;
        }

        // Confirmação opcional para evitar cliques acidentais
        const confirmar = confirm(
            `Confirma a conclusão do atendimento da senha ${senhaAtual?.numero || senhaId}?`
        );
        if (!confirmar) return;

        if (btnConc) {
            btnConc.disabled    = true;
            btnConc.textContent = 'A concluir...';
        }

        try {
            const response = await fetch(`/api/filas/concluir/${senhaId}`, {
                method:  'PUT',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${store.getToken()}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                console.log(`✅ Atendimento concluído — senha ${senhaAtual?.numero}`);

                // Limpar estado local
                senhaAtual = null;
                if (campoId) campoId.value = '';

                // Limpar display
                limparDisplayAtual();
                pararTimer();
                actualizarBotaoConcluir();

                // Actualizar dados
                await atualizarHistorico();
                await atualizarEstatisticas();

            } else {
                const erro = data.erro || data.message || "Erro ao concluir atendimento";
                alert(`Erro: ${erro}`);
                console.error("❌ Erro ao concluir:", data);
            }

        } catch (error) {
            console.error("❌ Erro ao concluir atendimento:", error);
            alert("Erro de ligação ao servidor. Tente novamente.");
        } finally {
            if (btnConc) {
                btnConc.disabled    = false;
                btnConc.textContent = 'Concluir';
            }
        }
    };


    // ═══════════════════════════════════════════════════════════
    // ACTUALIZAR DISPLAY DO ATENDIMENTO ACTUAL
    // ═══════════════════════════════════════════════════════════

    /**
     * Preenche os campos de informação com os dados da senha chamada.
     * @param {Object} senha - Objecto senha devolvido pelo backend
     */
    function atualizarDisplayAtual(senha) {
        const currentPassword = document.getElementById('currentPassword');
        const passwordType    = document.getElementById('passwordType');
        const serviceValue    = document.getElementById('serviceValue');
        const waitTime        = document.getElementById('waitTime');
        const issuedAt        = document.getElementById('issuedAt');
        const obsValue        = document.getElementById('obsValue');
        const statusText      = document.getElementById('statusText');

        if (currentPassword) {
            currentPassword.textContent = senha.numero;
        }

        if (passwordType) {
            passwordType.textContent = senha.tipo === 'prioritaria'
                ? 'Atendimento Prioritário'
                : 'Atendimento Normal';
        }

        if (serviceValue) {
            serviceValue.textContent = senha.servico?.nome || 'Serviço Geral';
        }

        if (waitTime) {
            const tempo = senha.tempo_espera_minutos || 0;
            waitTime.textContent = `${tempo} min`;
        }

        if (issuedAt && senha.emitida_em) {
            const hora = new Date(senha.emitida_em).toLocaleTimeString('pt-PT', {
                hour: '2-digit', minute: '2-digit'
            });
            issuedAt.textContent = hora;
        }

        if (obsValue) {
            obsValue.textContent = senha.observacoes || 'Sem observações';
        }

        if (statusText) {
            statusText.textContent = 'Em Atendimento';
        }

        // Actualizar badge do balcão no cabeçalho
        const counterBadge = document.getElementById('counterBadge');
        if (counterBadge) {
            const user   = store.getUser();
            const balcao = user.balcao || user.numero_balcao;
            counterBadge.textContent = balcao ? `Balcão ${balcao}` : 'Balcão';
        }
    }

    /**
     * Limpa o display após conclusão ou cancelamento do atendimento.
     */
    function limparDisplayAtual() {
        const campos = {
            currentPassword: '---',
            passwordType:    'Aguardando chamada',
            serviceValue:    '-',
            waitTime:        '-',
            issuedAt:        '-',
            obsValue:        'Sem observações',
            statusText:      'Disponível'
        };

        Object.entries(campos).forEach(([id, valor]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = valor;
        });

        // Limpar timer
        const timer = document.getElementById('timer');
        if (timer) timer.textContent = '00:00';
    }


    // ═══════════════════════════════════════════════════════════
    // CONTROLO DO BOTÃO CONCLUIR
    // ═══════════════════════════════════════════════════════════

    /**
     * Activa ou desactiva o botão Concluir conforme o estado.
     * O botão só fica activo quando há uma senha em atendimento.
     */
    function actualizarBotaoConcluir() {
        const btnConc = document.getElementById('btnConcluir');
        if (!btnConc) return;

        const temSenha = senhaAtual !== null;
        btnConc.disabled = !temSenha;
        btnConc.title    = temSenha
            ? `Concluir atendimento da senha ${senhaAtual.numero}`
            : 'Disponível apenas com senha em atendimento';
    }


    // ═══════════════════════════════════════════════════════════
    // CRONÓMETRO DE ATENDIMENTO
    // ═══════════════════════════════════════════════════════════

    /**
     * Inicia o cronómetro de atendimento.
     * Actualiza o elemento #timer a cada segundo.
     */
    function iniciarTimer() {
        pararTimer();
        let segundos = 0;

        timerInterval = setInterval(() => {
            segundos++;
            const min     = Math.floor(segundos / 60);
            const seg     = segundos % 60;
            const display = `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;

            const timerEl = document.getElementById('timer');
            if (timerEl) timerEl.textContent = display;
        }, 1000);
    }

    /** Para e limpa o cronómetro de atendimento. */
    function pararTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }


    // ═══════════════════════════════════════════════════════════
    // POLLING
    // ═══════════════════════════════════════════════════════════

    /** Inicia polling de estatísticas a cada 10 segundos. */
    function iniciarPolling() {
        pararPolling();
        pollingInterval = setInterval(async () => {
            await atualizarEstatisticas();
        }, 10000);
    }

    /** Para o polling de estatísticas. */
    function pararPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }


    // ═══════════════════════════════════════════════════════════
    // FUNÇÕES GLOBAIS — chamadas pelo HTML via onclick
    // ═══════════════════════════════════════════════════════════

    window.togglePause = function () {
        const pauseBtn = document.getElementById('pauseBtn');
        if (!pauseBtn) return;

        const estaPausado = pauseBtn.textContent.trim() === 'Retomar';
        if (estaPausado) {
            pauseBtn.textContent = 'Pausar';
            iniciarPolling();
        } else {
            pauseBtn.textContent = 'Retomar';
            pararPolling();
            pararTimer();
        }
    };

    window.redirectCustomer = function () {
        if (!senhaAtual) {
            alert("Nenhuma senha em atendimento para reencaminhar.");
            return;
        }
        const novoBalcao = prompt(
            `Reencaminhar senha ${senhaAtual.numero} para qual balcão?`
        );
        if (novoBalcao) {
            alert(`Senha ${senhaAtual.numero} reencaminhada para balcão ${novoBalcao}.\n(Funcionalidade completa em Sprint 2)`);
        }
    };

    window.addObservation = function () {
        if (!senhaAtual) {
            alert("Nenhuma senha em atendimento.");
            return;
        }
        const obs = prompt("Adicionar observação ao atendimento:");
        if (obs) {
            senhaAtual.observacoes = obs;
            const obsValue = document.getElementById('obsValue');
            if (obsValue) obsValue.textContent = obs;
        }
    };

    window.requestDocuments = function () {
        alert("Consulta de documentos em desenvolvimento.");
    };

    window.sendReceipt = function () {
        if (!senhaAtual) {
            alert("Nenhuma senha em atendimento para gerar recibo.");
            return;
        }
        const format = document.getElementById('receiptFormat')?.value || 'pdf';
        alert(`Recibo gerado em formato ${format.toUpperCase()} para senha ${senhaAtual.numero}.`);
    };

    window.showStatistics = function () {
        window.location.href = '/dashadm.html';
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
