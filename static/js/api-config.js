(function () {
  "use strict";

  window.IMTSBApiConfig = {
    enabled: true, // 🔥 Ativar integração
    baseUrl: "/api",
    timeoutMs: 15000,

    tokenStorageKey: "imtsb_api_token",
    accessTokenStorageKey: "imtsb_access_token",
    refreshTokenStorageKey: "imtsb_refresh_token",

    authHeaderName: "Authorization",
    refreshSkewSec: 30,

    endpoints: {

      // 🔐 AUTENTICAÇÃO
      health: { method: "GET", path: "/auth/health" },
      login: { method: "POST", path: "/auth/login" },
      register: { method: "POST", path: "/auth/register" },
      me: { method: "GET", path: "/auth/me" },

      // 🎟 SENHAS
      emitirSenha: { method: "POST", path: "/senhas" },
      buscarSenha: { method: "GET", path: "/senhas/{id}" },
      buscarSenhaNumero: { method: "GET", path: "/senhas/numero/{numero}" },
      cancelarSenha: { method: "DELETE", path: "/senhas/{id}/cancelar" },
      iniciarAtendimento: { method: "PUT", path: "/senhas/{id}/iniciar" },
      finalizarAtendimento: { method: "PUT", path: "/senhas/{id}/finalizar" },
      estatisticasSenhas: { method: "GET", path: "/senhas/estatisticas" },

      // 📋 FILAS
      listarFilas: { method: "GET", path: "/filas" },
      buscarFilaServico: { method: "GET", path: "/filas/{servico_id}" },
      chamarProxima: { method: "POST", path: "/filas/chamar" },
      estatisticasFilaServico: { method: "GET", path: "/filas/{servico_id}/estatisticas" },

      // 📊 DASHBOARD
      dashboardEstatisticas: { method: "GET", path: "/dashboard/estatisticas" },
      dashboardAtendentes: { method: "GET", path: "/dashboard/atendentes" },
      dashboardLogs: { method: "GET", path: "/dashboard/logs" }
    }
  };
})();