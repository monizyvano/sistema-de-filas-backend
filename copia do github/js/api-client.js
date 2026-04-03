(function () {
  "use strict";

  // Evita varias chamadas simultaneas de refresh token.
  // Enquanto um refresh estiver em andamento, os outros aguardam a mesma Promise.
  let refreshPromise = null;

  // Le configuracao central da API (api-config.js).
  function getCfg() {
    return window.IMTSBApiConfig || {};
  }

  // [JWT] Chave do access token no localStorage.
  function accessTokenKey() {
    const cfg = getCfg();
    return cfg.accessTokenStorageKey || cfg.tokenStorageKey || "imtsb_api_token";
  }

  // [JWT] Chave do refresh token no localStorage.
  function refreshTokenKey() {
    const cfg = getCfg();
    return cfg.refreshTokenStorageKey || "imtsb_refresh_token";
  }

  // [JWT] Recupera o access token salvo.
  function getAccessToken() {
    return localStorage.getItem(accessTokenKey());
  }

  // [JWT] Recupera o refresh token salvo.
  function getRefreshToken() {
    return localStorage.getItem(refreshTokenKey());
  }

  // [JWT] Limpa todos os tokens locais (logout local/sessao expirada).
  function clearAuth() {
    const cfg = getCfg();
    localStorage.removeItem(accessTokenKey());
    localStorage.removeItem(refreshTokenKey());
    if (cfg.tokenStorageKey && cfg.tokenStorageKey !== accessTokenKey()) {
      localStorage.removeItem(cfg.tokenStorageKey);
    }
  }

  // [JWT] Aceita respostas do backend em formatos mais comuns:
  // - accessToken + refreshToken (recomendado)
  // - token (compatibilidade)
  function setTokensFromResponse(data) {
    if (!data || typeof data !== "object") return;

    const cfg = getCfg();
    const access = data.accessToken || data.token || null;
    const refresh = data.refreshToken || null;

    if (access) {
      localStorage.setItem(accessTokenKey(), access);
      if (cfg.tokenStorageKey) localStorage.setItem(cfg.tokenStorageKey, access);
    }

    if (refresh) {
      localStorage.setItem(refreshTokenKey(), refresh);
    }
  }

  // [JWT] Decodifica somente o payload do JWT para ler dados como 'exp'.
  // Nao valida assinatura aqui (quem valida e o backend= Yvano).
  function parseJwtPayload(token) {
    try {
      const payloadPart = String(token || "").split(".")[1];
      if (!payloadPart) return null;

      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const decoded = atob(padded);

      return JSON.parse(decoded);
    } catch (_error) {
      return null;
    }
  }

  // [JWT] Considera token expirado quando chega perto do 'exp'
  // (usa margem de seguranca refreshSkewSec).
  function isTokenExpired(token) {
    const payload = parseJwtPayload(token);
    if (!payload || !payload.exp) return false;

    const cfg = getCfg();
    const skewSec = Number(cfg.refreshSkewSec) || 30;
    const nowSec = Math.floor(Date.now() / 1000);

    return nowSec >= (Number(payload.exp) - skewSec);
  }

  // [JWT] Monta headers base; so injeta Authorization quando nao for skipAuth.
  function baseHeaders(skipAuth) {
    const cfg = getCfg();
    const headers = { "Content-Type": "application/json" };

    if (!skipAuth) {
      const token = getAccessToken();
      if (token) headers[cfg.authHeaderName || "Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  // [JWT] Executor bruto de request HTTP.
  // Faz retry automatico 1x em 401 quando conseguir renovar token.
  async function rawRequest(meta, payload, options) {
    const cfg = getCfg();
    const optsArg = options || {};

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs || 15000);

    try {
      const url = `${cfg.baseUrl || ""}${meta.path}`;
      const req = {
        method: meta.method,
        headers: baseHeaders(!!optsArg.skipAuth),
        signal: controller.signal
      };

      if (meta.method !== "GET" && payload !== undefined) {
        req.body = JSON.stringify(payload);
      }

      const resp = await fetch(url, req);
      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        // [JWT] Se token venceu durante a request, tenta refresh e repete 1 vez.
        const canRetry = resp.status === 401 && optsArg.retryOnUnauthorized !== false && !optsArg.skipAuth;
        if (canRetry) {
          const refreshed = await refreshAccessToken();
          if (refreshed.ok) {
            return rawRequest(meta, payload, { skipAuth: false, retryOnUnauthorized: false });
          }
          clearAuth();
        }

        return {
          ok: false,
          status: resp.status,
          message: data.message || "Falha na API",
          data
        };
      }

      setTokensFromResponse(data);
      return { ok: true, data };
    } catch (error) {
      // Diferencia timeout de erro de rede para facilitar diagnostico.
      return {
        ok: false,
        message: error && error.name === "AbortError" ? "Tempo limite da API excedido" : "Erro de conexao com API",
        error: String(error || "")
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // [JWT] Fluxo de renovacao de access token usando refresh token.
  // Se falhar, limpa sessao local.
  async function refreshAccessToken() {
    const cfg = getCfg();
    const refresh = getRefreshToken();
    const meta = cfg.endpoints && cfg.endpoints.refreshToken;

    if (!refresh || !meta || !meta.path || !meta.method) {
      return { ok: false, message: "Refresh token indisponivel." };
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        const result = await rawRequest(meta, { refreshToken: refresh }, {
          skipAuth: true,
          retryOnUnauthorized: false
        });

        if (result.ok) {
          setTokensFromResponse(result.data || {});
          return { ok: true };
        }

        clearAuth();
        return { ok: false, message: result.message || "Falha ao renovar token." };
      })().finally(() => {
        refreshPromise = null;
      });
    }

    return refreshPromise;
  }

  // [JWT] Metodo principal por endpoint-key.
  // 1- valida configuracao
  // 2- valida endpoint
  // 3- se token esta perto de expirar, tenta refresh antes da chamada
  // 4- executa request
  async function requestByKey(key, payload, options) {
    const cfg = getCfg();
    if (!cfg.enabled) {
      return { ok: false, message: "API desativada no api-config.js" };
    }

    const meta = cfg.endpoints && cfg.endpoints[key];
    if (!meta || !meta.path || !meta.method) {
      return { ok: false, message: `Endpoint nao configurado: ${key}` };
    }

    const opts = options || {};
    const token = getAccessToken();
    if (!opts.skipAuth && token && isTokenExpired(token)) {
      const refreshed = await refreshAccessToken();
      if (!refreshed.ok) {
        clearAuth();
        return { ok: false, status: 401, message: "Sessao expirada. Faca login novamente." };
      }
    }

    return rawRequest(meta, payload, opts);
  }

  // Polling generico para "tempo real" por intervalos.
  // Retorna uma funcao stopPolling() para interromper.
  function startPolling(requestKey, onSuccess, intervalMs, payloadFactory) {
    const ms = Number(intervalMs) > 0 ? Number(intervalMs) : 3000;
    let timerId = null;
    let stopped = false;

    async function tick() {
      if (stopped) return;
      const payload = typeof payloadFactory === "function" ? payloadFactory() : undefined;
      const result = await requestByKey(requestKey, payload);
      if (result.ok && typeof onSuccess === "function") {
        onSuccess(result.data);
      }
      if (!stopped) {
        timerId = setTimeout(tick, ms);
      }
    }

    tick();

    return function stopPolling() {
      stopped = true;
      if (timerId) clearTimeout(timerId);
    };
  }

  // API publica consumida pelas telas.
  window.IMTSBApiClient = {
    // [JWT] Helpers de auth/token
    getAccessToken,
    getRefreshToken,
    clearAuth,
    refreshAccessToken,
    requestByKey,

    // [JWT] Auth
    login: (payload) => requestByKey("login", payload, { skipAuth: true, retryOnUnauthorized: false }),
    logout: async (payload) => {
      const result = await requestByKey("logout", payload || {}, { retryOnUnauthorized: false });
      clearAuth();
      return result;
    },

    // Health check e operacoes de negocio
    checkHealth: () => requestByKey("health", undefined, { skipAuth: true, retryOnUnauthorized: false }),
    registerUser: (payload) => requestByKey("registerUser", payload),
    addWorker: (payload) => requestByKey("addWorker", payload),
    getSnapshot: () => requestByKey("getSnapshot"),
    getQueue: () => requestByKey("getQueue"),
    getStats: () => requestByKey("getStats"),
    issueTicket: (payload) => requestByKey("issueTicket", payload),
    callNext: (payload) => requestByKey("callNext", payload),
    startAttendance: (payload) => requestByKey("startAttendance", payload),
    concludeCurrent: (payload) => requestByKey("concludeCurrent", payload),
    redirectCurrent: (payload) => requestByKey("redirectCurrent", payload),
    setCurrentNote: (payload) => requestByKey("setCurrentNote", payload),
    markReceived: (payload) => requestByKey("markReceived", payload),
    rateTicket: (payload) => requestByKey("rateTicket", payload),

    // Tempo real por polling
    startPolling
  };
})();
