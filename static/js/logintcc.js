/**
 * static/js/logintcc.js — CORRIGIDO
 * FIX 1: Cadastro → POST /api/utentes/registar (utente/cliente, não atendente)
 * FIX 2: Login guarda balcao como número inteiro no localStorage
 * FIX 3: Role "usuario" para contas criadas pelo cadastro público
 */
(function () {
  "use strict";

  var tabs         = document.querySelectorAll(".tab-btn");
  var loginForm    = document.getElementById("loginForm");
  var registerForm = document.getElementById("registerForm");
  var messageBox   = document.getElementById("authMessage");

  function showMessage(text, kind) {
    if (!messageBox) return;
    messageBox.textContent = text || "";
    messageBox.className   = "auth-message";
    if (kind) messageBox.classList.add(kind);
  }

  function setLoading(formEl, on) {
    if (!formEl) return;
    var btn = formEl.querySelector("[type=submit]");
    if (!btn) return;
    btn.disabled = !!on;
    if (!btn._orig) btn._orig = btn.value || btn.textContent;
    btn.value = btn.textContent = on ? "Aguarde..." : btn._orig;
  }

  // Tabs
  function switchTab(t) {
    tabs.forEach(function (b) { b.classList.toggle("active", b.dataset.tab === t); });
    if (t === "cadastro") { loginForm.classList.add("hidden"); registerForm.classList.remove("hidden"); }
    else                  { registerForm.classList.add("hidden"); loginForm.classList.remove("hidden"); }
    showMessage("", "");
  }
  tabs.forEach(function (b) { b.addEventListener("click", function () { switchTab(b.dataset.tab); }); });

  function redirectByRole(role) {
    window.location.href = role === "admin" ? "/dashadm.html"
                         : role === "trabalhador" ? "/dashtrabalho.html"
                         : "/index.html";
  }

  // ── LOGIN ─────────────────────────────────────────────────
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var chk = document.getElementById("loginConfirmDados");
      if (chk && !chk.checked) { showMessage("Confirme os dados antes de entrar.", "error"); return; }

      var email = ((document.getElementById("iemail") || {}).value || "").trim();
      var senha = ((document.getElementById("isenha") || {}).value || "");
      var tipo  = ((document.getElementById("loginTipo") || {}).value || "").toLowerCase();

      if (!email || !senha) { showMessage("Preencha email e senha.", "error"); return; }

      setLoading(loginForm, true);
      showMessage("A autenticar...", "");

      try {
        var resp = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, senha: senha })
        });
        var data = await resp.json().catch(function () { return {}; });

        if (!resp.ok) {
          showMessage(data.erro || "Email ou senha incorrectos.", "error");
          setLoading(loginForm, false); return;
        }

        var at   = data.atendente || {};
        var role = at.tipo === "admin" ? "admin" : at.tipo === "atendente" ? "trabalhador" : "usuario";

        // Verificar perfil seleccionado
        if (tipo && tipo !== "usuario") {
          var esp = { admin: "admin", trabalhador: "atendente" }[tipo];
          if (esp && at.tipo && at.tipo !== esp) {
            showMessage("Perfil seleccionado não corresponde a esta conta.", "error");
            setLoading(loginForm, false); return;
          }
        }

        // FIX balcao: garantir número
        var balcao = (at.balcao !== undefined && at.balcao !== null) ? (parseInt(at.balcao) || null) : null;

        var user = {
          id: at.id || null, name: at.nome || email, email: at.email || email,
          role: role, token: data.access_token || "",
          balcao: balcao, numero_balcao: balcao,
          servico_id: at.servico_id || null, departamento: at.departamento || null
        };

        localStorage.setItem("imtsb_user",        JSON.stringify(user));
        localStorage.setItem("imtsb_access_token", user.token);

        showMessage("Bem-vindo, " + user.name + "!", "ok");
        setTimeout(function () { redirectByRole(role); }, 350);

      } catch (err) {
        showMessage("Erro de ligação ao servidor.", "error");
        setLoading(loginForm, false);
      }
    });
  }

  // ── CADASTRO — cria utente (cliente público) ──────────────
  if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var chk = document.getElementById("registerConfirmDados");
      if (chk && !chk.checked) { showMessage("Confirme os dados.", "error"); return; }

      var nome     = ((document.getElementById("rnome")  || {}).value || "").trim();
      var email    = ((document.getElementById("remail") || {}).value || "").trim();
      var telefone = ((document.getElementById("rtelefone") || {}).value || "").trim();
      var senha    = ((document.getElementById("rsenha") || {}).value || "");

      if (!nome || !email) { showMessage("Nome e email são obrigatórios.", "error"); return; }
      if (senha && senha.length < 6) { showMessage("Senha mínimo 6 caracteres.", "error"); return; }

      setLoading(registerForm, true);
      showMessage("A criar conta...", "");

      try {
        // 1ª tentativa: endpoint de utentes (clientes)
        var resp = await fetch("/api/utentes/registar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: nome, email: email, telefone: telefone || null })
        });
        var data = await resp.json().catch(function () { return {}; });

        if (resp.ok) {
          showMessage("Conta criada! Pode agora fazer login.", "ok");
          registerForm.reset();
          setTimeout(function () { switchTab("login"); }, 1500);
          setLoading(registerForm, false); return;
        }

        // 2ª tentativa: auth/register (se utentes falhar — ex: email duplicado)
        if (senha) {
          var resp2 = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: nome, email: email, senha: senha, tipo: "atendente" })
          });
          var data2 = await resp2.json().catch(function () { return {}; });
          if (resp2.ok) {
            showMessage("Conta criada! Pode agora fazer login.", "ok");
            registerForm.reset();
            setTimeout(function () { switchTab("login"); }, 1500);
            setLoading(registerForm, false); return;
          }
          showMessage(data2.erro || data.erro || "Erro no registo.", "error");
        } else {
          showMessage(data.erro || "Erro no registo. Preencha todos os campos.", "error");
        }
      } catch (err) {
        showMessage("Erro de ligação ao servidor.", "error");
      }
      setLoading(registerForm, false);
    });
  }

  // Visitante
  var guestBtn = document.getElementById("btnGuestAccess");
  if (guestBtn) {
    guestBtn.addEventListener("click", function () {
      localStorage.setItem("imtsb_user", JSON.stringify({
        id: null, name: "Visitante", email: "guest-" + Date.now() + "@guest.local",
        role: "usuario", token: "", balcao: null, isGuest: true
      }));
      window.location.href = "/index.html";
    });
  }
})();

function voltarprincipal() { window.location.href = "/principal.html"; }