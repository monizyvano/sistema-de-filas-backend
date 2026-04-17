/**
 * API CLIENT
 * static/js/api-client.js
 */
(function () {
  "use strict";

  const config = window.IMTSBApiConfig;
  const adapter = window.ApiAdapter;

  if (!config || !config.enabled) {
    console.warn("API desativada no api-config.js");
    return;
  }

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

  function resolveBaseCandidates() {
    const configured = String(config.baseUrl || "/api").replace(/\/$/, "");
    const host = String(window.location.hostname || "").toLowerCase();
    const candidates = [configured];

    if (configured.includes("localhost:5000")) {
      candidates.push(configured.replace("localhost:5000", "127.0.0.1:5000"));
    } else if (configured.includes("127.0.0.1:5000")) {
      candidates.push(configured.replace("127.0.0.1:5000", "localhost:5000"));
    } else if (host === "localhost") {
      candidates.push("http://127.0.0.1:5000/api");
    } else if (host === "127.0.0.1") {
      candidates.push("http://localhost:5000/api");
    } else {
      candidates.push("http://localhost:5000/api");
      candidates.push("http://127.0.0.1:5000/api");
    }

    return Array.from(new Set(candidates));
  }

  async function apiRequest(path, options) {
    const opts = options || {};
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    const token = getAccessToken();

    if (token && !opts.skipAuth) {
      headers[config.authHeaderName || "Authorization"] = `Bearer ${token}`;
    }

    const bases = resolveBaseCandidates();
    let lastNetworkError = null;

    for (let i = 0; i < bases.length; i += 1) {
      const baseUrl = bases[i];

      try {
        const response = await fetch(`${baseUrl}${path}`, Object.assign({}, opts, { headers }));
        const data = await response.json().catch(function () {
          return {};
        });

        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            message: data.erro || data.message || "Erro na API",
            data
          };
        }

        return { ok: true, data, baseUrlUsed: baseUrl };
      } catch (error) {
        lastNetworkError = error;
      }
    }

    return {
      ok: false,
      message: "Erro de conexao com servidor",
      error: String(lastNetworkError || "")
    };
  }

  const ApiClient = {
    getAccessToken,
    getRefreshToken,
    clearSession,

    async login(emailOrPayload, senhaMaybe) {
      const email = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? String(emailOrPayload.email || "")
        : String(emailOrPayload || "");
      const senha = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? String(emailOrPayload.senha || emailOrPayload.password || "")
        : String(senhaMaybe || "");

    async login(emailOrPayload, senhaParam) {
      // Compat: aceita tanto login(email, senha) quanto login({ email, password|senha })
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
        return { ok: false, message: result.message || "Email ou senha invalidos" };
      }

      setTokens(result.data);

      const adapted = adapter && typeof adapter.adaptLoginResponse === "function"
        ? adapter.adaptLoginResponse(result.data, email)
        : {
            ok: true,
            token: result.data.access_token || result.data.token || null,
            id: result.data.id,
            name: result.data.nome || result.data.name,
            email,
            role: result.data.role || "usuario"
          };

      return Object.assign({ ok: true, raw: result.data }, adapted);
    },

    async register(payload) {
      const body = {
        nome: payload && (payload.name || payload.nome) || "",
        email: payload && payload.email || "",
        senha: payload && (payload.password || payload.senha) || "",
        tipo: payload && payload.tipo || "usuario"
      };

      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
        skipAuth: true
      });

      if (!result.ok) {
        return { ok: false, message: result.message || "Erro no cadastro" };
      }

      return { ok: true, data: result.data };
    },

    async logout() {
      clearSession();
      return { ok: true };
    },

    async issueTicket(frontendData) {
      const backendData = adapter && typeof adapter.adaptIssueTicket === "function"
        ? adapter.adaptIssueTicket(frontendData)
        : frontendData;

      const result = await apiRequest("/senhas", {
        method: "POST",
        body: JSON.stringify(backendData)
      });

      if (!result.ok) {
        return { ok: false, message: result.message || "Erro ao emitir senha" };
      }

      const ticket = adapter && typeof adapter.adaptTicketResponse === "function"
        ? adapter.adaptTicketResponse(result.data.senha || result.data)
        : (result.data.senha || result.data);

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
      const backendData = adapter && typeof adapter.adaptCallNext === "function"
        ? adapter.adaptCallNext(dataFrontend)
        : (dataFrontend || {});

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

    async finishAttendance(id, observacoes) {
      return apiRequest(`/senhas/${id}/finalizar`, {
        method: "PUT",
        body: JSON.stringify({ observacoes: observacoes || "" })
      });
    },

    async getQueue(servicoId) {
      const query = servicoId
        ? `/senhas?status=aguardando&servico_id=${servicoId}&page=1&per_page=100`
        : "/senhas?status=aguardando&page=1&per_page=100";

      const result = await apiRequest(query);
      if (!result.ok) return [];
      if (Array.isArray(result.data)) return result.data;
      return result.data?.senhas || [];
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
      const result = await apiRequest("/auth/health", { skipAuth: true });
      return result.ok ? result.data : { status: "offline" };
    }
  };

  window.ApiClient = ApiClient;

  console.log("✅ API Client carregado (corrigido)");

  // Health check inicial
  ApiClient.healthCheck().then(status => {
    console.log("🏥 Backend status:", status.status || "offline");
  });

})();
