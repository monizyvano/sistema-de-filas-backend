/**
 * static/js/realtime-store.js — Sprint 4 FIXED
 * ═══════════════════════════════════════════════════════════════
 * FIXES:
 *   ✅ FIX "ApiClient não carregado": verifica no momento de usar,
 *      não na inicialização (scripts podem carregar em qualquer ordem)
 *   ✅ FIX callNext: sem const duplicado
 *   ✅ requireRole() robusto — redireciona ou retorna null graciosamente
 *   ✅ getToken() lê de múltiplas chaves para compatibilidade
 *   ✅ refreshSnapshot() com fallback para endpoints nativos
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ── ApiClient: acesso lazy (não na inicialização) ──────── */
  function getApiClient() {
    return window.ApiClient || null;
  }

  const apiConfig = window.IMTSBApiConfig || {};

  const IMTSBStore = {

    /* ── Estado ──────────────────────────────────────────── */
    _state: {
      user:          null,
      queue:         [],
      history:       [],
      stats:         { aguardando: 0, concluidas: 0, tempo_medio: 0, satisfacao: 0 },
      currentTicket: null,
      lastCall:      null,
      users:         []
    },
    _listeners:       [],
    _pollingInterval: null,

    /* ── Subscriptions ───────────────────────────────────── */
    subscribe(callback) {
      this._listeners.push(callback);
      return () => {
        const i = this._listeners.indexOf(callback);
        if (i > -1) this._listeners.splice(i, 1);
      };
    },
    onChange(callback) { return this.subscribe(callback); },
    _notify() { this._listeners.forEach(fn => { try { fn(this._state); } catch (_) {} }); },

    /* ── Getters ─────────────────────────────────────────── */
    getSnapshot() {
      return {
        queue:      [...this._state.queue],
        history:    [...this._state.history],
        users:      [...(this._state.users || [])],
        lastCalled: this._state.lastCall || null,
        stats:      { ...this._state.stats },
        updatedAt:  this._state.updatedAt || null
      };
    },

    async refreshSnapshot() {
      const client = getApiClient();
      if (!apiConfig.enabled || !client?.getSnapshot) return this.getSnapshot();
      try {
        const result = await client.getSnapshot();
        if (!result.ok) return this.getSnapshot();
        const data = result.data || {};
        this._state.queue     = Array.isArray(data.queue)   ? data.queue   : [];
        this._state.history   = Array.isArray(data.history) ? data.history : [];
        this._state.users     = Array.isArray(data.users)   ? data.users   : [];
        this._state.lastCall  = data.lastCalled || data.lastCall || null;
        this._state.stats     = data.stats || this._state.stats;
        this._state.updatedAt = data.updatedAt || null;
        this._notify();
        return this.getSnapshot();
      } catch (error) {
        console.error("❌ Erro snapshot:", error);
        return this.getSnapshot();
      }
    },

    getUser() {
      const stored = localStorage.getItem("imtsb_user");
      if (stored) {
        try { return JSON.parse(stored); } catch (_) { return null; }
      }
      return this._state.user;
    },

    getCurrentTicket() { return this._state.currentTicket; },

    getToken() {
      const user = this.getUser();
      if (user && user.token) return user.token;
      /* Tenta múltiplas chaves por compatibilidade */
      return (
        localStorage.getItem(apiConfig.accessTokenStorageKey || "imtsb_access_token") ||
        localStorage.getItem("imtsb_api_token") ||
        null
      );
    },

    isAuthenticated() { return !!this.getToken(); },
    isLoggedIn()      { return this.isAuthenticated(); },

    /* ── Sessão ──────────────────────────────────────────── */
    requireRole(allowedRoles) {
      const user  = this.getUser();
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!user) {
        if (roles.includes("usuario")) {
          return { name: "Visitante", email: "", role: "usuario", isAnonymous: true };
        }
        window.location.href = "/logintcc.html";
        return null;
      }

      if (!roles.includes(user.role)) {
        window.location.href = "/logintcc.html";
        return null;
      }

      return user;
    },

    continueAsGuest() {
      const session = {
        id: null, name: "Visitante", email: "",
        role: "usuario", token: "", balcao: null, isGuest: true
      };
      localStorage.setItem("imtsb_user", JSON.stringify(session));
      this._state.user = session;
      this._notify();
      return { ok: true, redirect: "/index.html" };
    },

    async login(email, password) {
      const client = getApiClient();
      if (!client?.login) return { ok: false, message: "API indisponível" };
      try {
        const result = await client.login(email, password);
        if (!result.ok) return { ok: false, message: result.message || "Erro no login" };

        const user = {
          id:            result.id,
          name:          result.name,
          email:         result.email,
          role:          result.role,
          token:         result.token || result.raw?.access_token || "",
          balcao:        result.balcao,
          numero_balcao: result.numero_balcao || result.balcao,
          departamento:  result.departamento,
          servico_id:    result.servico_id || null,
          isGuest:       false
        };

        this._state.user = user;
        localStorage.setItem("imtsb_user", JSON.stringify(user));
        this._notify();
        return { ok: true, user, role: result.role };
      } catch (error) {
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async register(payload) {
      const client = getApiClient();
      if (!client?.register) return { ok: false, message: "API indisponível" };
      try {
        const result = await client.register(payload);
        return result.ok
          ? { ok: true, data: result.data }
          : { ok: false, message: result.message || "Erro no cadastro" };
      } catch (error) {
        return { ok: false, message: "Erro de conexão" };
      }
    },

    logout() {
      this._state.user          = null;
      this._state.queue         = [];
      this._state.history       = [];
      this._state.currentTicket = null;
      localStorage.removeItem("imtsb_user");
      localStorage.removeItem(apiConfig.accessTokenStorageKey  || "imtsb_access_token");
      localStorage.removeItem(apiConfig.refreshTokenStorageKey || "imtsb_refresh_token");
      localStorage.removeItem("imtsb_api_token");
      this._notify();
      window.location.href = "/";
    },

    /* ── Senhas ──────────────────────────────────────────── */
    async issueTicket(serviceId, tipo, contato) {
      const client = getApiClient();
      if (!client?.issueTicket) return { ok: false, message: "API indisponível" };
      try {
        const result = await client.issueTicket({
          servico_id:      serviceId,
          tipo:            tipo || "normal",
          usuario_contato: contato || null
        });
        if (!result.ok) return { ok: false, message: result.message || "Erro ao emitir senha" };
        this._state.currentTicket = result.ticket;
        await this.refreshSnapshot();
        this._notify();
        return { ok: true, ticket: result.ticket };
      } catch (error) {
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async refreshQueue(servicoId) {
      const client = getApiClient();
      if (apiConfig.enabled && client?.getSnapshot) {
        await this.refreshSnapshot();
        return this._state.queue;
      }
      try {
        if (!client?.getQueue) return [];
        const queue = await client.getQueue(servicoId || null);
        this._state.queue = Array.isArray(queue) ? queue : [];
        this._notify();
        return this._state.queue;
      } catch (_) { return []; }
    },

    async refreshStats() {
      const client = getApiClient();
      if (apiConfig.enabled && client?.getSnapshot) {
        await this.refreshSnapshot();
        return this._state.stats;
      }
      try {
        if (!client?.getStats) return this._state.stats;
        const stats = await client.getStats();
        this._state.stats = stats;
        this._notify();
        return stats;
      } catch (_) { return this._state.stats; }
    },

    /* ── Trabalhador ─────────────────────────────────────── */
    async callNext(serviceId, balcao) {
      const client = getApiClient();
      try {
        console.log("[CALL NEXT] Serviço:", serviceId, "| Balcão:", balcao);
        if (!client?.callNext) return { ok: false, message: "API indisponível" };

        const result = await client.callNext({
          servico_id: serviceId, numero_balcao: balcao
        });

        const senha = result?.data?.senha || result?.senha;

        if (result.ok && senha) {
          this._state.lastCall = senha;
          await this.refreshSnapshot();
          this._notify();
          console.log("[SUCCESS] Senha chamada:", senha.numero);
          return { ok: true, senha };
        }

        const message = result?.data?.mensagem || result?.mensagem ||
                        result?.message || "Nenhuma senha disponível";
        return { ok: false, message };

      } catch (error) {
        console.error("Erro callNext:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async startAttendance(senhaId, balcao) {
      const client = getApiClient();
      if (!client?.startAttendance) return { ok: false, message: "API indisponível" };
      try {
        const result = await client.startAttendance(senhaId, balcao);
        if (result.ok) { await this.refreshSnapshot(); this._notify(); }
        return result;
      } catch (_) { return { ok: false, message: "Erro de conexão" }; }
    },

    async finishAttendance(senhaId, observacoes) {
      const client = getApiClient();
      if (!client?.finishAttendance) return { ok: false, message: "API indisponível" };
      try {
        const result = await client.finishAttendance(senhaId, observacoes || "");
        if (result.ok) { await this.refreshSnapshot(); this._notify(); }
        return result;
      } catch (_) { return { ok: false, message: "Erro de conexão" }; }
    },

    /* ── Polling ─────────────────────────────────────────── */
    startPolling(intervalMs) {
      this.stopPolling();
      this._pollingInterval = setInterval(async () => {
        const client = getApiClient();
        if (apiConfig.enabled && client?.getSnapshot) await this.refreshSnapshot();
        else { await this.refreshQueue(); await this.refreshStats(); }
      }, Number(intervalMs) > 0 ? Number(intervalMs) : 5000);
    },

    stopPolling() {
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval);
        this._pollingInterval = null;
      }
    }
  };

  window.IMTSBStore = IMTSBStore;
  console.log("✅ IMTSBStore carregado (v4 — ApiClient lazy)");

})();