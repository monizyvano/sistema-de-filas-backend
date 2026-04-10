/**
 * static/js/dash.js — v3
 * FIX: balcao lido com parseInt para evitar falsy em "1" string
 */
(function () {
    "use strict";

    const store = window.IMTSBStore;
    let senhaAtual = null, timerInterval = null, pollingInterval = null;

    document.addEventListener("DOMContentLoaded", async () => {
        if (!store.isLoggedIn()) { window.location.href = "/logintcc.html"; return; }
        const user = store.getUser();
        if (user.role !== "trabalhador" && user.role !== "admin") {
            alert("Acesso negado."); window.location.href = "/"; return;
        }
        await carregarDadosTrabalhador();
        await injectSelectorServico();
        await atualizarEstatisticas();
        await atualizarHistorico();
        iniciarPolling();
        actualizarBotaoConcluir();
    });

    async function carregarDadosTrabalhador() {
        const user = store.getUser();
        const g = id => document.getElementById(id);
        if (g("workerName"))   g("workerName").textContent   = user.name || "Trabalhador";
        if (g("workerDept"))   g("workerDept").textContent   = user.departamento || "Atendimento";
        if (g("workerAvatar")) g("workerAvatar").textContent =
            (user.name || "T").split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
        if (g("counterBadge")) {
            // FIX: parseInt para garantir número
            const b = parseInt(user.balcao || user.numero_balcao) || null;
            g("counterBadge").textContent = b ? `Balcão ${b}` : "Sem balcão";
        }
    }

    async function injectSelectorServico() {
        if (document.getElementById("servicoSelectorWrapper")) return;
        let servicos = [];
        try { const r = await fetch("/api/servicos/"); if (r.ok) servicos = await r.json(); } catch (_) {}
        if (!servicos.length) return;
        const container = document.querySelector(".action-buttons");
        if (!container) return;
        const user    = store.getUser();
        const wrapper = document.createElement("div");
        wrapper.id    = "servicoSelectorWrapper";
        wrapper.style.cssText = "margin-bottom:1rem;width:100%;";
        wrapper.innerHTML = `
            <label style="font-weight:700;display:block;margin-bottom:6px;color:#401903">Serviço a atender:</label>
            <select id="servicoSelector" style="width:100%;padding:.75rem 1rem;border-radius:12px;
                border:2px solid #e5e7eb;font-size:1rem;font-weight:600;background:#fff;cursor:pointer;">
                <option value="">— Seleccione o serviço —</option>
                ${servicos.map(s => `<option value="${s.id}" ${s.id == (user.servico_id||"") ? "selected" : ""}>${s.icone||"📋"} ${s.nome}</option>`).join("")}
            </select>`;
        container.parentNode.insertBefore(wrapper, container);
    }

    function getServicoId() {
        const user = store.getUser();
        const sel  = document.getElementById("servicoSelector");
        return user.servico_id || (sel ? parseInt(sel.value) || null : null);
    }

    function getBalcao() {
        const user = store.getUser();
        return parseInt(user.balcao || user.numero_balcao) || null;
    }

    // ── CHAMAR ────────────────────────────────────────────────
    window.callNextCustomer = async function () {
        const svcId  = getServicoId();
        const balcao = getBalcao();
        const btn    = document.querySelector(".btn-next");

        if (!svcId)  { alert("Seleccione um serviço."); return; }
        if (!balcao) { alert("Sem balcão configurado. Contacte o administrador."); return; }

        if (btn) { btn.disabled = true; btn.textContent = "A chamar..."; }
        try {
            const result = await store.callNext(svcId, balcao);
            if (result.ok && result.senha) {
                senhaAtual = result.senha;
                const c = document.getElementById("currentSenhaId");
                if (c) c.value = senhaAtual.id || "";
                atualizarDisplayAtual(senhaAtual);
                actualizarBotaoConcluir();
                pararTimer(); iniciarTimer();
                await atualizarHistorico();
                await atualizarEstatisticas();
            } else {
                alert(result.message || "Não há senhas a aguardar.");
            }
        } catch (e) { console.error("❌ callNext:", e); alert("Erro ao chamar senha."); }
        finally { if (btn) { btn.disabled = false; btn.textContent = "Chamar Próximo"; } }
    };

    // ── CONCLUIR ──────────────────────────────────────────────
    window.concludeAttendance = async function () {
        const c    = document.getElementById("currentSenhaId");
        const sid  = c ? c.value : null;
        const btn  = document.getElementById("btnConcluir");
        if (!sid) { alert("Nenhuma senha em atendimento."); return; }
        if (!confirm(`Confirmar conclusão da senha ${senhaAtual?.numero || sid}?`)) return;
        if (btn) { btn.disabled = true; btn.textContent = "A concluir..."; }
        try {
            const resp = await fetch(`/api/filas/concluir/${sid}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${store.getToken()}` }
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                senhaAtual = null;
                if (c) c.value = "";
                limparDisplayAtual(); pararTimer(); actualizarBotaoConcluir();
                await atualizarHistorico(); await atualizarEstatisticas();
            } else { alert(`Erro: ${data.erro || data.message || "Não foi possível concluir"}`); }
        } catch (e) { alert("Erro de ligação."); }
        finally { if (btn) { btn.disabled = false; btn.textContent = "Concluir"; } }
    };

    async function atualizarEstatisticas() {
        try {
            const resp = await fetch("/api/dashboard/trabalhador/estatisticas",
                { headers: { "Authorization": `Bearer ${store.getToken()}` } });
            if (resp.status === 401) { store.logout(); return; }
            if (!resp.ok) return;
            const s = await resp.json();
            const g = id => document.getElementById(id);
            if (g("waitingCount")) g("waitingCount").textContent = s.aguardando || "0";
            if (g("servedToday"))  g("servedToday").textContent  = s.atendidos_hoje || "0";
            if (g("avgTime"))      g("avgTime").textContent      = `~${s.tempo_medio_atendimento || 0}min`;
        } catch (e) { console.error("❌ stats:", e); }
    }

    async function atualizarHistorico() {
        try {
            const user = store.getUser();
            const resp = await fetch(`/api/senhas?atendente_id=${user.id}&status=concluida&page=1&per_page=10`,
                { headers: { "Authorization": `Bearer ${store.getToken()}` } });
            if (!resp.ok) return;
            const { senhas = [] } = await resp.json();
            const log = document.getElementById("activityLog");
            if (!log) return;
            if (!senhas.length) {
                log.innerHTML = "<div class='log-item'><div class='log-password'>Nenhum atendimento hoje</div></div>";
                return;
            }
            log.innerHTML = senhas.map(s => {
                const ts   = s.atendimento_concluido_em || s.created_at;
                const hora = ts ? new Date(ts).toLocaleTimeString("pt-PT", {hour:"2-digit",minute:"2-digit"}) : "--:--";
                return `<div class="log-item completed">
                    <div class="log-password">${s.numero}${s.servico ? " — "+s.servico.nome : ""}</div>
                    <div class="log-time">${hora} · ${s.tempo_atendimento_minutos||0}min</div>
                </div>`;
            }).join("");
        } catch (e) { console.error("❌ histórico:", e); }
    }

    function atualizarDisplayAtual(s) {
        const g = id => document.getElementById(id);
        if (g("currentPassword")) g("currentPassword").textContent = s.numero;
        if (g("passwordType"))    g("passwordType").textContent    = s.tipo === "prioritaria" ? "Prioritário" : "Normal";
        if (g("serviceValue"))    g("serviceValue").textContent    = s.servico?.nome || "Geral";
        if (g("waitTime"))        g("waitTime").textContent        = `${s.tempo_espera_minutos || 0} min`;
        if (g("issuedAt") && s.emitida_em)
            g("issuedAt").textContent = new Date(s.emitida_em).toLocaleTimeString("pt-PT",{hour:"2-digit",minute:"2-digit"});
        if (g("obsValue"))   g("obsValue").textContent   = s.observacoes || "Sem observações";
        if (g("statusText")) g("statusText").textContent = "Em Atendimento";
    }

    function limparDisplayAtual() {
        [["currentPassword","---"],["passwordType","Aguardando chamada"],["serviceValue","-"],
         ["waitTime","-"],["issuedAt","-"],["obsValue","Sem observações"],["statusText","Disponível"]
        ].forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.textContent = v; });
        const t = document.getElementById("timer");
        if (t) t.textContent = "00:00";
    }

    function actualizarBotaoConcluir() {
        const btn = document.getElementById("btnConcluir");
        if (btn) btn.disabled = senhaAtual === null;
    }

    function iniciarTimer() {
        pararTimer(); let seg = 0;
        timerInterval = setInterval(() => {
            seg++;
            const el = document.getElementById("timer");
            if (el) el.textContent = `${String(Math.floor(seg/60)).padStart(2,"0")}:${String(seg%60).padStart(2,"0")}`;
        }, 1000);
    }
    function pararTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

    function iniciarPolling() {
        pararPolling();
        pollingInterval = setInterval(atualizarEstatisticas, 10000);
    }
    function pararPolling() { if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; } }

    window.togglePause = function () {
        const btn = document.getElementById("pauseBtn");
        if (!btn) return;
        if (btn.textContent.trim() === "Retomar") { iniciarPolling(); btn.textContent = "Pausar"; }
        else { pararPolling(); btn.textContent = "Retomar"; }
    };
    window.redirectCustomer = function () { if (!senhaAtual) { alert("Nenhuma senha."); return; } alert(`Reencaminhamento de ${senhaAtual.numero} — em desenvolvimento.`); };
    window.addObservation   = function () {
        if (!senhaAtual) { alert("Nenhuma senha."); return; }
        const obs = prompt("Observação:");
        if (obs) { senhaAtual.observacoes = obs; const el = document.getElementById("obsValue"); if (el) el.textContent = obs; }
    };
    window.requestDocuments = function () { alert("Em desenvolvimento."); };
    window.sendReceipt      = function () { if (senhaAtual) alert(`Recibo de ${senhaAtual.numero} — em desenvolvimento.`); };
    window.showStatistics   = function () { window.location.href = "/dashadm.html"; };
    window.sair             = function () { if (confirm("Sair?")) { pararPolling(); pararTimer(); store.logout(); } };
})();