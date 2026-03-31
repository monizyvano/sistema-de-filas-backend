(function () {
  "use strict";

  const session = window.IMTSBStore.requireRole(["usuario"]);
  if (!session) return;

  const service = document.body.getAttribute("data-service") || "Apoio ao Cliente";
  const titleEl = document.getElementById("serviceTitle");
  const docsList = document.getElementById("requiredDocs");
  const dynamicFields = document.getElementById("dynamicFields");
  const inputEmail = document.getElementById("notificationEmail");
  const inputFiles = document.getElementById("attachments");
  const msg = document.getElementById("formMsg");
  const form = document.getElementById("serviceForm");

  const defs = {
    "Matricula": {
      docs: ["Bilhete de Identidade", "Certificado", "2 fotos"],
      fields: [
        { key: "nome_aluno", label: "Nome do aluno", type: "text", required: true },
        { key: "ano", label: "Ano/Turma", type: "text", required: true }
      ]
    },
    "Reconfirmacao": {
      docs: ["Cartao do aluno", "Comprovativo de pagamento"],
      fields: [
        { key: "numero_aluno", label: "Numero do aluno", type: "text", required: true },
        { key: "classe", label: "Classe", type: "text", required: true }
      ]
    },
    "Tesouraria": {
      docs: ["Comprovativo", "Documento de identificacao"],
      fields: [
        { key: "referencia_pagamento", label: "Referencia de pagamento", type: "text", required: true },
        { key: "valor", label: "Valor", type: "text", required: true }
      ]
    },
    "Pedido de declaracao": {
      docs: ["Documento de identificacao", "Formulario do pedido"],
      fields: [
        { key: "tipo_declaracao", label: "Tipo de declaracao", type: "text", required: true },
        { key: "motivo", label: "Motivo", type: "textarea", required: true }
      ]
    },
    "Apoio ao Cliente": {
      docs: ["Documento opcional de suporte"],
      fields: [
        { key: "assunto", label: "Assunto", type: "text", required: true },
        { key: "descricao", label: "Descricao", type: "textarea", required: true }
      ]
    }
  };

  function showMessage(text, type) {
    msg.textContent = text || "";
    msg.className = "msg";
    if (type) msg.classList.add(type);
  }

  function readFiles(files) {
    const items = Array.from(files || []);
    return Promise.all(items.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: String(reader.result || "")
      });
      reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
      reader.readAsDataURL(file);
    })));
  }

  function renderPage() {
    const def = defs[service] || defs["Apoio ao Cliente"];
    if (titleEl) titleEl.textContent = service;

    docsList.innerHTML = "";
    def.docs.forEach((d) => {
      const li = document.createElement("li");
      li.textContent = d;
      docsList.appendChild(li);
    });

    dynamicFields.innerHTML = "";
    def.fields.forEach((f) => {
      const wrap = document.createElement("div");
      const label = document.createElement("label");
      label.textContent = f.label;
      const input = document.createElement(f.type === "textarea" ? "textarea" : "input");
      if (f.type !== "textarea") input.type = f.type;
      input.required = !!f.required;
      input.name = f.key;
      wrap.appendChild(label);
      wrap.appendChild(input);
      dynamicFields.appendChild(wrap);
    });

    if (inputEmail) inputEmail.value = session.email || "";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = {};
    dynamicFields.querySelectorAll("[name]").forEach((el) => {
      fields[el.name] = el.value;
    });

    try {
      const attachments = await readFiles(inputFiles.files || []);
      const result = window.IMTSBStore.issueTicket({
        service,
        userEmail: session.email,
        userName: session.name,
        notificationEmail: inputEmail.value,
        serviceForm: fields,
        attachments
      });

      if (!result.ok) {
        showMessage(result.message, "warn");
        return;
      }

      localStorage.setItem("imtsb_flash", `Formulario de ${service} enviado com sucesso. Senha: ${result.ticket.code}`);
      window.location.href = "visitante.html";
    } catch (error) {
      showMessage(error.message || "Erro ao anexar ficheiros.", "warn");
    }
  });

  renderPage();
})();
