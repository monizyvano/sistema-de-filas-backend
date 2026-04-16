/**
 * LOGINTCC.JS - VERSÃO CORRIGIDA
 * static/js/logintcc.js
 * 
 * ✅ Cadastro usando ApiClient.register()
 * ✅ Login usando IMTSBStore.login()
 * ✅ Redirect baseado em role do backend
 */

(function() {
  "use strict";

  const store = window.IMTSBStore;
  const adapter = window.ApiAdapter;

  if (!store) {
    console.error("❌ IMTSBStore não carregado!");
    return;
  }

  // ===============================
  // 📱 ELEMENTOS DO DOM
  // ===============================
  const tabBtns = document.querySelectorAll('.tab-btn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const authMessage = document.getElementById('authMessage');

  // ===============================
  // 🎨 TABS
  // ===============================
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }

      clearMessage();
    });
  });

  // ===============================
  // 📝 MENSAGENS
  // ===============================
  function showMessage(msg, type = 'success') {
    if (!authMessage) return;
    authMessage.textContent = msg;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = 'block';
  }

  function clearMessage() {
    if (authMessage) {
      authMessage.style.display = 'none';
      authMessage.textContent = '';
    }
  }

  function setLoading(formEl, loading) {
    if (!formEl) return;
    const submitBtn = formEl.querySelector('button[type="submit"], input[type="submit"]');
    if (!submitBtn) return;
    submitBtn.disabled = !!loading;
  }

  // ===============================
  // 🔐 LOGIN
  // ===============================
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('iemail')?.value.trim();
      const senha = document.getElementById('isenha')?.value;
      const tipo = document.getElementById('loginTipo')?.value;
      const confirmDados = document.getElementById('loginConfirmDados')?.checked;

      // Validações
      if (!email || !senha) {
        showMessage("❌ Preencha email e senha", "error");
        return;
      }

      if (!confirmDados) {
        showMessage("⚠ Confirme que os dados estão corretos", "error");
        return;
      }

      // Login
      showMessage("🔄 Autenticando...", "info");
      setLoading(loginForm, true);

      try {
        const result = await store.login(email, senha);

        if (!result.ok) {
          showMessage(`❌ ${result.message}`, "error");
          setLoading(loginForm, false);
          return;
        }

        // Sucesso
        showMessage("✅ Login realizado!", "success");

        // Redirect baseado no role retornado do backend
        const userRole = result.role || "usuario";

        setTimeout(() => {
          if (userRole === "admin") {
            window.location.href = "/dashadm.html";
          } else if (userRole === "trabalhador" || userRole === "atendente") {
            window.location.href = "/dashtrabalho.html";
          } else {
            window.location.href = "/index.html";
          }
        }, 500);
      } catch (err) {
        console.error("[Login] Erro:", err);
        var msgOffline = (err && err.message && err.message.toLowerCase().includes("fetch"))
          ? "Servidor indisponível. Verifique a ligação e tente novamente."
          : "Erro de ligação. Tente novamente.";
        showMessage(msgOffline, "error");
        setLoading(loginForm, false);
        return;
      }
    });
  }

  // ===============================
  // ✍️ CADASTRO (CORRIGIDO)
  // ===============================
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nome = document.getElementById('rnome')?.value.trim();
      const email = document.getElementById('remail')?.value.trim();
      const senha = document.getElementById('rsenha')?.value;
      const confirmDados = document.getElementById('registerConfirmDados')?.checked;

      // Validações
      if (!nome || !email || !senha) {
        showMessage("❌ Preencha todos os campos", "error");
        return;
      }

      if (senha.length < 6) {
        showMessage("❌ Senha deve ter no mínimo 6 caracteres", "error");
        return;
      }

      if (!confirmDados) {
        showMessage("⚠ Confirme que os dados estão corretos", "error");
        return;
      }

      // ✅ CORRIGIDO: Usar ApiClient.register via store
      showMessage("🔄 Criando conta...", "info");

      const result = await store.register({
        name: nome,
        email: email,
        password: senha
      });

      if (!result.ok) {
        showMessage(`❌ ${result.message}`, "error");
        return;
      }

      // Sucesso
      showMessage("✅ Conta criada! Faça login para continuar.", "success");

      // Trocar para aba de login após 2s
      setTimeout(() => {
        document.querySelector('[data-tab="login"]')?.click();
        // Preencher email no login
        if (document.getElementById('iemail')) {
          document.getElementById('iemail').value = email;
        }
      }, 2000);
    });
  }

  // ===============================
  // 🔙 VOLTAR
  // ===============================
  window.voltarprincipal = function() {
    window.location.href = "/principal.html";
  };

  console.log("✅ logintcc.js carregado");

})();