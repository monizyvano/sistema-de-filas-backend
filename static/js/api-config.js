(function () {
  "use strict";

  // Yvano essa é a configuracao base para integracao com backend.
  // Ajustar apenas este ficheiro.
  window.IMTSBApiConfig = {

    // Ativa/desativa chamadas reais para API.
    // Manter false enquanto usa mock.
    enabled: false,

    // Base do backend - RELATIVA (mesmo servidor Flask)
    // Remove http://localhost:5000 para evitar CORS
    baseUrl: "/api",

    timeoutMs: 15000,

    // Compatibilidade com implementacoes antigas.
    tokenStorageKey: "imtsb_api_token",

    // Chaves recomendadas para JWT.
    accessTokenStorageKey: "imtsb_access_token",
    refreshTokenStorageKey: "imtsb_refresh_token",

    // Header de autenticacao (Authorization: Bearer ...)
    authHeaderName: "Authorization",

    // Margem em segundos para renovar token antes de expirar.
    refreshSkewSec: 30,

    endpoints: {
      
      // ================= AUTENTICACAO =================
      health: { method: "GET", path: "/auth/health" },
      login: { method: "POST", path: "/auth/login" },
      refreshToken: { method: "POST", path: "/auth/refresh" },
      logout: { method: "POST", path: "/auth/logout" },

      // ================= GESTAO =================
      registerUser: { method: "POST", path: "/users/register" },
      addWorker: { method: "POST", path: "/workers" },

      // ================= FILA / ATENDIMENTO =================
      getSnapshot: { method: "GET", path: "/realtime/snapshot" },
      getQueue: { method: "GET", path: "/queue" },
      getStats: { method: "GET", path: "/stats" },
      issueTicket: { method: "POST", path: "/tickets" },
      callNext: { method: "POST", path: "/tickets/call-next" },
      startAttendance: { method: "POST", path: "/tickets/start" },
      concludeCurrent: { method: "POST", path: "/tickets/conclude" },
      redirectCurrent: { method: "POST", path: "/tickets/redirect" },
      setCurrentNote: { method: "POST", path: "/tickets/note" },
      markReceived: { method: "POST", path: "/tickets/received" },
      rateTicket: { method: "POST", path: "/tickets/rate" }
    }
  };
})();