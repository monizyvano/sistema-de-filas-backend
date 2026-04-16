/**
 * static/js/login-staff.js
 * Login para trabalhadores e administradores do IMTSB.
 */
(function () {
  "use strict";

  var msgEl = document.getElementById("authMsg");
  var form  = document.getElementById("formStaff");

  function show(text, kind) {
    if (!msgEl) return;
    msgEl.textContent = text || "";
    msgEl.className   = "auth-msg";
    if (kind) msgEl.classList.add(kind);
  }

  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    var chk = document.getElementById("loginConfirmDados");
    if (chk && !chk.checked) { show("Confirme os dados de acesso.", "error"); return; }

    var email = ((document.getElementById("iemail") || {}).value || "").trim();
    var senha = ((document.getElementById("isenha") || {}).value || "");
    var tipo  = ((document.getElementById("loginTipo") || {}).value || "").toLowerCase();

    if (!email || !senha) { show("Preencha email e senha.", "error"); return; }

    var btn      = form.querySelector("[type=submit]");
    var origText = btn.textContent;
    btn.disabled    = true;
    btn.textContent = "A autenticar…";
    show("", "");

    try {
      var resp = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email, senha: senha })
      });

      var data = await resp.json().catch(function () { return {}; });

      if (!resp.ok) {
        show(data.erro || "Credenciais incorrectas.", "error");
        btn.disabled = false; btn.textContent = origText; return;
      }

      var at   = data.atendente || {};
      var role = at.tipo === "admin" ? "admin" : "trabalhador";

      if (tipo === "admin" && at.tipo !== "admin") {
        show("Esta conta não tem permissões de administrador.", "error");
        btn.disabled = false; btn.textContent = origText; return;
      }

      var user = {
        id:            at.id    || null,
        name:          at.nome  || email,
        email:         at.email || email,
        role:          role,
        token:         data.access_token || "",
        balcao:        parseInt(at.balcao) || null,
        numero_balcao: parseInt(at.balcao) || null,
        servico_id:    at.servico_id || null,
        departamento:  at.departamento || null
      };

      localStorage.setItem("imtsb_user",         JSON.stringify(user));
      localStorage.setItem("imtsb_access_token",  user.token);

      show("Bem-vindo, " + user.name + "!", "ok");

      setTimeout(function () {
        window.location.href = role === "admin" ? "/dashadm.html" : "/dashtrabalho.html";
      }, 380);

    } catch (err) {
      console.error("[login-staff]", err);
      show("Erro de ligação ao servidor.", "error");
      btn.disabled = false; btn.textContent = origText;
    }
  });

})();