/**
 * api-config.js — Configuração Central da API IMTSB
 * Actualizado: adiciona endpoints da camada de compatibilidade
 * sem remover os originais.
 */
(function () {
  "use strict";

  window.IMTSBApiConfig = {
    enabled: true,
    baseUrl: "http://localhost:5000/api",
    timeoutMs: 15000,
    tokenStorageKey: "imtsb_api_token",
    accessTokenStorageKey: "imtsb_access_token",
    refreshTokenStorageKey: "imtsb_refresh_token",
    authHeaderName: "Authorization",
    refreshSkewSec: 30,

    endpoints: {
      // Auth
      health:       { method: "GET",  path: "/auth/health" },
      login:        { method: "POST", path: "/auth/login" },
      refreshToken: { method: "POST", path: "/auth/refresh" },
      logout:       { method: "POST", path: "/auth/logout" },

      // Utilizadores
      registerUser: { method: "POST", path: "/users/register" },
      addWorker:    { method: "POST", path: "/workers" },
      getWorkers:   { method: "GET",  path: "/workers" },

      // Tempo real
      getSnapshot:  { method: "GET",  path: "/realtime/snapshot" },
      getQueue:     { method: "GET",  path: "/queue" },
      getStats:     { method: "GET",  path: "/stats" },

      // Tickets
      issueTicket:     { method: "POST", path: "/tickets" },
      callNext:        { method: "POST", path: "/tickets/call-next" },
      startAttendance: { method: "POST", path: "/tickets/start" },
      concludeCurrent: { method: "POST", path: "/tickets/conclude" },
      redirectCurrent: { method: "POST", path: "/tickets/redirect" },
      setCurrentNote:  { method: "POST", path: "/tickets/note" },
      markReceived:    { method: "POST", path: "/tickets/received" },
      rateTicket:      { method: "POST", path: "/tickets/rate" },

      // Formulários dinâmicos
      getFormFields:  { method: "GET",  path: "/formularios" },

      // Endpoints antigos mantidos (compatibilidade)
      getDashboardPublic: { method: "GET",  path: "/dashboard/public/tv" },
      getSenhaTracking:   { method: "GET",  path: "/dashboard/public/senha" },
      getSenhas:          { method: "GET",  path: "/senhas" },
      emitirSenha:        { method: "POST", path: "/senhas" },
      getEstatisticas:    { method: "GET",  path: "/senhas/estatisticas" },
      chamarFila:         { method: "POST", path: "/filas/chamar" },
    },
  };
})();
