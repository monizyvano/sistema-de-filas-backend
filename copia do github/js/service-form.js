(function () {
  "use strict";

  const session = window.IMTSBStore.requireRole(["usuario"]);
  if (!session) return;

  const service = document.body.getAttribute("data-service") || "Apoio ao Cliente";
  const titleEl = document.getElementById("serviceTitle");
  const docsList = document.getElementById("requiredDocs");
  const dynamicFields = document.getElementById("dynamicFields");
  const inputEmail = document.getElementById("notificationEmail");
  const attachmentsFields = document.getElementById("attachmentsFields");
  const msg = document.getElementById("formMsg");
  const form = document.getElementById("serviceForm");

  const defs = {
    "Matricula": {
      docs: ["Bilhete de Identidade","Certidão de Nascimento", "Cópia do BI dos pais", "Declaração Escolar ou Certificado de Habilitações (da escola anterior)", "Cartão de Vacina",  "2 fotos tipo Passe"],
      fields: [
        { key: "nome_aluno", label: "Nome do aluno", type: "text", required: true },
        { key: "ano", label: "Ano/Turma", type: "text", required: true }
      ]
    },
    "Reconfirmacao": {
      docs: ["Comprovativo da matrícula anterior", "Boletim de Notas", "Bilhete de Identidade", "2 fotos tipo Passe", "Comprovativo de pagamento"],
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
      docs: ["Bilhete de Identidade", "Número de Estudante", "Formulario do pedido"],
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

  async function readAttachmentInputs(container) {
    const inputs = Array.from(container.querySelectorAll("input[type='file'][data-doc-name]"));
    const allFiles = await Promise.all(inputs.map(async (input) => {
      const files = await readFiles(input.files || []);
      return files.map((file) => ({
        ...file,
        documentLabel: input.getAttribute("data-doc-name") || file.name
      }));
    }));

    return allFiles.flat();
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

    if (attachmentsFields) {
      attachmentsFields.innerHTML = "";
      def.docs.forEach((doc, index) => {
        const wrap = document.createElement("div");
        wrap.className = "attachment-field";

        const label = document.createElement("label");
        const inputId = `attachment-${index}`;
        label.setAttribute("for", inputId);
        label.textContent = `Anexar ${doc}`;

        const input = document.createElement("input");
        input.type = "file";
        input.id = inputId;
        input.name = `attachment_${index}`;
        input.setAttribute("data-doc-name", doc);
        input.required = !/opcional/i.test(doc);
        if (/2 fotos/i.test(doc)) input.multiple = true;

        wrap.appendChild(label);
        wrap.appendChild(input);
        attachmentsFields.appendChild(wrap);
      });
    }

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
      const attachments = attachmentsFields ? await readAttachmentInputs(attachmentsFields) : [];
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
