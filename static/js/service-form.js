/**
 * static/js/service-form.js
 * Formulários de serviço — ligado à API real do backend
 * Documentado em PT-PT
 */

(function () {
  "use strict";

  // Definição dos campos e documentos por serviço
  const DEFS = {
    "Secretaria Académica": {
      docs: ["Bilhete de Identidade", "Certificado de habilitações", "2 fotografias tipo passe"],
      fields: [
        { key: "nome_aluno",  label: "Nome do aluno",  type: "text",     required: true },
        { key: "ano_turma",   label: "Ano / Turma",    type: "text",     required: true }
      ]
    },
    Matricula: {
      docs: ["Bilhete de Identidade", "Certificado", "2 fotos"],
      fields: [
        { key: "nome_aluno", label: "Nome do aluno", type: "text",     required: true },
        { key: "ano",        label: "Ano / Turma",   type: "text",     required: true }
      ]
    },
    Reconfirmacao: {
      docs: ["Cartão do aluno", "Comprovativo de pagamento"],
      fields: [
        { key: "numero_aluno", label: "Número do aluno", type: "text", required: true },
        { key: "classe",       label: "Classe",          type: "text", required: true }
      ]
    },
    Tesouraria: {
      docs: ["Comprovativo de pagamento", "Documento de identificação"],
      fields: [
        { key: "referencia", label: "Referência de pagamento", type: "text", required: true },
        { key: "valor",      label: "Valor",                   type: "text", required: true }
      ]
    },
    "Pedido de declaracao": {
      docs: ["Documento de identificação", "Formulário do pedido"],
      fields: [
        { key: "tipo_declaracao", label: "Tipo de declaração", type: "text",     required: true },
        { key: "motivo",          label: "Motivo",             type: "textarea", required: true }
      ]
    },
    "Apoio ao Cliente": {
      docs: ["Documento de identificação (opcional)"],
      fields: [
        { key: "assunto",   label: "Assunto",    type: "text",     required: true },
        { key: "descricao", label: "Descrição",  type: "textarea", required: true }
      ]
    }
  };

  // Mapeamento de serviço → servico_id da API
  const SERVICO_ID = {
    "Secretaria Académica":    1,
    "Matricula":               1,
    "Reconfirmacao":           1,
    "Tesouraria":              2,
    "Direcção Pedagógica":     3,
    "Pedido de declaracao":    3,
    "Biblioteca":              4,
    "Apoio ao Cliente":        5
  };

  const service       = document.body.getAttribute("data-service") || "Apoio ao Cliente";
  const titleEl       = document.getElementById("serviceTitle");
  const docsList      = document.getElementById("requiredDocs");
  const dynamicFields = document.getElementById("dynamicFields");
  const inputEmail    = document.getElementById("notificationEmail");
  const msg           = document.getElementById("formMsg");
  const form          = document.getElementById("serviceForm");

  function showMessage(text, type) {
    if (!msg) return;
    msg.textContent  = text || "";
    msg.className    = "msg";
    if (type) msg.classList.add(type);
  }

  function renderPage() {
    const def = DEFS[service] || DEFS["Apoio ao Cliente"];

    if (titleEl) titleEl.textContent = service;

    // Documentos necessários
    if (docsList) {
      docsList.innerHTML = "";
      def.docs.forEach(d => {
        const li = document.createElement("li");
        li.textContent = d;
        docsList.appendChild(li);
      });
    }

    // Campos dinâmicos
    if (dynamicFields) {
      dynamicFields.innerHTML = "";
      def.fields.forEach(f => {
        const wrap  = document.createElement("div");
        const label = document.createElement("label");
        label.textContent = f.label;
        const input = document.createElement(f.type === "textarea" ? "textarea" : "input");
        if (f.type !== "textarea") input.type = f.type;
        input.required = !!f.required;
        input.name     = f.key;
        wrap.appendChild(label);
        wrap.appendChild(input);
        dynamicFields.appendChild(wrap);
      });
    }

    // Pré-preencher email se utilizador estiver logado
    if (inputEmail) {
      try {
        const user = JSON.parse(localStorage.getItem("imtsb_user") || "{}");
        if (user.email && !user.isGuest) inputEmail.value = user.email;
      } catch (_) {}
    }
  }

  // Submissão — emite senha via API real
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      showMessage("A emitir senha...", "");

      const servicoId = SERVICO_ID[service] || 1;

      try {
        const resp = await fetch("/api/senhas/emitir", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ servico_id: servicoId, tipo: "normal" })
        });

        const data = await resp.json();

        if (!resp.ok) {
          showMessage(data.erro || "Erro ao emitir senha.", "warn");
          return;
        }

        const numero = data.senha?.numero || data.numero || "???";

        // Guardar senha no localStorage para acompanhamento
        if (data.senha) {
          localStorage.setItem("imtsb_minha_senha", JSON.stringify(data.senha));
        }

        // Guardar mensagem flash e redirecionar para o painel
        localStorage.setItem("imtsb_flash", `Senha emitida: ${numero} — Serviço: ${service}`);
        window.location.href = "/index.html";

      } catch (err) {
        console.error(err);
        showMessage("Erro de ligação ao servidor.", "warn");
      }
    });
  }

  renderPage();

})();