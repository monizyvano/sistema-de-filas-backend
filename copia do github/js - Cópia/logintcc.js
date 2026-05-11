(function () {
  "use strict";

  const tabs = document.querySelectorAll(".tab-btn");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const messageBox = document.getElementById("authMessage");
  const loginMethod = document.getElementById("loginMetodo");
  const loginEmailField = document.getElementById("loginEmailField");
  const loginPhoneField = document.getElementById("loginPhoneField");
  const emailInput = document.getElementById("iemail");
  const phoneInput = document.getElementById("itel");
  const guestButton = document.getElementById("btnGuestAccess");

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

  function syncLoginMethod() {
    const method = loginMethod ? loginMethod.value : "email";
    const usePhone = method === "telefone";

    if (loginEmailField) loginEmailField.classList.toggle("hidden", usePhone);
    if (loginPhoneField) loginPhoneField.classList.toggle("hidden", !usePhone);
    if (emailInput) emailInput.required = !usePhone;
    if (phoneInput) phoneInput.required = usePhone;
  }

  tabs.forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  if (loginMethod) loginMethod.addEventListener("change", syncLoginMethod);
  syncLoginMethod();

  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const metodo = loginMethod ? loginMethod.value : "email";
    const identificador = metodo === "telefone"
      ? (phoneInput ? phoneInput.value : "")
      : (emailInput ? emailInput.value : "");
    const senha = document.getElementById("isenha").value;
    const tipo = document.getElementById("loginTipo").value;
    const confirmDados = document.getElementById("loginConfirmDados");

    if (!confirmDados || !confirmDados.checked) {
      showMessage("Confirme os dados antes de entrar.", "error");
      return;
    }

    const result = window.IMTSBStore.login(identificador, senha, tipo, metodo);
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
      phone: document.getElementById("rtelefone").value,
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

  if (guestButton) {
    guestButton.addEventListener("click", () => {
      const result = window.IMTSBStore.continueAsGuest();
      window.location.href = result.redirect;
    });
  }
})();

function voltarprincipal() {
  window.location.href = "principal.html";
}

