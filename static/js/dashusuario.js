/**
 * static/js/dashusuario.js — Opção 1 (identificação opcional)
 * ═══════════════════════════════════════════════════════════════
 * ADIÇÕES em relação ao Sprint 3:
 *
 *   ✅ Modal de identificação opcional antes de emitir senha
 *      - Pede nome + telefone (ambos opcionais)
 *      - Chama POST /api/utentes/registar
 *      - Passa utente_id ao POST /api/senhas/emitir
 *      - Botão "Emitir sem identificar" mantém fluxo anónimo
 *
 *   ✅ Badge de utente identificado
 *      - Aparece acima do botão após identificação
 *      - Botão ✕ limpa a identificação para a próxima emissão
 *
 *   ✅ Identificação persiste durante a sessão (sessionStorage)
 *      - Não persiste entre sessões (localStorage)
 *      - Respeita privacidade: fecha o browser e limpa
 *
 * O resto do código (estatísticas, serviços, acompanhamento,
 * polling, localStorage da senha) é idêntico ao Sprint 3.
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const store     = window.IMTSBStore;
    const ApiClient = window.ApiClient;

    /* ── Estado local ─────────────────────────────────────────── */
    let servicoSelecionado    = null;
    let minhaSenha            = null;
    let utenteActual          = null;   // { utente_id, nome } — sessão actual
    let pollingGeral          = null;
    let pollingAcompanhamento = null;

    const STORAGE_KEY         = 'imtsb_minha_senha';
    const SESSION_UTENTE_KEY  = 'imtsb_utente_sessao';

    /* ══════════════════════════════════════════════════════════════
       INICIALIZAÇÃO
    ══════════════════════════════════════════════════════════════ */

    document.addEventListener('DOMContentLoaded', () => {
        console.log("✅ dashusuario.js Opção 1 carregado");

        configurarHeader();
        configurarBotoes();
        configurarModal();
        carregarServicos();
        atualizarEstatisticas();
        atualizarUltimaChamada();
        restaurarUtenteSession();   // Restaurar identificação da sessão
        restaurarSenhaGuardada();   // Restaurar senha do dia (Sprint 3)
        iniciarPollingGeral();
    });

    /* ══════════════════════════════════════════════════════════════
       HEADER
    ══════════════════════════════════════════════════════════════ */

    function configurarHeader() {
        const user = store.getUser();

        const profileName = document.getElementById('userProfileName');
        const dadoNome    = document.getElementById('dadoNome');
        const dadoEmail   = document.getElementById('dadoEmail');
        const dadoPerfil  = document.getElementById('dadoPerfil');
        const btnSair     = document.getElementById('btnSair');

        if (user) {
            if (profileName) profileName.textContent = `Bem-vindo, ${user.name}`;
            if (dadoNome)    dadoNome.textContent    = user.name  || '—';
            if (dadoEmail)   dadoEmail.textContent   = user.email || '—';
            if (dadoPerfil)  dadoPerfil.textContent  = user.role  || '—';
            if (btnSair)     btnSair.textContent      = 'Sair';
        } else {
            if (profileName) profileName.textContent = 'Bem-vindo';
            if (dadoNome)    dadoNome.textContent    = 'Visitante';
            if (dadoEmail)   dadoEmail.textContent   = 'Não identificado';
            if (dadoPerfil)  dadoPerfil.textContent  = 'Público';
            if (btnSair)     btnSair.textContent      = 'Entrar';
        }
    }

    /* ══════════════════════════════════════════════════════════════
       BOTÕES GERAIS
    ══════════════════════════════════════════════════════════════ */

    function configurarBotoes() {
        /* Botão principal — abre o modal */
        const btnEmitir = document.getElementById('btnEmitirSenha');
        if (btnEmitir) btnEmitir.addEventListener('click', abrirModalOuEmitir);

        /* Botão sair / entrar */
        const btnSair = document.getElementById('btnSair');
        if (btnSair) {
            btnSair.addEventListener('click', () => {
                const user = store.getUser();
                if (user) {
                    pararPollings();
                    localStorage.removeItem(STORAGE_KEY);
                    sessionStorage.removeItem(SESSION_UTENTE_KEY);
                    store.logout();
                } else {
                    window.location.href = '/login';
                }
            });
        }

        /* Painel meus dados */
        const btnDados  = document.getElementById('btnMeusDados');
        const painel    = document.getElementById('meusDadosPanel');
        const btnFechar = document.getElementById('btnFecharDados');
        if (btnDados && painel) btnDados.addEventListener('click', () => painel.classList.add('aberto'));
        if (btnFechar && painel) btnFechar.addEventListener('click', () => painel.classList.remove('aberto'));

        /* Botão limpar identificação (badge ✕) */
        const btnLimpar = document.getElementById('btnLimparUtente');
        if (btnLimpar) {
            btnLimpar.addEventListener('click', () => {
                limparUtenteSession();
                mostrarMensagem('Identificação removida — próxima senha será anónima.', 'info');
            });
        }
    }

    /* ══════════════════════════════════════════════════════════════
       MODAL DE IDENTIFICAÇÃO
    ══════════════════════════════════════════════════════════════ */

    function configurarModal() {
        const btnConfirmar = document.getElementById('btnConfirmarId');
        const btnAnonimo   = document.getElementById('btnEmitirAnonimo');
        const modal        = document.getElementById('modalIdentificacao');

        /* Fechar ao clicar no overlay (fora do card) */
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) fecharModal();
            });
        }

        /* Enter no campo telefone confirma */
        const inputTel = document.getElementById('modalTelefone');
        if (inputTel) {
            inputTel.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') confirmarIdentificacao();
            });
        }

        if (btnConfirmar) btnConfirmar.addEventListener('click', confirmarIdentificacao);
        if (btnAnonimo)   btnAnonimo.addEventListener('click', emitirAnonimo);
    }

    function abrirModalOuEmitir() {
        if (!servicoSelecionado) {
            mostrarMensagem('⚠ Seleccione um serviço antes de emitir senha.', 'warn');
            return;
        }

        // Se já há utente identificado nesta sessão, emitir directamente
        if (utenteActual) {
            emitirComUtente(utenteActual.utente_id);
            return;
        }

        // Abrir modal de identificação
        const modal   = document.getElementById('modalIdentificacao');
        const inputNm = document.getElementById('modalNome');
        const msgEl   = document.getElementById('modalMsg');

        if (msgEl)   msgEl.textContent = '';
        if (modal)   modal.classList.add('aberto');
        if (inputNm) setTimeout(() => inputNm.focus(), 100);
    }

    function fecharModal() {
        const modal = document.getElementById('modalIdentificacao');
        if (modal) modal.classList.remove('aberto');
        limparModal();
    }

    function limparModal() {
        const nm  = document.getElementById('modalNome');
        const tel = document.getElementById('modalTelefone');
        const msg = document.getElementById('modalMsg');
        if (nm)  nm.value  = '';
        if (tel) tel.value = '';
        if (msg) msg.textContent = '';
    }

    function definirMsgModal(texto, tipo) {
        const el = document.getElementById('modalMsg');
        if (!el) return;
        el.textContent = texto;
        el.className   = `modal-msg ${tipo}`;
    }

    /* ── Confirmar identificação ─────────────────────────────── */

    async function confirmarIdentificacao() {
        const nome     = (document.getElementById('modalNome')?.value     || '').trim();
        const telefone = (document.getElementById('modalTelefone')?.value || '').trim();
        const btnConf  = document.getElementById('btnConfirmarId');

        // Nome é obrigatório para identificação com significado
        if (!nome) {
            definirMsgModal('Por favor indique o seu nome.', 'erro');
            document.getElementById('modalNome')?.focus();
            return;
        }

        if (btnConf) {
            btnConf.disabled    = true;
            btnConf.textContent = 'A identificar...';
        }

        definirMsgModal('A verificar...', 'info');

        try {
            const resp = await fetch('/api/utentes/registar', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ nome, telefone: telefone || null })
            });

            const dados = await resp.json();

            if (!resp.ok) {
                definirMsgModal(dados.erro || 'Erro ao identificar.', 'erro');
                return;
            }

            // Guardar utente na sessão
            const utente = { utente_id: dados.utente_id, nome: dados.nome };
            guardarUtenteSession(utente);

            const msg = dados.criado
                ? `Bem-vindo, ${dados.nome}! A emitir a sua senha...`
                : `Identificado como ${dados.nome}. A emitir a sua senha...`;

            definirMsgModal(msg, 'ok');

            // Breve pausa para o utente ler a mensagem, depois emitir
            setTimeout(async () => {
                fecharModal();
                await emitirComUtente(dados.utente_id);
            }, 900);

        } catch (erro) {
            console.error("❌ Erro ao identificar utente:", erro);
            definirMsgModal('Erro de ligação. Tente novamente.', 'erro');
        } finally {
            if (btnConf) {
                btnConf.disabled    = false;
                btnConf.textContent = 'Identificar e emitir';
            }
        }
    }

    /* ── Emitir sem identificação ────────────────────────────── */

    function emitirAnonimo() {
        fecharModal();
        emitirComUtente(null);
    }

    /* ══════════════════════════════════════════════════════════════
       EMISSÃO DE SENHA
    ══════════════════════════════════════════════════════════════ */

    async function emitirComUtente(utenteId) {
        const btnEmitir = document.getElementById('btnEmitirSenha');

        if (btnEmitir) {
            btnEmitir.disabled    = true;
            btnEmitir.textContent = 'A emitir...';
        }

        mostrarMensagem('⏳ A emitir senha...', '');

        try {
            const body = {
                servico_id: servicoSelecionado.id,
                tipo:       'normal'
            };

            // Adicionar utente_id apenas se identificado
            if (utenteId) body.utente_id = utenteId;

            const resp = await fetch('/api/senhas/emitir', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(body)
            });

            const dados = await resp.json();

            if (!resp.ok) {
                mostrarMensagem(`❌ ${dados.erro || 'Erro ao emitir senha'}`, 'warn');
                return;
            }

            minhaSenha = dados.senha;
            guardarSenhaLocal(minhaSenha);

            const prefixo = utenteId ? `✅ ${utenteActual?.nome}, a` : '✅ A';
            mostrarMensagem(`${prefixo} sua senha é: ${minhaSenha.numero}`, 'ok');

            atualizarDisplaySenha();
            iniciarAcompanhamento(minhaSenha.numero);
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
       BADGE DE UTENTE
    ══════════════════════════════════════════════════════════════ */

    function atualizarBadgeUtente() {
        const badge   = document.getElementById('utenteBadge');
        const nomeEl  = document.getElementById('utenteNomeBadge');

        if (!badge) return;

        if (utenteActual) {
            if (nomeEl) nomeEl.textContent = utenteActual.nome;
            badge.classList.add('visivel');
        } else {
            badge.classList.remove('visivel');
        }
    }

    /* ══════════════════════════════════════════════════════════════
       SESSÃO DO UTENTE (sessionStorage — dura enquanto o browser estiver aberto)
    ══════════════════════════════════════════════════════════════ */

    function guardarUtenteSession(utente) {
        utenteActual = utente;
        try {
            sessionStorage.setItem(SESSION_UTENTE_KEY, JSON.stringify(utente));
        } catch (_) { /* silencioso */ }
        atualizarBadgeUtente();
    }

    function limparUtenteSession() {
        utenteActual = null;
        try {
            sessionStorage.removeItem(SESSION_UTENTE_KEY);
        } catch (_) { /* silencioso */ }
        atualizarBadgeUtente();
    }

    function restaurarUtenteSession() {
        try {
            const guardado = sessionStorage.getItem(SESSION_UTENTE_KEY);
            if (!guardado) return;
            utenteActual = JSON.parse(guardado);
            atualizarBadgeUtente();
            console.info(`[utente] Sessão restaurada: ${utenteActual.nome}`);
        } catch (_) {
            sessionStorage.removeItem(SESSION_UTENTE_KEY);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       SERVIÇOS
    ══════════════════════════════════════════════════════════════ */

    async function carregarServicos() {
        const container = document.getElementById('servicesList');
        if (!container) return;

        try {
            const resp    = await fetch('/api/servicos');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const servicos = await resp.json();
            const lista    = Array.isArray(servicos) ? servicos : (servicos.servicos || []);

            if (lista.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted)">Sem serviços disponíveis.</p>';
                return;
            }

            container.innerHTML = '';
            lista.forEach(servico => {
                const card = document.createElement('article');
                card.className         = 'service-card';
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
            container.innerHTML = '<p style="color:var(--text-muted)">Erro ao carregar serviços.</p>';
        }
    }

    function selecionarServico(servico, cardEl) {
        servicoSelecionado = servico;
        document.querySelectorAll('.service-card').forEach(c => c.classList.remove('ativo'));
        if (cardEl) cardEl.classList.add('ativo');
        mostrarMensagem(`Serviço seleccionado: ${servico.nome}`, 'ok');
    }

    /* ══════════════════════════════════════════════════════════════
       DISPLAY DA SENHA
    ══════════════════════════════════════════════════════════════ */

    function atualizarDisplaySenha() {
        const numEl    = document.getElementById('currentTicket');
        const statusEl = document.getElementById('currentStatus');
        const tracker  = document.getElementById('ticketTracker');

        if (!minhaSenha) {
            if (numEl)    numEl.textContent     = '---';
            if (statusEl) statusEl.textContent  = 'Aguardando';
            if (tracker)  tracker.style.display = 'none';
            return;
        }

        if (numEl)    numEl.textContent     = minhaSenha.numero;
        if (statusEl) statusEl.textContent  = traduzirStatus(minhaSenha.status);
        if (tracker)  tracker.style.display = 'block';
    }

    /* ══════════════════════════════════════════════════════════════
       ACOMPANHAMENTO DE POSIÇÃO
    ══════════════════════════════════════════════════════════════ */

    function iniciarAcompanhamento(numeroSenha) {
        pararAcompanhamento();
        const tracker = document.getElementById('ticketTracker');
        if (tracker) tracker.style.display = 'block';
        actualizarPosicao(numeroSenha);
        pollingAcompanhamento = setInterval(() => actualizarPosicao(numeroSenha), 10000);
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
                    ? `~${dados.tempo_espera_estimado}min` : '–';
                if (estadoEl) estadoEl.textContent = 'A aguardar';

            } else if (dados.status === 'atendendo') {
                if (posEl)    posEl.textContent    = '🔔';
                if (tempoEl)  tempoEl.textContent  = 'É a sua vez!';
                if (estadoEl) estadoEl.textContent = `Balcão ${dados.balcao}`;
                pararAcompanhamento();

            } else if (['concluida', 'cancelada'].includes(dados.status)) {
                if (estadoEl) estadoEl.textContent = traduzirStatus(dados.status);
                pararAcompanhamento();
                setTimeout(() => { limparSenhaLocal(); atualizarDisplaySenha(); }, 5000);
            }

        } catch (erro) {
            console.error('[actualizarPosicao] Erro:', erro);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       ESTATÍSTICAS E ÚLTIMA CHAMADA
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
            if (tempoEl) tempoEl.textContent  = `~${stats.tempo_medio_espera || 0}min`;
            if (doneEl)  doneEl.textContent   = stats.concluidas || 0;
            if (satEl) {
                const total   = stats.total_emitidas || 0;
                const conclui = stats.concluidas     || 0;
                satEl.textContent = total > 0
                    ? `${Math.round((conclui / total) * 100)}%` : '—';
            }
        } catch (erro) {
            console.error("❌ Erro estatísticas:", erro);
        }
    }

    async function atualizarUltimaChamada() {
        const numEl    = document.getElementById('ultimaChamada');
        const balcaoEl = document.getElementById('ultimoBalcao');
        try {
            const resp = await fetch('/api/senhas?status=atendendo&per_page=1&page=1');
            if (!resp.ok) return;
            const dados  = await resp.json();
            const senhas = dados.senhas || [];
            if (senhas.length > 0) {
                if (numEl)    numEl.textContent    = senhas[0].numero;
                if (balcaoEl) balcaoEl.textContent = senhas[0].numero_balcao
                    ? `Balcão ${senhas[0].numero_balcao}` : '—';
            } else {
                if (numEl)    numEl.textContent    = '---';
                if (balcaoEl) balcaoEl.textContent = '—';
            }
        } catch (erro) {
            console.error("❌ Erro última chamada:", erro);
        }
    }

    /* ══════════════════════════════════════════════════════════════
       LOCALSTORAGE — senha (Sprint 3, inalterado)
    ══════════════════════════════════════════════════════════════ */

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
            const senha = JSON.parse(guardada);
            const hoje  = new Date().toISOString().split('T')[0];
            if ((senha.data_emissao || '') !== hoje) {
                limparSenhaLocal();
                return;
            }
            minhaSenha = senha;
            atualizarDisplaySenha();
            if (!['concluida', 'cancelada'].includes(senha.status)) {
                iniciarAcompanhamento(senha.numero);
            }
        } catch (_) { limparSenhaLocal(); }
    }

    /* ══════════════════════════════════════════════════════════════
       POLLING GERAL
    ══════════════════════════════════════════════════════════════ */

    function iniciarPollingGeral() {
        pararPollingGeral();
        pollingGeral = setInterval(async () => {
            await atualizarEstatisticas();
            await atualizarUltimaChamada();
        }, 5000);
    }

    function pararPollingGeral() {
        if (pollingGeral) { clearInterval(pollingGeral); pollingGeral = null; }
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
        el.textContent = texto;
        el.className   = 'ticket-message';
        if (tipo) el.classList.add(tipo);
        if (tipo === 'ok') {
            setTimeout(() => { if (el.textContent === texto) el.textContent = ''; }, 6000);
        }
    }

    function traduzirStatus(status) {
        return { aguardando:'A aguardar', chamada:'Chamada',
                 atendendo:'Em atendimento', concluida:'Concluída',
                 cancelada:'Cancelada' }[status] || status;
    }

})();