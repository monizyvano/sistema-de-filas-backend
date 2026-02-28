(function () {
  "use strict";

  const tabs = document.querySelectorAll(".tab-btn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const messageBox = document.getElementById("authMessage");

  function showMessage(text, kind) {
    if (!messageBox) return;
    messageBox.textContent = text || "";
    messageBox.className = "auth-message";
    if (kind) messageBox.classList.add(kind);
  }

  function switchTab(target) {
    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === target);
    });

    if (target === "cadastro") {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
      showMessage("", "");
      return;
    }

    registerForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    showMessage("", "");
  }

  tabs.forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const email = document.getElementById("iemail").value;
    const senha = document.getElementById("isenha").value;
    const tipo = document.getElementById("loginTipo").value;
    const confirmDados = document.getElementById("loginConfirmDados");

    if (!confirmDados || !confirmDados.checked) {
      showMessage("Confirme os dados antes de entrar.", "error");
      return;
    }

    const result = window.IMTSBStore.login(email, senha, tipo);
    if (!result.ok) {
      showMessage(result.message, "error");
      return;
    }

    showMessage(`Bem-vindo, ${result.user.name}.`, "ok");
    window.location.href = result.redirect;
  });

  registerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const confirmDados = document.getElementById("registerConfirmDados");
    if (!confirmDados || !confirmDados.checked) {
      showMessage("Confirme os dados antes de cadastrar.", "error");
      return;
    }

    const payload = {
      name: document.getElementById("rnome").value,
      role: "usuario",
      email: document.getElementById("remail").value,
      password: document.getElementById("rsenha").value
    };

    const result = window.IMTSBStore.register(payload);
    if (!result.ok) {
      showMessage(result.message, "error");
      return;
    }

    showMessage("Cadastro feito. Agora entre com o novo perfil.", "ok");
    registerForm.reset();
    switchTab("login");
  });
})();

function voltarprincipal() {
  window.location.href = "principal.html";
}

