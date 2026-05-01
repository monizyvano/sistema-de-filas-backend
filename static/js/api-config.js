/**
 * static/js/api-config.js — Sprint 4 FIXED
 * ═══════════════════════════════════════════════════════════════
 * FIX CRÍTICO: baseUrl agora é DINÂMICO baseado em window.location.
 * Funciona com localhost, 127.0.0.1 E qualquer IP da rede local
 * (ex: 192.168.1.x) — resolve o problema de não funcionar noutros
 * dispositivos.
 *
 * ANTES: baseUrl fixo em "http://localhost:5000/api" → quebra com IP
 * DEPOIS: detecta automaticamente o host e porta actuais
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ── Resolução dinâmica da base URL ─────────────────────── */
  function resolveBaseUrl() {
    const { protocol, hostname, port } = window.location;

    /* Se já está a correr no Flask (porta 5000) → usa caminhos relativos */
    if (port === "5000") {
      return "/api";
    }

    /* Live Server (5500) ou qualquer outro host → aponta para Flask no mesmo host */
    if (port === "5500" || port === "3000") {
      return `${protocol}//${hostname}:5000/api`;
    }

    /* Produção (sem porta ou porta 80/443) → mesma origem */
    if (!port || port === "80" || port === "443") {
      return "/api";
    }

    /* Fallback: usa o mesmo hostname mas com a porta do Flask */
    return `${protocol}//${hostname}:5000/api`;
  }

  const BASE_URL = resolveBaseUrl();

  window.IMTSBApiConfig = {
    enabled: true,

    /* URL base DINÂMICA — funciona em qualquer dispositivo da rede */
    baseUrl: BASE_URL,

    timeoutMs:             15000,
    tokenStorageKey:       "imtsb_api_token",
    accessTokenStorageKey: "imtsb_access_token",
    refreshTokenStorageKey:"imtsb_refresh_token",
    authHeaderName:        "Authorization",
    refreshSkewSec:        30,

    endpoints: {
      /* Auth */
      health:        { method: "GET",  path: "/auth/health" },
      login:         { method: "POST", path: "/auth/login" },
      refreshToken:  { method: "POST", path: "/auth/refresh" },
      logout:        { method: "POST", path: "/auth/logout" },

      /* Utilizadores */
      registerUser:  { method: "POST", path: "/users/register" },
      addWorker:     { method: "POST", path: "/workers" },
      getWorkers:    { method: "GET",  path: "/workers" },

      /* Tempo real */
      getSnapshot:   { method: "GET",  path: "/realtime/snapshot" },
      getQueue:      { method: "GET",  path: "/queue" },
      getStats:      { method: "GET",  path: "/stats" },

      /* Tickets */
      issueTicket:      { method: "POST", path: "/tickets" },
      callNext:         { method: "POST", path: "/tickets/call-next" },
      startAttendance:  { method: "POST", path: "/tickets/start" },
      concludeCurrent:  { method: "POST", path: "/tickets/conclude" },
      redirectCurrent:  { method: "POST", path: "/tickets/redirect" },
      setCurrentNote:   { method: "POST", path: "/tickets/note" },
      markReceived:     { method: "POST", path: "/tickets/received" },
      rateTicket:       { method: "POST", path: "/tickets/rate" },

      /* Formulários dinâmicos */
      getFormFields:    { method: "GET",  path: "/formularios" },

      /* Endpoints nativos (compatibilidade) */
      getDashboardPublic: { method: "GET",  path: "/dashboard/public/tv" },
      getSenhaTracking:   { method: "GET",  path: "/dashboard/public/senha" },
      getSenhas:          { method: "GET",  path: "/senhas" },
      emitirSenha:        { method: "POST", path: "/senhas" },
      getEstatisticas:    { method: "GET",  path: "/senhas/estatisticas" },
      chamarFila:         { method: "POST", path: "/filas/chamar" },
      redirecionarFila:   { method: "PUT",  path: "/filas/redirecionar" },
    },
  };

  console.log(`✅ api-config.js: baseUrl = "${BASE_URL}"`);

})();