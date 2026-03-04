(function () {
  "use strict";

  const apiEnabled =
    window.IMTSBApiConfig &&
    window.IMTSBApiConfig.enabled;

  if (apiEnabled) {
    console.log("✅ API real ativada - Mock desabilitado");

    const ACCESS_KEY = "imtsb_access_token";
    const REFRESH_KEY = "imtsb_refresh_token";
    const USER_KEY = "imtsb_user";

    function saveSession(data) {
      localStorage.setItem(ACCESS_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }

    function clearSession() {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    }

    function getUser() {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    const store = {
      apiEnabled: true,
      apiClient: window.ApiClient || null,

      // ===============================
      // 🔐 AUTH
      // ===============================

      async login(email, senha) {
        if (!this.apiClient) {
          return { ok: false, message: "API indisponível." };
        }

        const result = await this.apiClient.login(email, senha);

        if (!result.ok) return result;

        saveSession(result);

        return {
          ok: true,
          user: result.user,
          redirect: result.redirect || "index.html"
        };
      },

      async logout() {
        try {
          if (this.apiClient) {
            await this.apiClient.logout();
          }
        } catch (_) {}

        clearSession();
        window.location.href = "logintcc.html";
      },

      getSession() {
        const token = localStorage.getItem(ACCESS_KEY);
        if (!token) return null;

        return getUser();
      },

      requireRole(roles) {
        const user = getUser();

        if (!user || (roles && !roles.includes(user.role))) {
          window.location.href = "logintcc.html";
          return null;
        }

        return user;
      },

      // ===============================
      // 🎫 SENHAS
      // ===============================

      async issueTicket(payload) {
        return this.apiClient.issueTicket(payload);
      },

      async callNext(payload) {
        return this.apiClient.callNext(payload);
      },

      async concludeCurrent(payload) {
        return this.apiClient.finishAttendance(payload);
      },

      async startAttendance(id) {
        return this.apiClient.startAttendance(id);
      },

      async getQueue(servicoId) {
        return this.apiClient.getQueue(servicoId);
      },

      async getStats() {
        return this.apiClient.getStats();
      },

      async healthCheck() {
        return this.apiClient.healthCheck();
      },

      // Compatibilidade UI
      onChange() {
        return function () {};
      },

      getSnapshot() {
        return {
          updatedAt: new Date().toISOString(),
          users: [],
          queue: [],
          history: [],
          dailyArchives: [],
          lastCalled: null
        };
      },

      ensureSeed() {}
    };

    window.IMTSBStore = store;
    return;
  }

  // ===============================
  // 🧪 MODO MOCK
  // ===============================

  console.log("🧪 Modo Mock ativado");

  const store = {
    apiEnabled: false,

    login() {
      return { ok: false, message: "Modo mock ativo." };
    },

    logout() {
      localStorage.removeItem("imtsb_session_v1");
    },

    getSnapshot() {
      return {
        updatedAt: new Date().toISOString(),
        users: [],
        queue: [],
        history: []
      };
    }
  };

  window.IMTSBStore = store;
})();