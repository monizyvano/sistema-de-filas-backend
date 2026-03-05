/**
 * REALTIME-STORE.JS - CAMADA DE COMPATIBILIDADE
 * 
 * Mantém interface do IMTSBStore mas delega para API real
 * Localização: static/js/realtime-store.js
 */

(function () {
  "use strict";

  const apiEnabled = window.IMTSBApiConfig && window.IMTSBApiConfig.enabled;

  if (!apiEnabled) {
    console.log("🧪 Modo Mock ativado (API desabilitada)");
    window.IMTSBStore = {
      login: () => ({ ok: false, message: "API desabilitada" }),
      logout: () => window.location.href = "/login",
      requireRole: () => null,
      getSnapshot: () => ({ queue: [], history: [], users: [] })
    };
    return;
  }

  console.log("✅ API real ativada - Store integrado");

  // ===============================
  // 🔐 GERENCIAMENTO DE SESSÃO
  // ===============================

  const ACCESS_KEY = "imtsb_access_token";
  const REFRESH_KEY = "imtsb_refresh_token";
  const USER_KEY = "imtsb_user";

  function saveSession(loginResult) {
    if (loginResult.accessToken) {
      localStorage.setItem(ACCESS_KEY, loginResult.accessToken);
    }
    if (loginResult.refreshToken) {
      localStorage.setItem(REFRESH_KEY, loginResult.refreshToken);
    }
    if (loginResult.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(loginResult.user));
    }
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

  // ===============================
  // 📦 STORE COMPATÍVEL
  // ===============================

  const IMTSBStore = {
    apiEnabled: true,

    // ===== AUTENTICAÇÃO =====

    async login(email, senha, tipo) {
      if (!window.ApiClient) {
        return { ok: false, message: "ApiClient não carregado" };
      }

      try {
        const result = await window.ApiClient.login(email, senha);

        if (!result.ok) {
          return { ok: false, message: result.message || "Login falhou" };
        }

        // Salvar sessão
        saveSession(result);

        return {
          ok: true,
          user: result.user,
          redirect: result.redirect || "/index.html"
        };

      } catch (error) {
        console.error("Erro no login:", error);
        return { ok: false, message: "Erro ao conectar com servidor" };
      }
    },

    logout() {
      clearSession();
      window.location.href = "/login";
    },

    // ===== CONTROLE DE ACESSO =====

    requireRole(allowedRoles) {
      const user = getUser();

      if (!user) {
        window.location.href = "/login";
        return null;
      }

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        window.location.href = "/login";
        return null;
      }

      return user;
    },

    getSession() {
      return getUser();
    },

    // ===== SENHAS =====

    async issueTicket(payload) {
      try {
        return await window.ApiClient.issueTicket(payload);
      } catch (error) {
        return { ok: false, message: "Erro ao emitir senha" };
      }
    },

    async callNext(payload) {
      try {
        const result = await window.ApiClient.callNext(payload);
        
        if (result.ok && result.data) {
          const adapted = window.ApiAdapter?.adaptTicketResponse 
            ? window.ApiAdapter.adaptTicketResponse(result.data.senha)
            : result.data;
          
          return { ok: true, ticket: adapted };
        }
        
        return result;
      } catch (error) {
        return { ok: false, message: "Erro ao chamar senha" };
      }
    },

    async startAttendance(senhaId) {
      try {
        return await window.ApiClient.startAttendance(senhaId);
      } catch (error) {
        return { ok: false, message: "Erro ao iniciar atendimento" };
      }
    },

    async concludeCurrent(attendantName, notes, durationSec) {
      // TODO: Implementar quando backend tiver endpoint
      console.warn("concludeCurrent: não implementado ainda");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async redirectCurrent(attendantName, notes) {
      // TODO: Implementar quando backend tiver endpoint
      console.warn("redirectCurrent: não implementado ainda");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async setCurrentNote(note, attendantName) {
      // TODO: Implementar quando backend tiver endpoint
      console.warn("setCurrentNote: não implementado ainda");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async markReceived(ticketId, userEmail) {
      // TODO: Implementar quando backend tiver endpoint
      console.warn("markReceived: não implementado ainda");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async rateTicket(ticketId, userEmail, score, comment) {
      // TODO: Implementar quando backend tiver endpoint
      console.warn("rateTicket: não implementado ainda");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async setReceipt(ticketId, receipt) {
      // TODO: Implementar quando backend tiver endpoint
      console.warn("setReceipt: não implementado ainda");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    // ===== FILAS =====

    async getQueue(servicoId) {
      try {
        const data = await window.ApiClient.getQueue(servicoId);
        return Array.isArray(data) ? data : [];
      } catch (error) {
        return [];
      }
    },

    async getStats() {
      try {
        return await window.ApiClient.getStats();
      } catch (error) {
        return { waiting: 0, completed: 0, avgWaitTime: 0 };
      }
    },

    // ===== SNAPSHOT (COMPATIBILIDADE UI) =====

    getSnapshot() {
      // Retornar estrutura vazia para compatibilidade
      // Dashboards devem buscar dados via API diretamente
      return {
        updatedAt: new Date().toISOString(),
        users: [],
        queue: [],
        history: [],
        dailyArchives: [],
        lastCalled: null
      };
    },

    // ===== EVENTOS (COMPATIBILIDADE UI) =====

    onChange(callback) {
      // Não faz nada - dashboards devem usar polling
      return () => {};
    },

    // ===== ADMIN =====

    async addWorker(payload) {
      // TODO: Implementar endpoint de admin
      console.warn("addWorker: não implementado");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async removeWorker(workerId) {
      // TODO: Implementar endpoint de admin
      console.warn("removeWorker: não implementado");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async register(payload) {
      // TODO: Implementar registro de usuário
      console.warn("register: não implementado");
      return { ok: false, message: "Função em desenvolvimento" };
    },

    async archiveAndResetDay(label) {
      // TODO: Implementar reset de dia
      console.warn("archiveAndResetDay: não implementado");
      return { ok: false, message: "Função em desenvolvimento" };
    }
  };

  // ===============================
  // 📢 EXPORTAR
  // ===============================

  window.IMTSBStore = IMTSBStore;

  console.log("✅ IMTSBStore integrado com API real");

})();