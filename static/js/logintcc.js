/**
 * logintcc.js — Login do Sistema de Filas IMTSB
 * Liga o formulário HTML ao backend Flask via API real.
 * Documentado em pt-PT.
 */

(function () {
  "use strict";

  /* ── Referências ao DOM ── */
  var tabs           = document.querySelectorAll(".tab-btn");
  var loginForm      = document.getElementById("loginForm");
  var registerForm   = document.getElementById("registerForm");
  var messageBox     = document.getElementById("authMessage");
  var loginMethod    = document.getElementById("loginMetodo");
  var loginEmailField= document.getElementById("loginEmailField");
  var loginPhoneField= document.getElementById("loginPhoneField");
  var emailInput     = document.getElementById("iemail");
  var phoneInput     = document.getElementById("itel");
  var guestButton    = document.getElementById("btnGuestAccess");

  /* ── Utilitários ── */

  function showMessage(text, kind) {
    if (!messageBox) return;
    messageBox.textContent = text || "";
    messageBox.className   = "auth-message";
    if (kind) messageBox.classList.add(kind);
  }

  function setLoading(form, loading) {
    var btn = form.querySelector("[type=submit]");
    if (!btn) return;
    btn.disabled    = loading;
    btn.value       = loading ? "Aguarde..." : btn.getAttribute("data-label") || btn.value;
  }

  /* ── Tabs ── */

  function switchTab(target) {
    tabs.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === target);
    });
    if (target === "cadastro") {
      loginForm.classList.add("hidden");
      registerForm.classList.remove("hidden");
    } else {
      registerForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    }
    showMessage("", "");
  }

  tabs.forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
  });

  /* ── Método de login (email / telefone) ── */

  function syncLoginMethod() {
    var method   = loginMethod ? loginMethod.value : "email";
    var usePhone = method === "telefone";
    if (loginEmailField) loginEmailField.classList.toggle("hidden", usePhone);
    if (loginPhoneField) loginPhoneField.classList.toggle("hidden", !usePhone);
    if (emailInput) emailInput.required = !usePhone;
    if (phoneInput) phoneInput.required = usePhone;
  }

  if (loginMethod) loginMethod.addEventListener("change", syncLoginMethod);
  syncLoginMethod();

  /* ── Redirecionamento por papel ── */

  function redirectByRole(role) {
    if (role === "admin")       { window.location.href = "dashadm.html";       return; }
    if (role === "trabalhador") { window.location.href = "dashtrabalho.html";  return; }
    window.location.href = "visitante.html";
  }

  /* ── LOGIN ── */

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      var confirmDados = document.getElementById("loginConfirmDados");
      if (!confirmDados || !confirmDados.checked) {
        showMessage("Confirme os dados antes de entrar.", "error");
        return;
      }

      var metodo      = loginMethod ? loginMethod.value : "email";
      var identif     = metodo === "telefone"
                      ? (phoneInput ? phoneInput.value : "")
                      : (emailInput ? emailInput.value : "");
      var senha       = document.getElementById("isenha").value;
      var tipoSelect  = document.getElementById("loginTipo");
      var tipoEscolhido = tipoSelect ? tipoSelect.value : "";

      setLoading(loginForm, true);
      showMessage("A autenticar...", "");

      try {
        /* Tenta login via API */
        var cfg = window.IMTSBApiConfig || {};

        if (cfg.enabled && window.IMTSBApiClient) {
          var result = await window.IMTSBApiClient.login(identif, senha);

          if (!result.ok) {
            showMessage(result.message || "Email ou senha inválidos.", "error");
            setLoading(loginForm, false);
            return;
          }

          var raw       = result.raw || result.data || {};
          var atendente = raw.atendente || {};

          /* Mapear tipo backend → role frontend */
          var role = atendente.tipo === "admin"      ? "admin"
                   : atendente.tipo === "atendente"  ? "trabalhador"
                   : "usuario";

          /* Verificar se o perfil seleccionado corresponde */
          var rolePorTipo = { "admin": "admin", "trabalhador": "atendente", "usuario": "usuario" };
          if (tipoEscolhido && tipoEscolhido !== "usuario") {
            var tipoEsperado = rolePorTipo[tipoEscolhido] || tipoEscolhido;
            if (atendente.tipo && atendente.tipo !== tipoEsperado &&
                !(tipoEscolhido === "trabalhador" && atendente.tipo === "atendente")) {
              showMessage("O perfil seleccionado não corresponde a esta conta.", "error");
              setLoading(loginForm, false);
              return;
            }
          }

          /* Criar sessão no formato que o store espera */
          var sessao = {
            id:         atendente.id   || null,
            email:      atendente.email || identif,
            name:       atendente.nome  || atendente.name || "",
            role:       role,
            department: atendente.department || null,
            balcao:     atendente.balcao     || null,
            servico_id: atendente.servico_id || null,
            isGuest:    false,
            loggedAt:   new Date().toISOString()
          };

          /* Tokens — salvar em AMBOS os locais para compatibilidade */
          var token = (raw.access_token || raw.accessToken || "");
          var refreshTk = (raw.refresh_token || raw.refreshToken || "");
          localStorage.setItem("imtsb_session_v1", JSON.stringify(sessao));

          /* Compatibilidade com IMTSBStore (dashadm.js, realtime-store.js) */
          var storeUser = {
            id:    sessao.id,
            name:  sessao.name,
            email: sessao.email,
            role:  sessao.role,
            token: token,
            balcao: sessao.balcao,
            departamento: sessao.department
          };
          localStorage.setItem("imtsb_user", JSON.stringify(storeUser));
          if (token) localStorage.setItem("imtsb_access_token", token);
          if (refreshTk) localStorage.setItem("imtsb_refresh_token", refreshTk);

          /* Actualizar estado do store em memoria, se disponivel */
          if (window.IMTSBStore && window.IMTSBStore._state) {
            window.IMTSBStore._state.user = storeUser;
          }

          showMessage("Bem-vindo, " + sessao.name + ".", "ok");

          setTimeout(function () { redirectByRole(role); }, 400);
          return;
        }

        /* Fallback: localStorage demo (quando enabled: false) */
        var storeResult = window.IMTSBStore
          ? window.IMTSBStore.login(identif, senha, tipoEscolhido, metodo)
          : { ok: false, message: "Store não disponível." };

        if (storeResult && storeResult.then) {
          storeResult = await storeResult;
        }

        if (!storeResult || !storeResult.ok) {
          showMessage((storeResult && storeResult.message) || "Credenciais inválidas.", "error");
          setLoading(loginForm, false);
          return;
        }

        showMessage("Bem-vindo, " + storeResult.user.name + ".", "ok");
        setTimeout(function () { window.location.href = storeResult.redirect; }, 400);

      } catch (err) {
        console.error("[Login] Erro:", err);
        showMessage("Erro de ligação. Verifique o servidor.", "error");
      }

      setLoading(loginForm, false);
    });
  }

  /* ── REGISTO ── */

  if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      var confirmDados = document.getElementById("registerConfirmDados");
      if (!confirmDados || !confirmDados.checked) {
        showMessage("Confirme os dados antes de registar.", "error");
        return;
      }

      var payload = {
        name:     document.getElementById("rnome").value,
        email:    document.getElementById("remail").value,
        phone:    document.getElementById("rtelefone") ? document.getElementById("rtelefone").value : "",
        password: document.getElementById("rsenha").value,
        role:     "usuario"
      };

      setLoading(registerForm, true);
      showMessage("A registar...", "");

      try {
        var result;

        if ((window.IMTSBApiConfig || {}).enabled && window.IMTSBApiClient) {
          result = await window.IMTSBApiClient.register(payload);
        } else if (window.IMTSBStore) {
          result = window.IMTSBStore.register(payload);
          if (result && result.then) result = await result;
        } else {
          result = { ok: false, message: "Store não disponível." };
        }

        if (!result || !result.ok) {
          showMessage((result && result.message) || "Erro no registo.", "error");
          setLoading(registerForm, false);
          return;
        }

        showMessage("Registo bem sucedido. Faça login.", "ok");
        registerForm.reset();
        switchTab("login");

      } catch (err) {
        console.error("[Registo] Erro:", err);
        showMessage("Erro de ligação. Verifique o servidor.", "error");
      }

      setLoading(registerForm, false);
    });
  }

  /* ── VISITANTE SEM CONTA ── */

  if (guestButton) {
    guestButton.addEventListener("click", function () {
      if (window.IMTSBStore) {
        window.IMTSBStore.continueAsGuest();
      } else {
        var sessaoGuest = {
          id: null,
          email: "visitante-" + Date.now() + "@guest.local",
          name: "Visitante",
          role: "usuario",
          isGuest: true,
          loggedAt: new Date().toISOString()
        };
        localStorage.setItem("imtsb_session_v1", JSON.stringify(sessaoGuest));
        window.location.href = "visitante.html";
      }
    });
  }

})();

/* Botão Voltar (inline nos HTML) */
function voltarprincipal() {
  window.location.href = "principal.html";
}
