/**
 * static/js/api-adapter.js — SPRINT 1
 * ═══════════════════════════════════════════════════════════════
 * Adaptador de dados entre backend Flask e frontend JS.
 *
 * ALTERAÇÕES:
 *   ✅ adaptLoginResponse() mapeia servico_id do backend
 *      para o objecto de utilizador no frontend.
 *      O dash.js lê user.servico_id em vez de fixar 1.
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
    "use strict";

    const ApiAdapter = {

        // ═══════════════════════════════════════════════
        // 🔐 AUTENTICAÇÃO
        // ═══════════════════════════════════════════════

        adaptLoginResponse(backendData, email) {
            /**
             * Converte resposta de login do backend para o formato
             * esperado pelo IMTSBStore.
             *
             * Backend devolve:
             *   { access_token, atendente: { id, nome, email,
             *     tipo, ativo, balcao, servico_id } }
             *
             * Frontend espera:
             *   { ok, token, id, name, email, role, balcao, servico_id }
             */
            const atendente = backendData.atendente || {};
            const tipo      = atendente.tipo || 'atendente';
            const balcao    = atendente.balcao;

            // Mapeamento de roles
            let role;
            if (tipo === 'admin') {
                role = 'admin';
            } else if (tipo === 'atendente' && balcao != null) {
                role = 'trabalhador';
            } else {
                role = 'usuario';
            }

            return {
                ok:         true,
                token:      backendData.access_token,
                id:         atendente.id,
                name:       atendente.nome,
                email:      atendente.email || email,
                role:       role,
                balcao:     balcao,
                // SPRINT 1: servico_id real do utilizador autenticado
                servico_id: atendente.servico_id || null
            };
        },

        // ═══════════════════════════════════════════════
        // 🎫 SENHAS
        // ═══════════════════════════════════════════════

        adaptIssueTicket(frontendData) {
            return {
                servico_id:      frontendData.servico_id,
                tipo:            frontendData.tipo || 'normal',
                usuario_contato: frontendData.usuario_contato || null
            };
        },

        adaptTicketResponse(backendSenha) {
            return {
                id:        backendSenha.id,
                number:    backendSenha.numero,
                type:      backendSenha.tipo,
                status:    backendSenha.status,
                serviceId: backendSenha.servico_id,
                issuedAt:  backendSenha.emitida_em,
                calledAt:  backendSenha.chamada_em,
                balcao:    backendSenha.numero_balcao
            };
        },

        // ═══════════════════════════════════════════════
        // 👨‍💼 TRABALHADOR
        // ═══════════════════════════════════════════════

        adaptCallNext(frontendData) {
            return {
                servico_id:    frontendData.servico_id,
                numero_balcao: frontendData.numero_balcao
            };
        },

        // ═══════════════════════════════════════════════
        // 📊 ESTATÍSTICAS
        // ═══════════════════════════════════════════════

        adaptStatsResponse(backendStats) {
            return {
                waiting:    backendStats.aguardando       || 0,
                serving:    backendStats.atendendo        || 0,
                completed:  backendStats.concluidas       || 0,
                cancelled:  backendStats.canceladas       || 0,
                totalToday: backendStats.total_emitidas   || 0,
                avgWaitTime:backendStats.tempo_medio_espera || 0
            };
        },

        // ═══════════════════════════════════════════════
        // 🔧 HELPERS
        // ═══════════════════════════════════════════════

        formatDate(isoString) {
            /** "2026-03-07T14:30:00" → "07/03/2026 14:30" */
            if (!isoString) return '-';
            try {
                const d   = new Date(isoString);
                const pad = n => String(n).padStart(2, '0');
                return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} `
                     + `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } catch {
                return isoString;
            }
        },

        formatDuration(minutes) {
            /** 75 → "1h 15min" */
            if (!minutes || minutes === 0) return '0min';
            if (minutes < 60) return `${minutes}min`;
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            return m > 0 ? `${h}h ${m}min` : `${h}h`;
        }
    };

    window.ApiAdapter = ApiAdapter;
    console.log("✅ ApiAdapter carregado (Sprint 1 — com servico_id)");

})();
