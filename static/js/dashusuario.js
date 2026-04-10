/**
 * static/js/dashusuario.js — CORRIGIDO
 * FIX: clicar serviço redireciona para formulário dedicado
 *      em vez de emitir senha directamente.
 * Mostra mensagem flash após emissão de senha bem sucedida.
 */
(function () {
    "use strict";

    const store = window.IMTSBStore;

    // Mapeamento serviço → página de formulário
    const PAGINAS_SERVICO = {
        1: "/matricula.html",
        2: "/tesouraria.html",
        3: "/declaracao.html",
        4: "/matricula.html",     // Biblioteca → usa formulário de secretaria
        5: "/apoio-cliente.html"
    };

    // Também por nome (fallback)
    const PAGINAS_NOME = {
        "Secretaria Académica":  "/matricula.html",
        "Tesouraria":            "/tesouraria.html",
        "Direcção Pedagógica":   "/declaracao.html",
        "Biblioteca":            "/matricula.html",
        "Apoio ao Cliente":      "/apoio-cliente.html"
    };

    let pollingGeral = null;
    const STORAGE_KEY = "imtsb_minha_senha";

    // ── Init ─────────────────────────────────────────────────

    document.addEventListener("DOMContentLoaded", () => {
        configurarHeader();
        configurarBotoes();
        carregarServicos();
        atualizarEstatisticas();
        atualizarUltimaChamada();
        restaurarSenhaGuardada();
        mostrarFlash();
        iniciarPolling();
    });

    // ── Flash após emissão ────────────────────────────────────

    function mostrarFlash() {
        const flash = localStorage.getItem("imtsb_flash");
        if (!flash) return;
        localStorage.removeItem("imtsb_flash");
        mostrarMensagem(flash, "ok");
    }

    // ── Header ────────────────────────────────────────────────

    function configurarHeader() {
        const user = store.getUser();
        const g    = id => document.getElementById(id);
        if (user) {
            if (g("userProfileName")) g("userProfileName").textContent = `Bem-vindo, ${user.name}`;
            if (g("dadoNome"))        g("dadoNome").textContent        = user.name  || "—";
            if (g("dadoEmail"))       g("dadoEmail").textContent       = user.email || "—";
            if (g("dadoPerfil"))      g("dadoPerfil").textContent      = user.role  || "—";
        } else {
            if (g("userProfileName")) g("userProfileName").textContent = "Bem-vindo";
            if (g("dadoNome"))        g("dadoNome").textContent        = "Visitante";
            if (g("dadoEmail"))       g("dadoEmail").textContent       = "Não identificado";
            if (g("dadoPerfil"))      g("dadoPerfil").textContent      = "Público";
        }
    }

    // ── Botões ────────────────────────────────────────────────

    function configurarBotoes() {
        // Botão sair/entrar
        const btnSair = document.getElementById("btnSair");
        if (btnSair) {
            const user = store.getUser();
            btnSair.textContent = user ? "Sair" : "Entrar";
            btnSair.addEventListener("click", () => {
                if (user) { pararPollings(); localStorage.removeItem(STORAGE_KEY); store.logout(); }
                else       { window.location.href = "/logintcc.html"; }
            });
        }

        // Painel meus dados
        const btnDados  = document.getElementById("btnMeusDados");
        const painel    = document.getElementById("meusDadosPanel");
        const btnFechar = document.getElementById("btnFecharDados");
        if (btnDados && painel) btnDados.addEventListener("click",  () => painel.classList.add("aberto"));
        if (btnFechar && painel) btnFechar.addEventListener("click", () => painel.classList.remove("aberto"));

        // Botão emitir senha (sem serviço → aviso)
        const btnEmitir = document.getElementById("btnEmitirSenha");
        if (btnEmitir) {
            btnEmitir.addEventListener("click", () => {
                mostrarMensagem("Seleccione um serviço na lista abaixo para emitir a sua senha.", "warn");
                // Scroll suave para a lista de serviços
                const svc = document.getElementById("servicesList");
                if (svc) svc.scrollIntoView({ behavior: "smooth", block: "start" });
            });
        }
    }

    // ── Serviços da API → cards com redirect ─────────────────

    async function carregarServicos() {
        const container = document.getElementById("servicesList");
        if (!container) return;

        try {
            const resp     = await fetch("/api/servicos/");
            if (!resp.ok) throw new Error("Erro ao carregar serviços");
            const servicos = await resp.json();
            const lista    = Array.isArray(servicos) ? servicos : (servicos.servicos || []);

            if (!lista.length) {
                container.innerHTML = "<p style='color:var(--text-muted)'>Sem serviços disponíveis.</p>";
                return;
            }

            container.innerHTML = "";

            lista.forEach(s => {
                const pagina = PAGINAS_SERVICO[s.id] || PAGINAS_NOME[s.nome] || "/index.html";

                const card = document.createElement("article");
                card.className = "service-card";
                card.style.cursor = "pointer";
                card.innerHTML = `
                    <div class="service-icon">${s.icone || "📋"}</div>
                    <div class="service-info">
                        <div class="service-name">${s.nome}</div>
                        <div class="service-status">
                            <span class="status-dot"></span>
                            ${s.descricao || "Serviço disponível"}
                        </div>
                    </div>
                    <span class="arrow-icon">→</span>`;

                // CLICK → vai para formulário dedicado
                card.addEventListener("click", () => {
                    window.location.href = pagina;
                });

                container.appendChild(card);
            });

        } catch (err) {
            console.error("❌ Serviços:", err);
            document.getElementById("servicesList").innerHTML =
                "<p style='color:var(--text-muted)'>Erro ao carregar serviços.</p>";
        }
    }

    // ── Estatísticas ─────────────────────────────────────────

    async function atualizarEstatisticas() {
        try {
            const resp = await fetch("/api/senhas/estatisticas");
            if (!resp.ok) return;
            const s = await resp.json();
            const g = id => document.getElementById(id);
            if (g("statFila"))  g("statFila").textContent  = s.aguardando || 0;
            if (g("statTempo")) g("statTempo").textContent = `~${s.tempo_medio_espera || 0}min`;
            if (g("statDone"))  g("statDone").textContent  = s.concluidas || 0;
            if (g("statSat")) {
                const total  = s.total_emitidas || 0;
                const conc   = s.concluidas     || 0;
                g("statSat").textContent = total > 0 ? `${Math.round((conc/total)*100)}%` : "—";
            }
        } catch (e) { console.error("❌ Estatísticas:", e); }
    }

    // ── Última chamada ────────────────────────────────────────

    async function atualizarUltimaChamada() {
        try {
            const resp = await fetch("/api/senhas?status=atendendo&per_page=1&page=1");
            if (!resp.ok) return;
            const { senhas = [] } = await resp.json();
            const g = id => document.getElementById(id);
            if (senhas.length) {
                const s = senhas[0];
                if (g("ultimaChamada")) g("ultimaChamada").textContent = s.numero;
                if (g("ultimoBalcao"))  g("ultimoBalcao").textContent  = s.numero_balcao ? `Balcão ${s.numero_balcao}` : "—";
            } else {
                if (g("ultimaChamada")) g("ultimaChamada").textContent = "---";
                if (g("ultimoBalcao"))  g("ultimoBalcao").textContent  = "—";
            }
        } catch (e) { console.error("❌ Última chamada:", e); }
    }

    // ── Acompanhamento da senha emitida ───────────────────────

    function restaurarSenhaGuardada() {
        try {
            const guardada = localStorage.getItem(STORAGE_KEY);
            if (!guardada) return;
            const senha = JSON.parse(guardada);
            const hoje  = new Date().toISOString().split("T")[0];
            if ((senha.data_emissao || "") !== hoje) {
                localStorage.removeItem(STORAGE_KEY); return;
            }
            mostrarSenhaActual(senha);
            if (!["concluida","cancelada"].includes(senha.status)) {
                iniciarAcompanhamento(senha.numero);
            }
        } catch (_) { localStorage.removeItem(STORAGE_KEY); }
    }

    function mostrarSenhaActual(s) {
        const g = id => document.getElementById(id);
        if (g("currentTicket"))   g("currentTicket").textContent   = s.numero;
        if (g("currentStatus"))   g("currentStatus").textContent   = traduzirStatus(s.status);
        if (g("ticketTracker"))   g("ticketTracker").style.display = "block";
    }

    let pollingAcomp = null;

    function iniciarAcompanhamento(numero) {
        if (pollingAcomp) clearInterval(pollingAcomp);
        actualizarPosicao(numero);
        pollingAcomp = setInterval(() => actualizarPosicao(numero), 10000);
    }

    async function actualizarPosicao(numero) {
        try {
            const resp = await fetch(`/api/dashboard/public/senha/${encodeURIComponent(numero)}`);
            if (resp.status === 404) { localStorage.removeItem(STORAGE_KEY); if (pollingAcomp) clearInterval(pollingAcomp); return; }
            if (!resp.ok) return;
            const d = await resp.json();
            const g = id => document.getElementById(id);
            if (d.status === "aguardando") {
                if (g("trackerPosicao")) g("trackerPosicao").textContent = d.posicao || "—";
                if (g("trackerTempo"))   g("trackerTempo").textContent   = d.tempo_espera_estimado > 0 ? `~${d.tempo_espera_estimado}min` : "—";
                if (g("trackerEstado"))  g("trackerEstado").textContent  = "A aguardar";
            } else if (d.status === "atendendo") {
                if (g("trackerPosicao")) g("trackerPosicao").textContent = "🔔";
                if (g("trackerTempo"))   g("trackerTempo").textContent   = "É a sua vez!";
                if (g("trackerEstado"))  g("trackerEstado").textContent  = `Balcão ${d.balcao || "—"}`;
                if (pollingAcomp) clearInterval(pollingAcomp);
            } else if (["concluida","cancelada"].includes(d.status)) {
                if (g("trackerEstado")) g("trackerEstado").textContent = traduzirStatus(d.status);
                if (pollingAcomp) clearInterval(pollingAcomp);
                setTimeout(() => { localStorage.removeItem(STORAGE_KEY); }, 5000);
            }
        } catch (e) { console.error("❌ Posição:", e); }
    }

    // ── Polling geral ─────────────────────────────────────────

    function iniciarPolling() {
        pararPollings();
        pollingGeral = setInterval(() => {
            atualizarEstatisticas();
            atualizarUltimaChamada();
        }, 5000);
    }

    function pararPollings() {
        if (pollingGeral) { clearInterval(pollingGeral); pollingGeral = null; }
        if (pollingAcomp) { clearInterval(pollingAcomp); pollingAcomp = null; }
    }

    // ── Helpers ───────────────────────────────────────────────

    function mostrarMensagem(texto, tipo) {
        const el = document.getElementById("ticketMessage");
        if (!el) return;
        el.textContent = texto;
        el.className   = "ticket-message";
        if (tipo) el.classList.add(tipo);
        if (tipo === "ok") setTimeout(() => { if (el.textContent === texto) el.textContent = ""; }, 6000);
    }

    function traduzirStatus(s) {
        return { aguardando:"A aguardar", chamada:"Chamada", atendendo:"Em atendimento", concluida:"Concluída", cancelada:"Cancelada" }[s] || s;
    }

})();