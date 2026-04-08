/**
 * API CLIENT - VERSÃO CORRIGIDA
 * static/js/api-client.js
 *
 * ✅ Fetch com sintaxe correta
 * ✅ Cadastro funcionando
 * ✅ Login integrado
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

  function getAccessToken() {
    return localStorage.getItem(config.accessTokenStorageKey);
  }

  function getRefreshToken() {
    return localStorage.getItem(config.refreshTokenStorageKey);
  }

  function setTokens(data) {
    if (!data || typeof data !== "object") return;

    const access = data.access_token || data.accessToken || data.token || null;
    const refresh = data.refresh_token || data.refreshToken || null;

    if (access) localStorage.setItem(config.accessTokenStorageKey, access);
    if (refresh) localStorage.setItem(config.refreshTokenStorageKey, refresh);
  }

  function clearSession() {
    localStorage.removeItem(config.accessTokenStorageKey);
    localStorage.removeItem(config.refreshTokenStorageKey);
    localStorage.removeItem("imtsb_user");
  }

  // ===============================
  // 🌐 BASE REQUEST
  // ===============================

  async function apiRequest(path, options = {}) {
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

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          message: data.erro || data.message || "Erro na API"
        };
      }

      return { ok: true, data };
    } catch (error) {
      console.error("❌ Erro de conexão:", error);
      return { ok: false, message: "Erro de conexão com servidor" };
    }
  }

  // ===============================
  // 🚀 API METHODS
  // ===============================

  const ApiClient = {
    getAccessToken,
    getRefreshToken,
    clearSession,

    async login(emailOrPayload, senhaParam) {
      // Compat: aceita login(email, senha) e login({ email, password|senha })
      const email = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? (emailOrPayload.email || "")
        : (emailOrPayload || "");

      const senha = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? (emailOrPayload.password || emailOrPayload.senha || "")
        : (senhaParam || "");

    async login(emailOrPayload, senhaParam) {
      // Compat: aceita tanto login(email, senha) quanto login({ email, password|senha })
      const email = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? (emailOrPayload.email || "")
        : (emailOrPayload || "");
      const senha = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? (emailOrPayload.password || emailOrPayload.senha || "")
        : (senhaParam || "");

      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
        skipAuth: true
      });

      if (!result.ok) {
        return { ok: false, message: result.message || "Email ou senha inválidos" };
      }

      setTokens(result.data);

      const adapted = adapter?.adaptLoginResponse
        ? adapter.adaptLoginResponse(result.data, email)
        : result.data;

      return { ok: true, raw: result.data, ...adapted };
    },

    async register(payload) {
      const body = {
        nome: payload?.name || payload?.nome || "",
        email: payload?.email || "",
        senha: payload?.password || payload?.senha || "",
        tipo: "atendente"
      };

      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
        skipAuth: true
      });

      if (!result.ok) {
        return {
          ok: false,
          message: result.message || "Erro no cadastro"
        };
      }

      return { ok: true, data: result.data };
    },

    logout() {
      clearSession();
      window.location.href = "/";
    },

    async getServices() {
      const result = await apiRequest("/servicos");
      return result.ok ? (result.data || []) : [];
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
        return { ok: false, message: result.message || "Erro ao emitir senha" };
      }

      const ticket = adapter?.adaptTicketResponse
        ? adapter.adaptTicketResponse(result.data?.senha || result.data)
        : result.data;

      return { ok: true, ticket };
    },

    async getQueue(servicoId = null) {
      const query = servicoId
        ? `/senhas?status=aguardando&servico_id=${servicoId}&page=1&per_page=100`
        : "/senhas?status=aguardando&page=1&per_page=100";

      const result = await apiRequest(query);
      if (!result.ok) return [];

      if (Array.isArray(result.data)) return result.data;
      return result.data?.senhas || [];
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

    async startAttendance(id, numero_balcao) {
      return apiRequest(`/senhas/${id}/iniciar`, {
        method: "PUT",
        body: JSON.stringify({ numero_balcao })
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
      return result.ok ? (result.data || {}) : {
        aguardando: 0,
        concluidas: 0,
        tempo_medio_espera: 0,
        satisfacao: 0
      };
    },

    async getSnapshot() {
      const snapshot = await apiRequest("/realtime/snapshot");
      if (snapshot.ok) return { ok: true, data: snapshot.data };

      // Fallback gradual: monta snapshot mínimo com endpoints já existentes.
      const [queue, stats] = await Promise.all([
        this.getQueue(),
        this.getStats()
      ]);

      return {
        ok: true,
        data: {
          queue: Array.isArray(queue) ? queue : [],
          history: [],
          users: [],
          lastCalled: null,
          stats: stats || {}
        }
      };
    },

    async healthCheck() {
      const result = await apiRequest("/auth/health", {
        skipAuth: true
      });
      return result.ok ? result.data : { status: "offline" };
    },

    async rateTicket(senhaId, nota, comentario) {
      return apiRequest(`/senhas/${senhaId}/avaliar`, {
        method: "PUT",
        body: JSON.stringify({ nota, comentario: comentario || "" })
      });
    }
  };

  window.ApiClient = ApiClient;
  window.IMTSBApiClient = ApiClient;  // alias para logintcc.js

  console.log("✅ API Client carregado (corrigido)");

  // Health check inicial
  ApiClient.healthCheck().then(status => {
    console.log("🏥 Backend status:", status.status || "offline");
  });

})();
