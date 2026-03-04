/**
 * API CLIENT - Integração Real com Backend Flask + JWT Refresh
 * Arquitetura compatível com IMTSBApiConfig + ApiAdapter
 * Versão melhorada com controle de refresh concorrente
 */

(function () {
  "use strict";

  const config = window.IMTSBApiConfig;
  const adapter = window.ApiAdapter;

  if (!config || !config.enabled) {
    console.warn("⚠ API desativada no api-config.js");
    return;
  }

  // ===============================
  // 🔐 TOKEN HELPERS
  // ===============================

  let isRefreshing = false;
  let refreshPromise = null;

  function getAccessToken() {
    return localStorage.getItem(config.accessTokenStorageKey);
  }

  function getRefreshToken() {
    return localStorage.getItem(config.refreshTokenStorageKey);
  }

  function setTokens(data) {
    if (!data) return;

    const access = data.access_token || data.accessToken || null;
    const refresh = data.refresh_token || data.refreshToken || null;

    if (access) {
      localStorage.setItem(config.accessTokenStorageKey, access);
    }

    if (refresh) {
      localStorage.setItem(config.refreshTokenStorageKey, refresh);
    }
  }

  function clearSession() {
    localStorage.removeItem(config.accessTokenStorageKey);
    localStorage.removeItem(config.refreshTokenStorageKey);
  }

  function redirectToLogin() {
    clearSession();
    window.location.href = "/login";
  }

  // ===============================
  // 🔁 REFRESH TOKEN (ROBUSTO)
  // ===============================

  async function refreshToken() {
    if (isRefreshing) {
      return refreshPromise;
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      redirectToLogin();
      return false;
    }

    isRefreshing = true;

    refreshPromise = fetch(`${config.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [config.authHeaderName]: `Bearer ${refresh}`
      }
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Refresh inválido");
        }

        setTokens(data);
        console.log("🔄 Access token renovado com sucesso");
        return true;
      })
      .catch(() => {
        console.warn("❌ Refresh falhou");
        redirectToLogin();
        return false;
      })
      .finally(() => {
        isRefreshing = false;
      });

    return refreshPromise;
  }

  // ===============================
  // 🌐 BASE REQUEST (COM RETRY)
  // ===============================

  async function apiRequest(path, options = {}, retry = true) {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers
    };

    const token = getAccessToken();
    if (token && !options.skipAuth) {
      headers[config.authHeaderName] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));

      // 🔥 TOKEN EXPIRADO
      if (response.status === 401 && retry && !options.skipAuth) {
        const refreshed = await refreshToken();

        if (refreshed) {
          return apiRequest(path, options, false);
        }

        return { ok: false, message: "Sessão expirada" };
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          message: data.message || "Erro na API"
        };
      }

      return { ok: true, data };

    } catch (error) {
      console.error("❌ Erro de conexão:", error);
      return { ok: false, message: "Erro de conexão com servidor" };
    }
  }

  // ===============================
  // 🚀 API METHODS (INALTERADOS)
  // ===============================

  const ApiClient = {

    async login(email, senha) {
      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
        skipAuth: true
      });

      if (!result.ok) {
        return { ok: false, message: "Email ou senha inválidos" };
      }

      setTokens(result.data);

      const adapted = adapter?.adaptLoginResponse
        ? adapter.adaptLoginResponse(result.data)
        : result.data;

      return { ok: true, ...adapted };
    },

    async logout() {
      await apiRequest("/auth/logout", { method: "POST" });
      redirectToLogin();
    },

    async getServices() {
      const result = await apiRequest("/servicos");
      return result.ok ? result.data : [];
    },

    async issueTicket(frontendData) {
      const backendData = adapter?.adaptIssueTicket
        ? adapter.adaptIssueTicket(frontendData)
        : frontendData;

      const result = await apiRequest("/senhas", {
        method: "POST",
        body: JSON.stringify(backendData)
      });

      if (!result.ok) {
        return { ok: false, message: "Erro ao emitir senha" };
      }

      const ticket = adapter?.adaptTicketResponse
        ? adapter.adaptTicketResponse(result.data.senha)
        : result.data;

      return { ok: true, ticket };
    },

    async getQueue(servicoId = null) {
      const path = servicoId
        ? `/filas/${servicoId}`
        : "/senhas";

      const result = await apiRequest(path);
      return result.ok ? result.data : [];
    },

    async callNext(dataFrontend) {
      const backendData = adapter?.adaptCallNext
        ? adapter.adaptCallNext(dataFrontend)
        : dataFrontend;

      return apiRequest("/filas/chamar", {
        method: "POST",
        body: JSON.stringify(backendData)
      });
    },

    async startAttendance(id) {
      return apiRequest(`/senhas/${id}/iniciar`, {
        method: "PUT"
      });
    },

    async finishAttendance(id, observacoes = "") {
      return apiRequest(`/senhas/${id}/finalizar`, {
        method: "PUT",
        body: JSON.stringify({ observacoes })
      });
    },

    async getStats() {
      const result = await apiRequest("/senhas/estatisticas");
      return result.ok ? result.data : {};
    },

    async healthCheck() {
      const result = await apiRequest("/auth/health", {
        skipAuth: true
      });
      return result.ok ? result.data : { status: "offline" };
    }
  };

  window.ApiClient = ApiClient;

  console.log("✅ API Client carregado (JWT + Refresh automático robusto)");

  ApiClient.healthCheck();

})();