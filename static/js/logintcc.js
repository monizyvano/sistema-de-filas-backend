/**
 * static/js/logintcc.js
 * Fluxo do utente: entrar por email/telefone e cadastrar nova conta.
 */
(function () {
  "use strict";

  var msgEl = document.getElementById("authMsg");
  var formEntrar = document.getElementById("formEntrar");
  var formCadastrar = document.getElementById("formCadastrar");
  var subTabs = document.querySelectorAll("[data-subtab]");

  function show(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.className = "auth-msg";
    if (kind) msgEl.classList.add(kind);
  }

  function setLoading(form, enabled) {
    var button = form && form.querySelector("[type=submit]");
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = !!enabled;
    button.textContent = enabled ? "Aguarde..." : button.dataset.originalText;
  }

  function switchTab(tab) {
    subTabs.forEach(function (button) {
      button.classList.toggle("active", button.dataset.subtab === tab);
    });

    if (formEntrar) formEntrar.classList.toggle("hidden", tab !== "entrar");
    if (formCadastrar) formCadastrar.classList.toggle("hidden", tab !== "cadastrar");
    show("", "");
  }

  subTabs.forEach(function (button) {
    button.addEventListener("click", function () {
      switchTab(button.dataset.subtab);
    });
  });

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

      if (!identif) {
        show("Preencha o email ou telefone.", "error");
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

  if (formCadastrar) {
    formCadastrar.addEventListener("submit", async function (event) {
      event.preventDefault();

      var checked = document.getElementById("cConfirm");
      var nome = ((document.getElementById("cNome") || {}).value || "").trim();
      var email = ((document.getElementById("cEmail") || {}).value || "").trim();
      var telefone = ((document.getElementById("cTelefone") || {}).value || "").trim();

      if (checked && !checked.checked) {
        show("Confirme os dados.", "error");
        return;
      }

      if (!nome) {
        show("Nome e obrigatorio.", "error");
        return;
      }

      if (!email && !telefone) {
        show("Indique email ou telefone.", "error");
        return;
      }

      setLoading(formCadastrar, true);
      show("A criar conta...", "");

      try {
        var response = await fetch("/api/utentes/registar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: nome,
            email: email || null,
            telefone: telefone || null
          })
        });

        var data = await response.json().catch(function () {
          return {};
        });

        if (!response.ok) {
          show(data.erro || "Erro no registo.", "error");
          return;
        }

        formCadastrar.reset();
        switchTab("entrar");
        show("Conta criada! Identifique-se para entrar.", "ok");
      } catch (error) {
        show("Erro de ligacao.", "error");
      } finally {
        setLoading(formCadastrar, false);
      }
    });
  }

  var guestButton = document.getElementById("btnGuest");
  if (guestButton) {
    guestButton.addEventListener("click", function () {
      localStorage.setItem("imtsb_user", JSON.stringify({
        id: null,
        name: "Visitante",
        email: "",
        role: "usuario",
        token: "",
        balcao: null,
        isGuest: true
      }));
      window.location.href = "/index.html";
    });
  }

  window.voltarprincipal = function () {
    window.location.href = "/principal.html";
  };
})();
