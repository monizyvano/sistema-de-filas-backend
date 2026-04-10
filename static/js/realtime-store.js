/**
 * REALTIME STORE — Sistema de Filas IMTSB
 * static/js/realtime-store.js
 * Documentado em PT-PT
 */

(function () {
  "use strict";

  const ApiClient = window.ApiClient;
  const apiConfig = window.IMTSBApiConfig || {};

  if (!ApiClient) {
    console.warn("⚠ ApiClient não carregado!");
  }

  const IMTSBStore = {

    _state: {
      user: null,
      queue: [],
      history: [],
      stats: { aguardando: 0, concluidas: 0, tempo_medio: 0 },
      currentTicket: null,
      lastCall: null
    },

    _listeners: [],

    subscribe(callback) {
      this._listeners.push(callback);
      return () => {
        const i = this._listeners.indexOf(callback);
        if (i > -1) this._listeners.splice(i, 1);
      };
    },

    onChange(callback) { return this.subscribe(callback); },

    _notify() { this._listeners.forEach(fn => fn(this._state)); },

    // ── Utilizador ──────────────────────────────────────────

    getUser() {
      const stored = localStorage.getItem("imtsb_user");
      if (stored) {
        try { return JSON.parse(stored); } catch { return null; }
      }
      return this._state.user;
    },

    getToken() {
      const user = this.getUser();
      return user ? (user.token || localStorage.getItem("imtsb_access_token")) : null;
    },

    isAuthenticated() { return !!this.getToken(); },
    isLoggedIn()      { return this.isAuthenticated(); },

    getCurrentTicket() { return this._state.currentTicket; },

    // ── Sessão ───────────────────────────────────────────────

    continueAsGuest() {
      const sessao = {
        id:      null,
        name:    "Visitante",
        email:   "visitante-" + Date.now() + "@guest.local",
        role:    "usuario",
        token:   "",
        isGuest: true
      };
      localStorage.setItem("imtsb_user", JSON.stringify(sessao));
      this._state.user = sessao;
      this._notify();
      return { ok: true, redirect: "/index.html" };
    },

    logout() {
      this._state.user          = null;
      this._state.queue         = [];
      this._state.history       = [];
      this._state.currentTicket = null;

      localStorage.removeItem("imtsb_user");
      localStorage.removeItem("imtsb_access_token");
      localStorage.removeItem("imtsb_refresh_token");

      this._notify();
      window.location.href = "/";
    },

    requireRole(allowedRoles) {
      const user  = this.getUser();
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Modo anónimo — permitir role "usuario"
      if (!user) {
        if (roles.includes("usuario")) {
          return { name: "Visitante", email: "", role: "usuario", isAnonymous: true };
        }
        window.location.href = "/logintcc.html";
        return null;
      }

      if (!roles.includes(user.role)) {
        console.warn("Acesso negado. Role necessário:", roles, "Role actual:", user.role);
        window.location.href = "/logintcc.html";
        return null;
      }

      return user;
    },

    // ── Login / Registo ──────────────────────────────────────

    async login(email, password) {
      if (!ApiClient) return { ok: false, message: "API indisponível" };
      try {
        const result = await ApiClient.login(email, password);
        if (!result.ok) return { ok: false, message: result.message || "Erro no login" };

        const user = {
          id:    result.id,
          name:  result.name,
          email: result.email,
          role:  result.role,
          token: result.token || result.raw?.access_token,
          balcao: result.balcao
        };

        this._state.user = user;
        localStorage.setItem("imtsb_user", JSON.stringify(user));
        this._notify();

        return { ok: true, user, role: result.role };
      } catch (e) {
        return { ok: false, message: "Erro de ligação" };
      }
    },

    async register(payload) {
      if (!ApiClient) return { ok: false, message: "API indisponível" };
      try {
        const result = await ApiClient.register(payload);
        return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
      } catch (e) {
        return { ok: false, message: "Erro de ligação" };
      }
    },

    // ── Snapshot ─────────────────────────────────────────────

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
      if (!ApiClient || !ApiClient.getSnapshot) return this.getSnapshot();
      try {
        const result = await ApiClient.getSnapshot();
        if (!result.ok) return this.getSnapshot();
        const data = result.data || {};
        this._state.queue      = Array.isArray(data.queue)   ? data.queue   : [];
        this._state.history    = Array.isArray(data.history) ? data.history : [];
        this._state.users      = Array.isArray(data.users)   ? data.users   : [];
        this._state.lastCall   = data.lastCalled || data.lastCall || null;
        this._state.stats      = data.stats || this._state.stats;
        this._state.updatedAt  = data.updatedAt || null;
        this._notify();
        return this.getSnapshot();
      } catch (e) {
        return this.getSnapshot();
      }
    },

    // ── Senhas ───────────────────────────────────────────────

    async issueTicket(serviceId, tipo = "normal", contato = null) {
      if (!ApiClient) return { ok: false, message: "API indisponível" };
      try {
        const result = await ApiClient.issueTicket({ servico_id: serviceId, tipo, usuario_contato: contato });
        if (!result.ok) return { ok: false, message: result.message };
        this._state.currentTicket = result.ticket;
        await this.refreshSnapshot();
        this._notify();
        return { ok: true, ticket: result.ticket };
      } catch (e) {
        return { ok: false, message: "Erro de ligação" };
      }
    },

    async callNext(serviceId, balcao) {
      if (!ApiClient) return { ok: false, message: "API indisponível" };
      try {
        const result = await ApiClient.callNext({ servico_id: serviceId, numero_balcao: balcao });
        const senha  = result?.data?.senha || result?.senha;

        if (result.ok && senha) {
          this._state.lastCall = senha;
          await this.refreshSnapshot();
          this._notify();
          return { ok: true, senha };
        }

        const msg = result?.data?.mensagem || result?.message || "Nenhuma senha disponível";
        return { ok: false, message: msg };
      } catch (e) {
        return { ok: false, message: "Erro de ligação" };
      }
    },

    async refreshQueue(servicoId = null) {
      if (!ApiClient) return [];
      try {
        const queue = await ApiClient.getQueue(servicoId);
        this._state.queue = Array.isArray(queue) ? queue : [];
        this._notify();
        return this._state.queue;
      } catch (e) { return []; }
    },

    async refreshStats() {
      if (!ApiClient) return this._state.stats;
      try {
        const stats = await ApiClient.getStats();
        this._state.stats = stats;
        this._notify();
        return stats;
      } catch (e) { return this._state.stats; }
    },

    // ── Polling ──────────────────────────────────────────────

    _pollingInterval: null,

    startPolling(intervalMs = 5000) {
      this.stopPolling();
      this._pollingInterval = setInterval(async () => {
        await this.refreshSnapshot();
      }, intervalMs);
    },

    stopPolling() {
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval);
        this._pollingInterval = null;
      }
    }
  };

  window.IMTSBStore = IMTSBStore;
  console.log("✅ IMTSBStore carregado");

})();