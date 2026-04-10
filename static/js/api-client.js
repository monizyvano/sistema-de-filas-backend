/**
 * API CLIENT — Sistema de Filas IMTSB
 * static/js/api-client.js
 * Documentado em PT-PT
 */

(function () {
  "use strict";

  const config  = window.IMTSBApiConfig;
  const adapter = window.ApiAdapter;

  if (!config || !config.enabled) {
    console.warn("⚠ API desactivada no api-config.js");
    return;
  }

  // ── Helpers de token ──────────────────────────────────────
  function getAccessToken()  { return localStorage.getItem(config.accessTokenStorageKey); }
  function getRefreshToken() { return localStorage.getItem(config.refreshTokenStorageKey); }

  function setTokens(data) {
    if (!data || typeof data !== "object") return;
    const access  = data.access_token  || data.accessToken  || data.token || null;
    const refresh = data.refresh_token || data.refreshToken || null;
    if (access)  localStorage.setItem(config.accessTokenStorageKey,  access);
    if (refresh) localStorage.setItem(config.refreshTokenStorageKey, refresh);
  }

  function clearSession() {
    localStorage.removeItem(config.accessTokenStorageKey);
    localStorage.removeItem(config.refreshTokenStorageKey);
    localStorage.removeItem("imtsb_user");
  }

  // ── Pedido base ──────────────────────────────────────────
  async function apiRequest(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...options.headers };
    const token   = getAccessToken();
    if (token && !options.skipAuth) {
      headers[config.authHeaderName || "Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${config.baseUrl}${path}`, { ...options, headers });
      const data     = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, status: response.status, message: data.erro || data.message || "Erro na API" };
      }

      return { ok: true, data };
    } catch (error) {
      console.error("❌ Erro de ligação:", error);
      return { ok: false, message: "Erro de ligação com o servidor" };
    }
  }

  // ── API pública ───────────────────────────────────────────
  const ApiClient = {
    getAccessToken,
    getRefreshToken,
    clearSession,

    /**
     * Login — aceita login(email, senha) ou login({ email, password })
     */
    async login(emailOrPayload, senhaParam) {
      const email = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? (emailOrPayload.email || "")
        : (emailOrPayload || "");

      const senha = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? (emailOrPayload.password || emailOrPayload.senha || "")
        : (senhaParam || "");

      const result = await apiRequest("/auth/login", {
        method:    "POST",
        body:      JSON.stringify({ email, senha }),
        skipAuth:  true
      });

      if (!result.ok) {
        return { ok: false, message: result.message || "Email ou senha inválidos" };
      }

      setTokens(result.data);

      const adapted = adapter && adapter.adaptLoginResponse
        ? adapter.adaptLoginResponse(result.data, email)
        : result.data;

      return { ok: true, raw: result.data, ...adapted };
    },

    /**
     * Registo de novo utilizador
     */
    async register(payload) {
      const body = {
        nome:  payload.name  || payload.nome  || "",
        email: payload.email || "",
        senha: payload.password || payload.senha || "",
        tipo:  "atendente"
      };

      const result = await apiRequest("/auth/register", {
        method:   "POST",
        body:     JSON.stringify(body),
        skipAuth: true
      });

      if (!result.ok) {
        return { ok: false, message: result.message || "Erro no registo" };
      }

      return { ok: true, data: result.data };
    },

    logout() {
      clearSession();
      window.location.href = "/";
    },

    async getServices() {
      const result = await apiRequest("/servicos");
      if (result.ok) {
        return Array.isArray(result.data) ? result.data : (result.data.servicos || []);
      }
      return [];
    },

    async issueTicket(frontendData) {
      const backendData = adapter && adapter.adaptIssueTicket
        ? adapter.adaptIssueTicket(frontendData)
        : frontendData;

      const result = await apiRequest("/senhas/emitir", {
        method: "POST",
        body:   JSON.stringify(backendData)
      });

      if (!result.ok) return { ok: false, message: result.message || "Erro ao emitir senha" };

      const ticket = adapter && adapter.adaptTicketResponse
        ? adapter.adaptTicketResponse(result.data.senha || result.data)
        : result.data;

      return { ok: true, ticket };
    },

    async getQueue(servicoId = null) {
      const query  = servicoId
        ? `/senhas?status=aguardando&servico_id=${servicoId}&page=1&per_page=100`
        : "/senhas?status=aguardando&page=1&per_page=100";
      const result = await apiRequest(query);
      if (!result.ok) return [];
      return Array.isArray(result.data) ? result.data : (result.data.senhas || []);
    },

    async callNext(dataFrontend) {
      const backendData = adapter && adapter.adaptCallNext
        ? adapter.adaptCallNext(dataFrontend)
        : dataFrontend;
      return apiRequest("/filas/chamar", {
        method: "POST",
        body:   JSON.stringify(backendData)
      });
    },

    async startAttendance(id, numero_balcao) {
      return apiRequest(`/senhas/${id}/iniciar`, {
        method: "PUT",
        body:   JSON.stringify({ numero_balcao })
      });
    },

    async finishAttendance(id, observacoes = "") {
      return apiRequest(`/senhas/${id}/finalizar`, {
        method: "PUT",
        body:   JSON.stringify({ observacoes })
      });
    },

    async getStats() {
      const result = await apiRequest("/senhas/estatisticas");
      return result.ok ? (result.data || {}) : { aguardando: 0, concluidas: 0, tempo_medio_espera: 0 };
    },

    async getSnapshot() {
      const snap = await apiRequest("/realtime/snapshot");
      if (snap.ok) return { ok: true, data: snap.data };

      const [queue, stats] = await Promise.all([this.getQueue(), this.getStats()]);
      return {
        ok: true,
        data: { queue: Array.isArray(queue) ? queue : [], history: [], users: [], lastCalled: null, stats: stats || {} }
      };
    },

    async healthCheck() {
      const result = await apiRequest("/auth/health", { skipAuth: true });
      return result.ok ? result.data : { status: "offline" };
    }
  };

  window.ApiClient        = ApiClient;
  window.IMTSBApiClient   = ApiClient;

  console.log("✅ API Client carregado");

  ApiClient.healthCheck().then(s => console.log("🏥 Backend:", s.status || "offline"));

})();