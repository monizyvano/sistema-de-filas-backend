/**
 * LOGINTCC.JS - VERSÃO FINAL CORRIGIDA
 * Localização: static/js/logintcc.js
 * 
 * ✅ Login admin funcionando
 * ✅ Cadastro funcionando
 * ✅ Validação de perfil corrigida
 */

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
  // 🔐 LOGIN COM API REAL
  // ===============================

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("iemail").value.trim();
    const senha = document.getElementById("isenha").value;
    const tipoSelect = document.getElementById("loginTipo");
    const tipo = tipoSelect ? tipoSelect.value : "usuario";
    const confirmDados = document.getElementById("loginConfirmDados");

    if (!confirmDados || !confirmDados.checked) {
      showMessage("⚠️ Confirme os dados antes de entrar.", "error");
      return;
    }

    if (!window.IMTSBStore) {
      showMessage("❌ Sistema não inicializado.", "error");
      return;
    }

    showMessage("🔄 Entrando...", "");

    try {
      // LOGIN DIRETO - SEM VALIDAÇÃO DE TIPO
      const result = await window.IMTSBStore.login(email, senha);

      if (!result || !result.ok) {
        showMessage(result?.message || "❌ Email ou senha incorretos", "error");
        return;
      }

      // VERIFICAR PERFIL RETORNADO
      const userRole = result.user?.role || "usuario";
      
      // Se selecionou admin mas não é admin
      if (tipo === "admin" && userRole !== "admin") {
        showMessage("❌ Este usuário não tem permissão de administrador", "error");
        return;
      }

      // Se selecionou trabalhador mas não é trabalhador
      if (tipo === "trabalhador" && userRole !== "trabalhador" && userRole !== "atendente") {
        showMessage("❌ Este usuário não tem permissão de trabalhador", "error");
        return;
      }

      showMessage(`✅ Bem-vindo, ${result.user?.name || "Usuário"}!`, "ok");

      // Redirecionar baseado no PERFIL REAL
      let redirect = "/index.html";
      if (userRole === "admin") {
        redirect = "/dashadm.html";
      } else if (userRole === "trabalhador" || userRole === "atendente") {
        redirect = "/dashtrabalho.html";
      }

      setTimeout(() => {
        window.location.href = redirect;
      }, 500);

    } catch (error) {
      console.error("Erro no login:", error);
      showMessage("❌ Erro inesperado. Tente novamente.", "error");
    }
  });

  // ===============================
  // 📝 CADASTRO FUNCIONANDO
  // ===============================

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const confirmDados = document.getElementById("registerConfirmDados");

    if (!confirmDados || !confirmDados.checked) {
      showMessage("⚠️ Confirme os dados antes de cadastrar.", "error");
      return;
    }

    const nome = document.getElementById("rnome").value.trim();
    const email = document.getElementById("remail").value.trim();
    const senha = document.getElementById("rsenha").value;

    if (!nome || !email || !senha) {
      showMessage("⚠️ Preencha todos os campos.", "error");
      return;
    }

    showMessage("🔄 Criando conta...", "");

    try {
      // CADASTRO VIA API
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          nome: nome,
          email: email,
          senha: senha,
          papel: "usuario"
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showMessage(data.erro || data.message || "❌ Erro ao criar conta.", "error");
        return;
      }

      showMessage("✅ Cadastro realizado! Agora faça login.", "ok");
      registerForm.reset();
      
      // Mudar para aba de login após 1.5s
      setTimeout(() => {
        switchTab("login");
        // Preencher email
        document.getElementById("iemail").value = email;
      }, 1500);

    } catch (error) {
      console.error("Erro no cadastro:", error);
      showMessage("❌ Erro ao conectar com servidor.", "error");
    }
  });
})();

// ===============================
// 🔙 VOLTAR PARA PRINCIPAL
// ===============================

function voltarprincipal() {
  window.location.href = "/";
}