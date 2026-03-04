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

  tabs.forEach((btn) =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );

  // ===============================
  // 🔐 LOGIN (COMPATÍVEL API + MOCK)
  // ===============================

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("iemail").value.trim();
    const senha = document.getElementById("isenha").value;
    const tipoSelect = document.getElementById("loginTipo");
    const tipo = tipoSelect ? tipoSelect.value : null;
    const confirmDados = document.getElementById("loginConfirmDados");

    if (!confirmDados || !confirmDados.checked) {
      showMessage("Confirme os dados antes de entrar.", "error");
      return;
    }

    if (!window.IMTSBStore) {
      showMessage("Sistema não inicializado.", "error");
      return;
    }

    showMessage("Entrando...", "");

    try {
      const result = await Promise.resolve(
        window.IMTSBStore.login(email, senha, tipo)
      );

      if (!result || !result.ok) {
        showMessage(result?.message || "Erro ao fazer login.", "error");
        return;
      }

      showMessage(`Bem-vindo, ${result.user?.name || "Usuário"}!`, "ok");

      // Pequeno delay para UX
      setTimeout(() => {
        window.location.href = result.redirect || "index.html";
      }, 500);

    } catch (error) {
      console.error("Erro no login:", error);
      showMessage("Erro inesperado. Tente novamente.", "error");
    }
  });

  // ===============================
  // 📝 CADASTRO
  // ===============================

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const confirmDados = document.getElementById("registerConfirmDados");

    if (!confirmDados || !confirmDados.checked) {
      showMessage("Confirme os dados antes de cadastrar.", "error");
      return;
    }

    if (!window.IMTSBStore || !window.IMTSBStore.register) {
      showMessage("Cadastro não disponível.", "error");
      return;
    }

    const payload = {
      name: document.getElementById("rnome").value.trim(),
      role: "usuario",
      email: document.getElementById("remail").value.trim(),
      password: document.getElementById("rsenha").value
    };

    showMessage("Processando cadastro...", "");

    try {
      const result = await Promise.resolve(
        window.IMTSBStore.register(payload)
      );

      if (!result || !result.ok) {
        showMessage(result?.message || "Erro no cadastro.", "error");
        return;
      }

      showMessage(
        "Cadastro feito com sucesso. Agora entre com o novo perfil.",
        "ok"
      );

      registerForm.reset();
      switchTab("login");

    } catch (error) {
      console.error("Erro no cadastro:", error);
      showMessage("Erro inesperado no cadastro.", "error");
    }
  });
})();

function voltarprincipal() {
  window.location.href = "\\templates\\principal.html";
}