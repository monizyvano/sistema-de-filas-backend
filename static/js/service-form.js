/**
 * static/js/service-form.js — Sprint 3 FINAL
 * ═══════════════════════════════════════════════════════════════
 * Gere todos os formulários de serviço do IMTSB.
 * Funciona com o atributo data-service no <body>.
 *
 * FLUXO COMPLETO:
 *   1. Renderiza campos dinâmicos + documentos necessários.
 *   2. Renderiza input de ficheiro em #attachmentsFields.
 *   3. Submissão: emite senha via POST /api/senhas/emitir (JSON).
 *      Observações do formulário vão no campo 'observacoes'.
 *   4. Se existir ficheiro: POST /api/senhas/{id}/anexar (multipart).
 *   5. Redireciona para /index.html com mensagem flash.
 *
 * COMPATÍVEL COM:
 *   - matricula.html, tesouraria.html, apoio-cliente.html,
 *     declaracao.html, reconfirmacoes.html
 *   - Todos usam data-service="NomeDoServico" no <body>
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  "use strict";

  /* ── Definições de cada serviço ──────────────────────────────
     servicoId  — ID na tabela `servicos` da base de dados
     tipo       — "normal" | "prioritaria"
     docs       — lista de documentos necessários (informativo)
     fields     — campos dinâmicos gerados no formulário
  ──────────────────────────────────────────────────────────── */
  const DEFS = {
    "Matricula": {
      servicoId: 1,
      tipo: "normal",
      docs: ["BI ou Passaporte", "Certificado de habilitações", "2 fotografias tipo passe", "Comprovativo de residência"],
      fields: [
        { key: "nome_aluno",  label: "Nome completo do aluno",  type: "text",   required: true  },
        { key: "ano",         label: "Ano / Turma pretendida",  type: "text",   required: true  },
        { key: "data_nasc",   label: "Data de nascimento",      type: "date",   required: false },
        { key: "enc_educ",    label: "Encarregado de educação", type: "text",   required: false }
      ]
    },
    "Reconfirmacao": {
      servicoId: 1,
      tipo: "normal",
      docs: ["Cartão de aluno", "Comprovativo de pagamento de propinas"],
      fields: [
        { key: "numero_aluno", label: "Número de aluno",   type: "text", required: true  },
        { key: "classe",       label: "Classe / Ano",      type: "text", required: true  },
        { key: "turma",        label: "Turma (A, B, C...)", type: "text", required: false }
      ]
    },
    "Tesouraria": {
      servicoId: 2,
      tipo: "normal",
      docs: ["Comprovativo de pagamento", "BI ou Passaporte"],
      fields: [
        { key: "tipo_pag",   label: "Tipo de pagamento",         type: "text",   required: true  },
        { key: "referencia", label: "Referência / Número aluno", type: "text",   required: true  },
        { key: "valor",      label: "Valor (Kz)",                type: "number", required: false },
        { key: "banco",      label: "Banco (opcional)",          type: "text",   required: false }
      ]
    },
    "Pedido de declaracao": {
      servicoId: 3,
      tipo: "prioritaria",
      docs: ["BI ou Passaporte", "Formulário de pedido (se disponível)"],
      fields: [
        { key: "tipo_decl",  label: "Tipo de declaração",      type: "text",     required: true  },
        { key: "motivo",     label: "Motivo / Destino",         type: "textarea", required: true  },
        { key: "num_aluno",  label: "Número de aluno",          type: "text",     required: false }
      ]
    },
    "Apoio ao Cliente": {
      servicoId: 5,
      tipo: "normal",
      docs: ["BI ou Passaporte (opcional)"],
      fields: [
        { key: "assunto",   label: "Assunto",       type: "text",     required: true  },
        { key: "descricao", label: "Descrição",     type: "textarea", required: true  }
      ]
    }
  };

  /* ── Serviço activo ──────────────────────────────────────── */
  const service = document.body.getAttribute("data-service") || "Apoio ao Cliente";
  const def     = DEFS[service] || DEFS["Apoio ao Cliente"];

  /* ── Referências DOM ─────────────────────────────────────── */
  const titleEl         = document.getElementById("serviceTitle");
  const docsList        = document.getElementById("requiredDocs");
  const dynamicFields   = document.getElementById("dynamicFields");
  const attachmentsDiv  = document.getElementById("attachmentsFields");
  const inputEmail      = document.getElementById("notificationEmail");
  const msg             = document.getElementById("formMsg");
  const form            = document.getElementById("serviceForm");

  /* ── Estilos base para inputs gerados ───────────────────── */
  const INPUT_STYLE =
    "width:100%;border:1px solid #d9cabc;border-radius:10px;" +
    "padding:10px;font-size:.95rem;box-sizing:border-box;" +
    "margin-top:4px;font-family:inherit;";

  const LABEL_STYLE =
    "font-weight:700;display:block;font-size:.9rem;color:#401903;";

  /* ── Utilitários ─────────────────────────────────────────── */
  function showMsg(text, type) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.className   = "msg";
    if (type) msg.classList.add(type);
  }

  function setBtn(disabled, texto) {
    const btn = form && form.querySelector("button[type='submit']");
    if (!btn) return;
    btn.disabled    = disabled;
    btn.textContent = texto;
  }

  /* ── Renderizar página ───────────────────────────────────── */
  function renderPage() {
    /* Título */
    if (titleEl) titleEl.textContent = service;

    /* Lista de documentos necessários */
    if (docsList) {
      docsList.innerHTML = "";
      def.docs.forEach(d => {
        const li      = document.createElement("li");
        li.textContent = d;
        docsList.appendChild(li);
      });
    }

    /* Campos dinâmicos do formulário */
    if (dynamicFields) {
      dynamicFields.innerHTML = "";
      def.fields.forEach(f => {
        const wrap = document.createElement("div");

        const label           = document.createElement("label");
        label.textContent     = f.label + (f.required ? " *" : "");
        label.style.cssText   = LABEL_STYLE;

        let input;
        if (f.type === "textarea") {
          input       = document.createElement("textarea");
          input.rows  = 3;
          input.style.resize = "vertical";
        } else {
          input      = document.createElement("input");
          input.type = f.type;
        }

        input.name        = f.key;
        input.required    = !!f.required;
        input.placeholder = f.label;
        input.style.cssText = INPUT_STYLE;

        wrap.appendChild(label);
        wrap.appendChild(input);
        dynamicFields.appendChild(wrap);
      });
    }

    /* ── Renderizar campo de ficheiro em #attachmentsFields ── */
    if (attachmentsDiv) {
      attachmentsDiv.innerHTML = "";

      const wrap = document.createElement("div");
      wrap.style.cssText = "margin-top:4px;";

      const label           = document.createElement("label");
      label.textContent     = "Anexar documento (opcional)";
      label.style.cssText   = LABEL_STYLE;

      const hint            = document.createElement("span");
      hint.textContent      = " — PDF, JPG, PNG, DOCX (máx. 5 MB)";
      hint.style.cssText    = "font-weight:400;font-size:.8rem;color:#8c6746;";
      label.appendChild(hint);

      const input           = document.createElement("input");
      input.type            = "file";
      input.id              = "ficheiro_anexo";
      input.name            = "ficheiro";
      input.accept          = ".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx";
      input.style.cssText   =
        "width:100%;padding:8px;border:1px dashed #d9cabc;" +
        "border-radius:10px;background:#f9f4ef;cursor:pointer;" +
        "margin-top:4px;font-size:.9rem;";

      /* Preview do nome do ficheiro seleccionado */
      const preview         = document.createElement("div");
      preview.id            = "filePreview";
      preview.style.cssText =
        "margin-top:4px;font-size:.82rem;color:#0369a1;" +
        "font-weight:600;min-height:18px;";

      input.addEventListener("change", () => {
        const f = input.files[0];
        preview.textContent = f
          ? `📎 ${f.name} (${(f.size / 1024).toFixed(0)} KB)`
          : "";
      });

      wrap.appendChild(label);
      wrap.appendChild(input);
      wrap.appendChild(preview);
      attachmentsDiv.appendChild(wrap);
    }

    /* Pré-preencher email (utilizador autenticado) */
    if (inputEmail) {
      try {
        const u = JSON.parse(localStorage.getItem("imtsb_user") || "{}");
        if (u.email && !u.isGuest) inputEmail.value = u.email;
      } catch (_) {}
    }
  }

  /* ── Upload de ficheiro (passo 2) ────────────────────────────
     Chamado após emitir a senha. Não bloqueia o fluxo se falhar.
  ─────────────────────────────────────────────────────────── */
  async function uploadFicheiro(senhaId, ficheiro) {
    showMsg("📎 A enviar documento...", "");
    const fd = new FormData();
    fd.append("ficheiro", ficheiro);
    try {
      const r = await fetch(`/api/senhas/${senhaId}/anexar`, {
        method: "POST",
        body: fd
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        console.warn("[upload] aviso:", d.erro || "Erro no upload.");
      } else {
        console.log(`[upload] Ficheiro enviado — senha ${senhaId}`);
      }
    } catch (err) {
      console.warn("[upload] Falha de ligação:", err);
    }
  }

  /* ── Submissão ───────────────────────────────────────────── */
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      showMsg("A emitir senha...", "");
      setBtn(true, "A processar...");

      /* — Recolher campos dinâmicos ───────────────────────── */
      const formData = {};
      if (dynamicFields) {
        dynamicFields.querySelectorAll("[name]").forEach(el => {
          if (el.value.trim()) formData[el.name] = el.value.trim();
        });
      }

      /* — Dados do utilizador (se autenticado) ────────────── */
      let utenteId = null, contacto = "";
      try {
        const u  = JSON.parse(localStorage.getItem("imtsb_user") || "{}");
        utenteId = u.id    || null;
        contacto = u.email || "";
      } catch (_) {}

      if (inputEmail && inputEmail.value.trim()) {
        contacto = contacto || inputEmail.value.trim();
      }

      /* — Construir observações (dados do formulário) ──────── */
      const linhas = [`SERVIÇO: ${service}`];
      def.fields.forEach(f => {
        if (formData[f.key]) linhas.push(`${f.label}: ${formData[f.key]}`);
      });
      if (contacto) linhas.push(`Contacto: ${contacto}`);
      const observacoes = linhas.join(" | ");

      /* ══ Passo 1: Emitir senha (JSON) ══════════════════════ */
      let senhaId = null, numeroSenha = "???";

      try {
        const resp = await fetch("/api/senhas/emitir", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            servico_id:      def.servicoId,
            tipo:            def.tipo || "normal",
            usuario_contato: contacto || null,
            utente_id:       utenteId,
            observacoes:     observacoes       // ✅ chega ao trabalhador
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (!resp.ok) {
          showMsg(data.erro || "Erro ao emitir senha. Tente novamente.", "warn");
          setBtn(false, "Enviar Formulário e Emitir Senha");
          return;
        }

        const senha = data.senha || {};
        senhaId     = senha.id;
        numeroSenha = senha.numero || "???";

        if (senhaId) {
          localStorage.setItem("imtsb_minha_senha", JSON.stringify(senha));
        }

      } catch (err) {
        showMsg("Erro de ligação ao servidor. Verifique a sua ligação.", "warn");
        setBtn(false, "Enviar Formulário e Emitir Senha");
        return;
      }

      /* ══ Passo 2: Upload de ficheiro (se existir) ══════════ */
      const ficheiroInput = document.getElementById("ficheiro_anexo");
      const ficheiro      = ficheiroInput && ficheiroInput.files[0];
      if (ficheiro && senhaId) {
        await uploadFicheiro(senhaId, ficheiro);
      }

      /* ══ Passo 3: Redirecionar com mensagem ════════════════ */
      localStorage.setItem(
        "imtsb_flash",
        `✅ Senha emitida: ${numeroSenha} — ${service}. Aguarde ser chamado(a).`
      );
      window.location.href = "/index.html";
    });
  }

  /* ── Inicializar ─────────────────────────────────────────── */
  renderPage();

})();