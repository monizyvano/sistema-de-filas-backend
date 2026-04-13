/**
 * static/js/logintcc.js — v5
 * Só fluxo cliente (entrar por email/telefone + cadastrar).
 * Staff usa /login-staff.html com script inline.
 */
(function () {
  "use strict";

  var msgEl      = document.getElementById("authMsg");
  var fEntrar    = document.getElementById("formEntrar");
  var fCadastrar = document.getElementById("formCadastrar");
  var subTabs    = document.querySelectorAll("[data-subtab]");

  function show(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.className   = "auth-msg";
    if (kind) msgEl.classList.add(kind);
  }

  function setLoading(form, on) {
    var btn = form && form.querySelector("[type=submit]");
    if (!btn) return;
    if (!btn._orig) btn._orig = btn.textContent;
    btn.disabled    = !!on;
    btn.textContent = on ? "Aguarde..." : btn._orig;
  }

  // Sub-tabs
  subTabs.forEach(function (btn) {
    btn.addEventListener("click", function () {
      subTabs.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      show("", "");
      if (btn.dataset.subtab === "entrar") {
        fEntrar.classList.remove("hidden");
        fCadastrar.classList.add("hidden");
      } else {
        fCadastrar.classList.remove("hidden");
        fEntrar.classList.add("hidden");
      }
    });
  });

  // ── ENTRAR por email ou telefone ──────────────────────────
  fEntrar && fEntrar.addEventListener("submit", async function (e) {
    e.preventDefault();
    var chk = document.getElementById("confirmEntrar");
    if (chk && !chk.checked) { show("Confirme os dados.", "error"); return; }
    var identif = ((document.getElementById("clienteIdentif") || {}).value || "").trim();
    if (!identif) { show("Preencha o email ou telefone.", "error"); return; }

    setLoading(fEntrar, true);
    show("A verificar...", "");

    try {
      var isEmail = identif.includes("@");
      var resp    = await fetch("/api/utentes/identificar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(isEmail ? { email: identif } : { telefone: identif })
      });
      var data = await resp.json().catch(function () { return {}; });

      if (!resp.ok) {
        show(data.erro || "Conta não encontrada. Faça o cadastro.", "error");
        setLoading(fEntrar, false); return;
      }

      var sessao = {
        id:      data.utente_id || data.id || null,
        name:    data.nome      || identif,
        email:   data.email     || (isEmail ? identif : ""),
        role:    "usuario",
        token:   "",
        balcao:  null,
        isGuest: false
      };
      localStorage.setItem("imtsb_user", JSON.stringify(sessao));
      show("Bem-vindo, " + sessao.name + "!", "ok");
      setTimeout(function () { window.location.href = "/index.html"; }, 400);

    } catch (err) {
      show("Erro de ligação ao servidor.", "error");
    }
    setLoading(fEntrar, false);
  });

  // ── CADASTRAR utente ──────────────────────────────────────
  fCadastrar && fCadastrar.addEventListener("submit", async function (e) {
    e.preventDefault();
    var chk = document.getElementById("cConfirm");
    if (chk && !chk.checked) { show("Confirme os dados.", "error"); return; }

    var nome     = ((document.getElementById("cNome")     || {}).value || "").trim();
    var email    = ((document.getElementById("cEmail")    || {}).value || "").trim();
    var telefone = ((document.getElementById("cTelefone") || {}).value || "").trim();

    if (!nome)               { show("Nome é obrigatório.", "error"); return; }
    if (!email && !telefone) { show("Indique email ou telefone.", "error"); return; }

    setLoading(fCadastrar, true);
    show("A criar conta...", "");

    try {
      var resp = await fetch("/api/utentes/registar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ nome: nome, email: email || null, telefone: telefone || null })
      });
      var data = await resp.json().catch(function () { return {}; });

      if (!resp.ok) {
        show(data.erro || "Erro no registo.", "error");
        setLoading(fCadastrar, false); return;
      }

      fCadastrar.reset();
      // Mudar para tab Entrar
      setTimeout(function () {
        subTabs.forEach(function (b) { b.classList.remove("active"); });
        var btnE = document.querySelector("[data-subtab='entrar']");
        if (btnE) btnE.classList.add("active");
        if (fEntrar)    fEntrar.classList.remove("hidden");
        if (fCadastrar) fCadastrar.classList.add("hidden");
        show("Conta criada! Identifique-se para entrar.", "ok");
      }, 600);

    } catch (err) {
      show("Erro de ligação.", "error");
    }
    setLoading(fCadastrar, false);
  });

  // ── Visitante ─────────────────────────────────────────────
  var gBtn = document.getElementById("btnGuest");
  if (gBtn) {
    gBtn.addEventListener("click", function () {
      localStorage.setItem("imtsb_user", JSON.stringify({
        id: null, name: "Visitante", email: "", role: "usuario",
        token: "", balcao: null, isGuest: true
      }));
      window.location.href = "/index.html";
    });
  }

})();

function voltarprincipal() { window.location.href = "/principal.html"; }