/**
 * static/js/service-form.js — v2
 * Dados do formulário guardados nas observacoes da senha.
 * Trabalhador vê o contexto completo do atendimento.
 */
(function () {
  "use strict";

  const DEFS = {
    "Matricula":           { servicoId:1, tipo:"normal",     docs:["BI","Certificado","2 fotos"], fields:[{key:"nome_aluno",label:"Nome do aluno",type:"text",required:true},{key:"ano",label:"Ano / Turma",type:"text",required:true}] },
    "Reconfirmacao":       { servicoId:1, tipo:"normal",     docs:["Cartão do aluno","Comprovativo"], fields:[{key:"numero_aluno",label:"Nº aluno",type:"text",required:true},{key:"classe",label:"Classe",type:"text",required:true}] },
    "Tesouraria":          { servicoId:2, tipo:"normal",     docs:["Comprovativo","BI"], fields:[{key:"tipo_pag",label:"Tipo de pagamento",type:"text",required:true},{key:"referencia",label:"Referência / Nº aluno",type:"text",required:true},{key:"valor",label:"Valor (Kz)",type:"text",required:false}] },
    "Pedido de declaracao":{ servicoId:3, tipo:"prioritaria",docs:["BI","Formulário"], fields:[{key:"tipo_decl",label:"Tipo de declaração",type:"text",required:true},{key:"motivo",label:"Motivo / Destino",type:"textarea",required:true}] },
    "Apoio ao Cliente":    { servicoId:5, tipo:"normal",     docs:["BI (opcional)"],   fields:[{key:"assunto",label:"Assunto",type:"text",required:true},{key:"descricao",label:"Descrição",type:"textarea",required:true}] }
  };

  const service = document.body.getAttribute("data-service") || "Apoio ao Cliente";
  const def     = DEFS[service] || DEFS["Apoio ao Cliente"];

  const titleEl       = document.getElementById("serviceTitle");
  const docsList      = document.getElementById("requiredDocs");
  const dynamicFields = document.getElementById("dynamicFields");
  const inputEmail    = document.getElementById("notificationEmail");
  const msg           = document.getElementById("formMsg");
  const form          = document.getElementById("serviceForm");

  function showMsg(text, type) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className   = "msg";
    if (type) msg.classList.add(type);
  }

  function renderPage() {
    if (titleEl) titleEl.textContent = service;
    if (docsList) {
      docsList.innerHTML = "";
      def.docs.forEach(d => { const li = document.createElement("li"); li.textContent = d; docsList.appendChild(li); });
    }
    if (dynamicFields) {
      dynamicFields.innerHTML = "";
      def.fields.forEach(f => {
        const wrap  = document.createElement("div");
        wrap.style.marginBottom = "8px";
        const label = document.createElement("label");
        label.textContent   = f.label + (f.required ? " *" : "");
        label.style.cssText = "font-weight:700;display:block;margin-bottom:4px;font-size:.9rem;";
        let input;
        if (f.type === "textarea") { input = document.createElement("textarea"); input.rows = 3; }
        else { input = document.createElement("input"); input.type = f.type; }
        input.name     = f.key;
        input.required = !!f.required;
        input.style.cssText = "width:100%;border:1px solid #d9cabc;border-radius:10px;padding:10px;font-size:.95rem;";
        wrap.appendChild(label);
        wrap.appendChild(input);
        dynamicFields.appendChild(wrap);
      });
    }
    if (inputEmail) {
      try { const u = JSON.parse(localStorage.getItem("imtsb_user") || "{}"); if (u.email && !u.isGuest) inputEmail.value = u.email; } catch (_) {}
    }
  }

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      showMsg("A emitir senha...", "");
      const formData = {};
      if (dynamicFields) dynamicFields.querySelectorAll("[name]").forEach(el => { if (el.value) formData[el.name] = el.value; });
      let utenteId = null, contacto = "";
      try { const u = JSON.parse(localStorage.getItem("imtsb_user") || "{}"); utenteId = u.id || null; contacto = u.email || ""; } catch (_) {}
      const linhas = ["SERVIÇO: " + service];
      def.fields.forEach(f => { if (formData[f.key]) linhas.push(f.label + ": " + formData[f.key]); });
      if (inputEmail && inputEmail.value) linhas.push("Contacto: " + inputEmail.value);
      const observacoes = linhas.join(" | ");
      try {
        const resp = await fetch("/api/senhas/emitir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ servico_id: def.servicoId, tipo: def.tipo || "normal", usuario_contato: contacto || null, utente_id: utenteId, observacoes: observacoes })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) { showMsg(data.erro || "Erro ao emitir senha.", "warn"); return; }
        const senha  = data.senha || {};
        const numero = senha.numero || "???";
        if (senha.id) localStorage.setItem("imtsb_minha_senha", JSON.stringify(senha));
        localStorage.setItem("imtsb_flash", "✅ Senha emitida: " + numero + " — " + service + ". Aguarde ser chamado.");
        window.location.href = "/index.html";
      } catch (err) {
        showMsg("Erro de ligação ao servidor.", "warn");
      }
    });
  }

  renderPage();
})();