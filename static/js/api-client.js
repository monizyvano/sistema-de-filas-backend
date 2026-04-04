<<<<<<< Updated upstream
﻿/**
 * API CLIENT - VERSÃO CORRIGIDA
 * static/js/api-client.js
 * 
 * ✅ Fetch com sintaxe correta
 * ✅ Cadastro funcionando
 * ✅ Login integrado
 */

=======
>>>>>>> Stashed changes
(function () {
  "use strict";

  const config = window.IMTSBApiConfig;
  const adapter = window.ApiAdapter;

  if (!config || !config.enabled) {
    console.warn("API desativada no api-config.js");
    return;
  }

<<<<<<< Updated upstream
  // ===============================
  // 🔐 TOKEN HELPERS
  // ===============================

=======
>>>>>>> Stashed changes
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
    const list = [configured];

    if (configured.includes("localhost:5000")) {
      list.push(configured.replace("localhost:5000", "127.0.0.1:5000"));
    } else if (configured.includes("127.0.0.1:5000")) {
      list.push(configured.replace("127.0.0.1:5000", "localhost:5000"));
    } else if (host === "localhost") {
      list.push("http://127.0.0.1:5000/api");
    } else if (host === "127.0.0.1") {
      list.push("http://localhost:5000/api");
    } else {
      list.push("http://localhost:5000/api");
      list.push("http://127.0.0.1:5000/api");
    }

    return Array.from(new Set(list));
  }

<<<<<<< Updated upstream
  // ===============================
  // 🌐 BASE REQUEST (CORRIGIDO)
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
      // ✅ CORRIGIDO: Sintaxe correta do fetch
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

=======
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
        const data = await response.json().catch(function () { return {}; });

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

>>>>>>> Stashed changes
  const ApiClient = {
    getAccessToken,
    getRefreshToken,
    clearSession,

    async login(emailOrPayload, senhaMaybe) {
      const email = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? String(emailOrPayload.email || "")
        : String(emailOrPayload || "");
      const senha = typeof emailOrPayload === "object" && emailOrPayload !== null
        ? String(emailOrPayload.senha || "")
        : String(senhaMaybe || "");

      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, senha }),
        skipAuth: true
      });

      if (!result.ok) {
        return { ok: false, message: result.message || "Email ou senha invalidos" };
      }

      setTokens(result.data);

<<<<<<< Updated upstream
      const adapted = adapter?.adaptLoginResponse
        ? adapter.adaptLoginResponse(result.data, email)
        : result.data;
=======
      const adapted = adapter && typeof adapter.adaptLoginResponse === "function"
        ? adapter.adaptLoginResponse(result.data, email)
        : { ok: true, user: result.data.atendente || {}, redirect: "/index.html" };
>>>>>>> Stashed changes

      return { ok: true, user: adapted.user, redirect: adapted.redirect || "/index.html", raw: result.data };
    },

<<<<<<< Updated upstream
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
=======
    async logout() {
      clearSession();
      return { ok: true };
>>>>>>> Stashed changes
    },

    async issueTicket(frontendData) {
      const backendData = adapter && typeof adapter.mapService === "function"
        ? {
            servico_id: adapter.mapService(frontendData.service).servico_id,
            tipo: adapter.mapService(frontendData.service).tipo,
            usuario_contato: frontendData.userEmail || ""
          }
        : frontendData;

      const result = await apiRequest("/senhas", {
        method: "POST",
        body: JSON.stringify(backendData)
      });

<<<<<<< Updated upstream
      if (!result.ok) {
        return { ok: false, message: result.message || "Erro ao emitir senha" };
      }
=======
      if (!result.ok) return { ok: false, message: result.message || "Erro ao emitir senha" };
>>>>>>> Stashed changes

      const ticket = adapter && typeof adapter.adaptTicketResponse === "function"
        ? adapter.adaptTicketResponse(result.data.senha || result.data)
        : result.data;

      return { ok: true, ticket };
    },

<<<<<<< Updated upstream
    async getQueue(servicoId = null) {
      const query = servicoId
        ? `/senhas?status=aguardando&servico_id=${servicoId}`
        : "/senhas?status=aguardando";

      const result = await apiRequest(query);
      if (!result.ok) return [];

      if (Array.isArray(result.data)) return result.data;
      return result.data?.senhas || [];
    },

=======
>>>>>>> Stashed changes
    async callNext(dataFrontend) {
      return apiRequest("/filas/chamar", {
        method: "POST",
        body: JSON.stringify(dataFrontend || {})
      });
    },

<<<<<<< Updated upstream
    async startAttendance(id, numero_balcao) {
      return apiRequest(`/senhas/${id}/iniciar`, {
        method: "PUT",
        body: JSON.stringify({ numero_balcao })
=======
    async startAttendance(id) {
      return apiRequest(`/senhas/${id}/iniciar`, { method: "PUT" });
    },

    async finishAttendance(id, observacoes) {
      return apiRequest(`/senhas/${id}/finalizar`, {
        method: "PUT",
        body: JSON.stringify({ observacoes: observacoes || "" })
>>>>>>> Stashed changes
      });
    },

    async getQueue(servicoId) {
      const path = servicoId ? `/filas/${servicoId}` : "/filas";
      const result = await apiRequest(path);
      return result.ok ? result.data : [];
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

    async healthCheck() {
      const result = await apiRequest("/auth/health", { skipAuth: true });
      return result.ok ? result.data : { status: "offline" };
    }
  };

  window.ApiClient = ApiClient;
<<<<<<< Updated upstream

  console.log("✅ API Client carregado (corrigido)");

  // Health check inicial
  ApiClient.healthCheck().then(status => {
    console.log("🏥 Backend status:", status.status || "offline");
  });

})();
=======
})();
>>>>>>> Stashed changes
