/**
 * static/js/logintcc.js
 * Fluxo do cliente/utente: identificação e registo.
 *
 * FIXES aplicados:
 *  - Removida referência a `loginForm` (não existe no HTML) — usa `formEntrar`
 *  - Removida função `setLoading` duplicada
 *  - Removido código misturado da versão anterior (store.login com password)
 *  - Fluxo correcto: identificação por email/telefone SEM password (utentes)
 */
(function () {
  "use strict";

  /* ── Referências ao DOM ─────────────────────────────────── */
  var msgEl        = document.getElementById("authMsg");
  var formEntrar   = document.getElementById("formEntrar");
  var formCadastrar = document.getElementById("formCadastrar");
  var subTabs      = document.querySelectorAll("[data-subtab]");

  /* ── Utilitários ─────────────────────────────────────────── */

  function show(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.className   = "auth-msg";
    if (kind) msgEl.classList.add(kind);
  }

  function setLoading(formEl, loading) {
    if (!formEl) return;
    var btn = formEl.querySelector("button[type='submit'], input[type='submit']");
    if (!btn) return;
    if (!btn._origText) btn._origText = btn.tagName === "INPUT" ? btn.value : btn.textContent;
    btn.disabled = !!loading;
    if (btn.tagName === "INPUT") {
      btn.value = loading ? "Aguarde..." : btn._origText;
    } else {
      btn.textContent = loading ? "Aguarde..." : btn._origText;
    }
  }

  function switchTab(tab) {
    subTabs.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.subtab === tab);
    });
    if (formEntrar)    formEntrar.classList.toggle("hidden",    tab !== "entrar");
    if (formCadastrar) formCadastrar.classList.toggle("hidden", tab !== "cadastrar");
    show("", "");
  }

  subTabs.forEach(function (btn) {
    btn.addEventListener("click", function () { switchTab(btn.dataset.subtab); });
  });

  /* ── Formulário Entrar (identificação por email/telefone) ── */

  if (formEntrar) {
    formEntrar.addEventListener("submit", async function (e) {
      e.preventDefault();

      var confirmEl = document.getElementById("confirmEntrar");
      if (confirmEl && !confirmEl.checked) {
        show("Confirme que os dados estão correctos.", "error");
        return;
      }

      var identif = ((document.getElementById("clienteIdentif") || {}).value || "").trim();
      if (!identif) {
        show("Indique o email ou telefone.", "error");
        return;
      }

      setLoading(formEntrar, true);
      show("A identificar...", "");

      try {
        var isEmail = identif.includes("@");

        // Guardar sessão de utente em localStorage e redirecionar
        var session = {
          id:       null,
          name:     isEmail ? identif.split("@")[0] : ("Utente " + identif),
          email:    isEmail ? identif.toLowerCase()  : "",
          telefone: isEmail ? ""                      : identif,
          role:     "usuario",
          token:    "",
          balcao:   null,
          isGuest:  false
        };

        localStorage.setItem("imtsb_user", JSON.stringify(session));
        show("Bem-vindo!", "ok");

        setTimeout(function () {
          window.location.href = "/index.html";
        }, 350);

      } catch (err) {
        console.error("[logintcc] Entrar:", err);
        show("Erro ao identificar. Tente novamente.", "error");
      } finally {
        setLoading(formEntrar, false);
      }
    });
  }

  /* ── Formulário Cadastrar ────────────────────────────────── */

  if (formCadastrar) {
    formCadastrar.addEventListener("submit", async function (e) {
      e.preventDefault();

      var confirmEl = document.getElementById("cConfirm");
      if (confirmEl && !confirmEl.checked) {
        show("Confirme os dados antes de cadastrar.", "error");
        return;
      }

      var nome     = ((document.getElementById("cNome")     || {}).value || "").trim();
      var email    = ((document.getElementById("cEmail")    || {}).value || "").trim();
      var telefone = ((document.getElementById("cTelefone") || {}).value || "").trim();

      if (!nome) {
        show("O nome é obrigatório.", "error");
        return;
      }
      if (!email && !telefone) {
        show("Indique pelo menos email ou telefone.", "error");
        return;
      }

      setLoading(formCadastrar, true);
      show("A criar conta...", "");

      try {
        var response = await fetch("/api/utentes/registar", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            nome:     nome,
            email:    email    || null,
            telefone: telefone || null
          })
        });

        var data = await response.json().catch(function () { return {}; });

        if (!response.ok) {
          show(data.erro || "Erro no registo. Tente novamente.", "error");
          return;
        }

        formCadastrar.reset();
        switchTab("entrar");
        show("Conta criada com sucesso! Agora identifique-se para entrar.", "ok");

      } catch (err) {
        console.error("[logintcc] Cadastrar:", err);
        show("Erro de ligação ao servidor.", "error");
      } finally {
        setLoading(formCadastrar, false);
      }
    });
  }

  /* ── Botão Continuar Sem Conta ───────────────────────────── */

  var btnGuest = document.getElementById("btnGuest");
  if (btnGuest) {
    btnGuest.addEventListener("click", function () {
      localStorage.setItem("imtsb_user", JSON.stringify({
        id:      null,
        name:    "Visitante",
        email:   "",
        role:    "usuario",
        token:   "",
        balcao:  null,
        isGuest: true
      }));
      window.location.href = "/index.html";
    });
  }

  /* ── Função global voltarprincipal (chamada pelo HTML) ────── */
  window.voltarprincipal = function () {
    window.location.href = "/principal.html";
  };

})();