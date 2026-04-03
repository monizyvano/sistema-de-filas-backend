(function () {
  "use strict";

  function goToLogin(event) {
    if (event) event.preventDefault();
    const isLiveServer = String(window.location.port || "") === "5500";
    window.location.href = isLiveServer ? "/templates/logintcc.html" : "/logintcc.html";
  }

  document.addEventListener("DOMContentLoaded", function () {
    const loginBtn = document.getElementById("btnLoginPrincipal")
      || document.querySelector(".btn-login");
    if (!loginBtn) return;
    loginBtn.addEventListener("click", goToLogin);
  });
})();
