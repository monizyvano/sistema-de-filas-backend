/**
 * static/js/dashusuario.js — Sprint 3
 * ═══════════════════════════════════════════════════════════════
 * FONTE ÚNICA de lógica do painel do utente.
 *
 * CORRECÇÕES em relação à versão anterior:
 *   ✅ Não usa requireRole (devolvia boolean, não sessão)
 *   ✅ Usa getUser() directamente — lida com utente anónimo
 *   ✅ Não duplica lógica com script inline do index.html
 *   ✅ Limpeza de localStorage antes de tentar acompanhar senha
 *      antiga — elimina o 404 de senhas de dias anteriores
 *   ✅ Serviços carregados da API real (/api/servicos)
 *   ✅ Última chamada geral com polling a cada 5s
 *   ✅ Acompanhamento de posição na fila com polling a cada 10s
 *   ✅ Identificação de utente antes de emitir (opcional)
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
    "use strict";

    /* ── Referências ao estado global ─────────────────────────── */
    const store     = window.IMTSBStore;
    const ApiClient = window.ApiClient;

    /* ── Estado local ─────────────────────────────────────────── */
    let servicoSelecionado   = null;    // objecto Servico da API
    let minhaSenha           = null;    // objecto Senha da última emissão
    let pollingGeral         = null;    // intervalo 5s (stats + última chamada)
    let pollingAcompanhamento = null;   // intervalo 10s (posição na fila)

    /* ── Chave do localStorage ─────────────────────────────────── */
    const STORAGE_KEY = 'imtsb_minha_senha';

    const ANGOLA_TZ = 'Africa/Luanda';

    function resolverNomeAtendente(atendente) {
        if (!atendente) return 'atendente';
        if (typeof atendente === 'string') return atendente;
        if (typeof atendente === 'object') return atendente.nome || atendente.name || 'atendente';
        return 'atendente';
    }

    function formatHoraLuanda(value) {
        if (!value) return '--:--';
        return new Date(value).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone: ANGOLA_TZ });
    }

    /* ══════════════════════════════════════════════════════════════
       INICIALIZAÇÃO
    ══════════════════════════════════════════════════════════════ */

    document.addEventListener('DOMContentLoaded', () => {
        console.log("✅ dashusuario.js Sprint 3 carregado");

        configurarHeader();
        configurarBotoes();
        carregarServicos();
        atualizarEstatisticas();
        atualizarUltimaChamada();
        restaurarSenhaGuardada();  // ← limpa senhas antigas automaticamente
        iniciarPollingGeral();
    });

    /* ══════════════════════════════════════════════════════════════
       HEADER E DADOS DO UTILIZADOR
    ══════════════════════════════════════════════════════════════ */

    function configurarHeader() {
        const user        = store.getUser();
        const profileName = document.getElementById('userProfileName');
        const dadoNome    = document.getElementById('dadoNome');
        const dadoEmail   = document.getElementById('dadoEmail');
        const dadoPerfil  = document.getElementById('dadoPerfil');
        const btnSair     = document.getElementById('btnSair');

        if (user) {
            // Utilizador autenticado
            if (profileName) profileName.textContent = `Bem-vindo, ${user.name}`;
            if (dadoNome)    dadoNome.textContent    = user.name  || '—';
            if (dadoEmail)   dadoEmail.textContent   = user.email || '—';
            if (dadoPerfil)  dadoPerfil.textContent  = user.role  || '—';
            if (btnSair)     btnSair.textContent      = 'Sair';
        } else {
            // Modo anónimo — utente não identificado
            if (profileName) profileName.textContent = 'Bem-vindo';
            if (dadoNome)    dadoNome.textContent    = 'Visitante';
            if (dadoEmail)   dadoEmail.textContent   = 'Não identificado';
            if (dadoPerfil)  dadoPerfil.textContent  = 'Público';
            if (btnSair)     btnSair.textContent      = 'Entrar';
        }
    }

    /* ══════════════════════════════════════════════════════════════
       BOTÕES
    ══════════════════════════════════════════════════════════════ */

    function configurarBotoes() {
        /* Botão emitir senha */
        const btnEmitir = document.getElementById('btnEmitirSenha');
        if (btnEmitir) btnEmitir.addEventListener('click', emitirSenha);

        /* Botão sair / entrar */
        const btnSair = document.getElementById('btnSair');
        if (btnSair) {
            btnSair.addEventListener('click', () => {
                const user = store.getUser();
                if (user) {
                    pararPollings();
                    localStorage.removeItem(STORAGE_KEY);
                    store.logout();
                } else {
                    window.location.href = '/login';
                }
            });
        }

        /* Painel meus dados */
        const btnDados   = document.getElementById('btnMeusDados');
        const painel     = document.getElementById('meusDadosPanel');
        const btnFechar  = document.getElementById('btnFecharDados');

        if (btnDados && painel) {
            btnDados.addEventListener('click', () => {
                painel.classList.add('aberto');
            });
        }
        if (btnFechar && painel) {
            btnFechar.addEventListener('click', () => {
                painel.classList.remove('aberto');
            });
        }
    }

    /* ══════════════════════════════════════════════════════════════
       SERVIÇOS — carregados da API
    ══════════════════════════════════════════════════════════════ */

    async function carregarServicos() {
        const container = document.getElementById('servicesList');
        if (!container) return;

        try {
            const resp = await fetch('/api/servicos');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

            const servicos = await resp.json();
            const lista    = Array.isArray(servicos) ? servicos : (servicos.servicos || []);

            if (lista.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted);">Sem serviços disponíveis.</p>';
                return;
            }

            container.innerHTML = '';

            lista.forEach(servico => {
                const card = document.createElement('article');
                card.className        = 'service-card';
                card.dataset.servicoId = servico.id;
                card.innerHTML = `
                  <div class="service-icon">${servico.icone || '📄'}</div>
                  <div class="service-info">
                    <div class="service-name">${servico.nome}</div>
                    <div class="service-status">
                      <span class="status-dot"></span>
                      ${servico.descricao || 'Serviço disponível'}
                    </div>
                  </div>
                  <span class="arrow-icon">→</span>
                `;
                card.addEventListener('click', () => selecionarServico(servico, card));
                container.appendChild(card);
            });

            console.log(`✅ ${lista.length} serviços carregados`);

        } catch (erro) {
            console.error("❌ Erro ao carregar serviços:", erro);
            container.innerHTML = '<p style="color: var(--text-muted);">Erro ao carregar serviços.</p>';
        }
    }

    function selecionarServico(servico, cardEl) {
        servicoSelecionado = servico;

        // Realçar o card seleccionado
        document.querySelectorAll('.service-card').forEach(c => {
            c.classList.remove('ativo');
        });
        if (cardEl) cardEl.classList.add('ativo');

        mostrarMensagem(`Serviço seleccionado: ${servico.nome}`, 'ok');
    }

    /* ══════════════════════════════════════════════════════════════
       EMISSÃO DE SENHA
    ══════════════════════════════════════════════════════════════ */

    async function emitirSenha() {
        if (!servicoSelecionado) {
            mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
            return;
        }

        const btnEmitir = document.getElementById('btnEmitirSenha');
        if (btnEmitir) {
            btnEmitir.disabled    = true;
            btnEmitir.textContent = 'A emitir...';
        }

        mostrarMensagem('⏳ A emitir senha...', '');

        try {
            const resp = await fetch('/api/senhas/emitir', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    servico_id: servicoSelecionado.id,
                    tipo:       'normal'
                })
            });

            const dados = await resp.json();

            if (!resp.ok) {
                mostrarMensagem(`❌ ${dados.erro || 'Erro ao emitir senha'}`, 'warn');
                return;
            }

            // Guardar a senha emitida
            minhaSenha = dados.senha;
            guardarSenhaLocal(minhaSenha);

            mostrarMensagem(`✅ Senha emitida: ${minhaSenha.numero}`, 'ok');
            atualizarDisplaySenha();
            iniciarAcompanhamento(minhaSenha.numero);

            // Actualizar estatísticas imediatamente
            await atualizarEstatisticas();

        } catch (erro) {
            console.error("❌ Erro ao emitir senha:", erro);
            mostrarMensagem('❌ Erro de ligação ao servidor', 'warn');
        } finally {
            if (btnEmitir) {
                btnEmitir.disabled    = false;
                btnEmitir.textContent = 'Emitir Senha';
            }
        }
    }

    /* ══════════════════════════════════════════════════════════════
       DISPLAY DA SENHA ACTUAL
    ══════════════════════════════════════════════════════════════ */

    function atualizarDisplaySenha() {
        const numEl    = document.getElementById('currentTicket');
        const statusEl = document.getElementById('currentStatus');
        const tracker  = document.getElementById('ticketTracker');

        if (!minhaSenha) {
            if (numEl)    numEl.textContent    = '---';
            if (statusEl) statusEl.textContent = 'Aguardando';
            if (tracker)  tracker.style.display = 'none';
            return;
        }

        if (numEl)    numEl.textContent    = minhaSenha.numero;
        if (statusEl) statusEl.textContent = traduzirStatus(minhaSenha.status);
        if (tracker)  tracker.style.display = 'block';
    }

    /* ══════════════════════════════════════════════════════════════
       ACOMPANHAMENTO DE POSIÇÃO NA FILA
    ══════════════════════════════════════════════════════════════ */

    function iniciarAcompanhamento(numeroSenha) {
        pararAcompanhamento();

        const tracker = document.getElementById('ticketTracker');
        if (tracker) tracker.style.display = 'block';

        // Actualizar imediatamente e depois a cada 10s
        actualizarPosicao(numeroSenha);
        pollingAcompanhamento = setInterval(
            () => actualizarPosicao(numeroSenha),
            10000
        );
    }

    function pararAcompanhamento() {
        if (pollingAcompanhamento) {
            clearInterval(pollingAcompanhamento);
            pollingAcompanhamento = null;
        }
    }

    async function actualizarPosicao(numeroSenha) {
        const posEl    = document.getElementById('trackerPosicao');
        const tempoEl  = document.getElementById('trackerTempo');
        const estadoEl = document.getElementById('trackerEstado');

        try {
            const resp = await fetch(
                `/api/dashboard/public/senha/${encodeURIComponent(numeroSenha)}`
            );

            if (resp.status === 404) {
                // Senha não encontrada hoje — pode ser do dia anterior
                // Limpar localStorage e parar acompanhamento
                console.warn(`[acompanhamento] Senha ${numeroSenha} não encontrada hoje — a limpar`);
                limparSenhaLocal();
                pararAcompanhamento();
                return;
            }

            if (!resp.ok) return;

            const dados = await resp.json();

            if (dados.status === 'aguardando') {
                if (posEl)    posEl.textContent    = dados.posicao || '–';
                if (tempoEl)  tempoEl.textContent  = dados.tempo_espera_estimado > 0
                    ? `${Math.round(dados.tempo_espera_estimado)}m` : '–';
                if (estadoEl) estadoEl.textContent = 'A aguardar';

            } else if (dados.status === 'atendendo') {
                if (posEl)    posEl.textContent    = '🔔';
                if (tempoEl)  tempoEl.textContent  = 'É a sua vez!';
                const nomeAtendente = resolverNomeAtendente(dados.atendente);
                if (estadoEl) estadoEl.textContent = `Dirija-se ao Balcão ${dados.balcao || '—'} com o atendente ${nomeAtendente}`;
                mostrarMensagem(`✅ Senha ${dados.numero}: dirija-se ao Balcão ${dados.balcao || '—'} com o atendente ${nomeAtendente}.`, 'ok');
                pararAcompanhamento();

            } else if (dados.status === 'concluida' || dados.status === 'cancelada') {
                if (estadoEl) estadoEl.textContent = traduzirStatus(dados.status);
                pararAcompanhamento();
                // Limpar depois de 5s para não poluir o ecrã
                setTimeout(() => {
                    limparSenhaLocal();
                    atualizarDisplaySenha();
                }, 5000);
            }

        } catch (erro) {
            console.error('[actualizarPosicao] Erro:', erro);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       ESTATÍSTICAS GERAIS
    ══════════════════════════════════════════════════════════════ */

    async function atualizarEstatisticas() {
        try {
            const resp = await fetch('/api/senhas/estatisticas');
            if (!resp.ok) return;

            const stats = await resp.json();

            const filaEl  = document.getElementById('statFila');
            const tempoEl = document.getElementById('statTempo');
            const doneEl  = document.getElementById('statDone');
            const satEl   = document.getElementById('statSat');

            if (filaEl)  filaEl.textContent  = stats.aguardando || 0;
            if (tempoEl) tempoEl.textContent  = `${Math.round(stats.tempo_medio_espera || 0)}m`;
            if (doneEl)  doneEl.textContent   = stats.concluidas || 0;

            // Taxa de conclusão: concluídas / total emitidas
            if (satEl) {
                const total    = stats.total_emitidas || 0;
                const conclui  = stats.concluidas     || 0;
                satEl.textContent = total > 0
                    ? `${Math.round((conclui / total) * 100)}%`
                    : '—';
            }

        } catch (erro) {
            console.error("❌ Erro ao actualizar estatísticas:", erro);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       ÚLTIMA CHAMADA GERAL
    ══════════════════════════════════════════════════════════════ */

    async function atualizarUltimaChamada() {
        const numEl    = document.getElementById('ultimaChamada');
        const balcaoEl = document.getElementById('ultimoBalcao');

        try {
            // Busca senhas em atendimento, sem trailing slash problemático
            const resp = await fetch('/api/senhas?status=atendendo&per_page=1&page=1');
            if (!resp.ok) return;

            const dados  = await resp.json();
            const senhas = dados.senhas || [];

            if (senhas.length > 0) {
                const s = senhas[0];
                const nomeAt = resolverNomeAtendente(s.atendente);
                if (numEl)    numEl.textContent    = s.numero;
                if (balcaoEl) balcaoEl.textContent = s.numero_balcao
                    ? `Balcão ${s.numero_balcao} · ${nomeAt}` : nomeAt;
            } else {
                if (numEl)    numEl.textContent    = '---';
                if (balcaoEl) balcaoEl.textContent = '—';
            }

        } catch (erro) {
            console.error("❌ Erro ao actualizar última chamada:", erro);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       LOCALSTORAGE — senha guardada entre sessões
       FIX: valida se a senha é de hoje antes de restaurar
    ══════════════════════════════════════════════════════════════ */

    function guardarSenhaLocal(senha) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(senha));
        } catch (_) { /* silencioso — localStorage pode estar desactivado */ }
    }

    function limparSenhaLocal() {
        localStorage.removeItem(STORAGE_KEY);
        minhaSenha = null;
    }

    function restaurarSenhaGuardada() {
        try {
            const guardada = localStorage.getItem(STORAGE_KEY);
            if (!guardada) return;

            const senha = JSON.parse(guardada);

            // FIX DO 404: verificar se a data_emissao é de hoje
            // Senhas de dias anteriores são descartadas automaticamente
            const hoje        = new Date().toISOString().split('T')[0]; // "2026-03-20"
            const dataEmissao = senha.data_emissao || '';

            if (dataEmissao !== hoje) {
                console.info(
                    `[restaurar] Senha ${senha.numero} é de ${dataEmissao}, ` +
                    `hoje é ${hoje} — a descartar`
                );
                limparSenhaLocal();
                return;
            }

            // Senha é de hoje — restaurar
            minhaSenha = senha;
            atualizarDisplaySenha();

            // Se ainda não estava concluída, retomar acompanhamento
            if (!['concluida', 'cancelada'].includes(senha.status)) {
                iniciarAcompanhamento(senha.numero);
            }

            console.info(`[restaurar] Senha ${senha.numero} restaurada`);

        } catch (erro) {
            // JSON inválido ou outra falha — limpar tudo
            console.warn('[restaurar] Erro ao restaurar senha:', erro);
            limparSenhaLocal();
        }
    }

    /* ══════════════════════════════════════════════════════════════
       POLLING GERAL — estatísticas + última chamada
    ══════════════════════════════════════════════════════════════ */

    function iniciarPollingGeral() {
        pararPollingGeral();
        pollingGeral = setInterval(async () => {
            await atualizarEstatisticas();
            await atualizarUltimaChamada();
        }, 5000);
    }

    function pararPollingGeral() {
        if (pollingGeral) {
            clearInterval(pollingGeral);
            pollingGeral = null;
        }
    }

    function pararPollings() {
        pararPollingGeral();
        pararAcompanhamento();
    }

    /* ══════════════════════════════════════════════════════════════
       UTILITÁRIOS
    ══════════════════════════════════════════════════════════════ */

    function mostrarMensagem(texto, tipo) {
        const el = document.getElementById('ticketMessage');
        if (!el) return;
        el.textContent  = texto;
        el.className    = 'ticket-message';
        if (tipo) el.classList.add(tipo);

        // Limpar automaticamente após 6 segundos
        if (tipo === 'ok') {
            setTimeout(() => {
                if (el.textContent === texto) el.textContent = '';
            }, 6000);
        }
    }

    function traduzirStatus(status) {
        const mapa = {
            'aguardando': 'A aguardar',
            'chamada':    'Chamada',
            'atendendo':  'Em atendimento',
            'concluida':  'Concluída',
            'cancelada':  'Cancelada'
        };
        return mapa[status] || status;
    }

})();
