(function () {
  "use strict";

  window.IMTSBApiConfig = {
    enabled: false,
    baseUrl: "/api",
    timeoutMs: 15000,
    tokenStorageKey: "imtsb_api_token",
    accessTokenStorageKey: "imtsb_access_token",
    refreshTokenStorageKey: "imtsb_refresh_token",
    authHeaderName: "Authorization",
    refreshSkewSec: 30,
    endpoints: {
      health: { method: "GET", path: "/auth/health" },
      login: { method: "POST", path: "/auth/login" }
    }
  };
})();
