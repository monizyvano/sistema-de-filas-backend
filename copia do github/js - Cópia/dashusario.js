(function () {
  "use strict";

  const session = window.IMTSBStore.requireRole(["usuario"]);
  if (!session) return;

  const servicesList = document.getElementById("servicesList");
  const docInput = document.getElementById("docInput");
  const selectedFiles = document.getElementById("selectedFiles");
  const btnEmitirSenha = document.getElementById("btnAtendimento");
  const ticketMessage = document.getElementById("ticketMessage");
  const ticketsList = document.getElementById("ticketsList");
  const currentTicketEl = document.getElementById("currentTicket");
  const ultimaChamadaEl = document.getElementById("ultimaChamada");
  const btnSairDesk = document.getElementById("btnSairUserDesktop");
  const btnSairMobile = document.getElementById("btnSairUserMobile");
  const btnMeusDadosDesktop = document.getElementById("btnMeusDadosDesktop");
  const btnMeusDadosMobile = document.getElementById("btnMeusDadosMobile");
  const btnFecharDados = document.getElementById("btnFecharDados");
  const meusDadosPanel = document.getElementById("meusDadosPanel");
  const profileName = document.getElementById("userProfileName");
  const serviceDocsList = document.getElementById("serviceDocsList");
  const dadoNome = document.getElementById("dadoNome");
  const dadoEmail = document.getElementById("dadoEmail");
  const dadoPerfil = document.getElementById("dadoPerfil");
  const dadoLogin = document.getElementById("dadoLogin");

  const statFila = document.getElementById("statFila");
  const statTempo = document.getElementById("statTempo");
  const statDone = document.getElementById("statDone");
  const statSat = document.getElementById("statSat");

  const serviceDocuments = {
    Matriculas: [
      "Bilhete de Identidade do aluno",
      "Certificado de habilitacoes",
      "2 fotografias tipo passe"
    ],
    Reconfirmacoes: [
      "Cartao do aluno",
      "Comprovativo de pagamento",
      "Documento de identificacao"
    ],
    "Pedido de declaracao": [
      "Comprovativo do motivo de prioridade",
      "Documento de identificacao",
      "Formulario do pedido"
    ],
    Documentacao: [
      "Requerimento assinado",
      "Documento de identificacao",
      "Comprovativo de pagamento de taxas"
    ]
  };

  let selectedService = "";

  function showMessage(text, type) {
    ticketMessage.textContent = text || "";
    ticketMessage.className = "ticket-message";
    if (type) ticketMessage.classList.add(type);
  }

  function statusLabel(status) {
    if (status === "aguardando") return "Aguardando";
    if (status === "em_atendimento") return "Em Atendimento";
    if (status === "concluido") return "Concluido";
    return status;
  }

  function formatDate(iso) {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("pt-BR");
  }

  function abrirDados() {
    if (!meusDadosPanel) return;
    meusDadosPanel.classList.add("aberto");
  }

  function fecharDados() {
    if (!meusDadosPanel) return;
    meusDadosPanel.classList.remove("aberto");
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

  function renderSelectedFiles() {
    const files = Array.from(docInput.files || []);
    if (!files.length) {
      selectedFiles.textContent = "Nenhum documento selecionado.";
      return;
    }
    selectedFiles.textContent = files.map((file) => `${file.name} (${Math.ceil(file.size / 1024)} KB)`).join(" | ");
  }

  function renderServiceDocuments(service) {
    const docs = serviceDocuments[service] || ["Selecione um servico."];
    serviceDocsList.innerHTML = "";
    docs.forEach((doc) => {
      const li = document.createElement("li");
      li.textContent = doc;
      serviceDocsList.appendChild(li);
    });
  }

  function renderStats(snapshot) {
    const waiting = snapshot.queue.filter((q) => q.status === "aguardando").length;
    const done = snapshot.history.length;
    const dur = snapshot.history.map((h) => Number(h.serviceDurationSec) || 0).filter((v) => v > 0);
    const avgDur = dur.length ? Math.round(dur.reduce((a, b) => a + b, 0) / dur.length) : 0;
    const rates = snapshot.history.filter((h) => h.rating).map((h) => Number(h.rating.score));
    const avgRate = rates.length ? Math.round((rates.reduce((a,b)=>a+b,0) / rates.length) * 20) : 0;

    if (statFila) statFila.textContent = String(waiting);
    if (statDone) statDone.textContent = String(done);
    if (statTempo) statTempo.textContent = `~${Math.max(1, Math.floor(avgDur / 60))}min`;
    if (statSat) statSat.textContent = `${avgRate}%`;
  }

  function getUserTickets(snapshot) {
    return snapshot.queue.concat(snapshot.history)
      .filter((ticket) => ticket.userEmail === session.email)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderTickets(userTickets) {
    if (!userTickets.length) {
      currentTicketEl.textContent = "---";
      ticketsList.innerHTML = "<p>Sem atendimentos.</p>";
      return;
    }

    const active = userTickets.find((ticket) => ticket.status !== "concluido") || userTickets[0];
    currentTicketEl.textContent = `${active.code} (${statusLabel(active.status)})`;

    ticketsList.innerHTML = "";

    userTickets.forEach((ticket) => {
      const item = document.createElement("article");
      item.className = "ticket-item";

      const docs = (ticket.attachments || []).length;
      const rateText = ticket.rating ? `${ticket.rating.score}/5` : "Pendente";
      const recText = ticket.receipt ? ticket.receipt.fileName : "Pendente";

      item.innerHTML = `
        <div class="ticket-top">
          <span>${ticket.code} - ${ticket.service}</span>
          <span>${statusLabel(ticket.status)}</span>
        </div>
        <div>Emitida em: ${formatDate(ticket.createdAt)}</div>
        <div>Documentos anexados: ${docs}</div>
        <div>Avaliacao: ${rateText}</div>
        <div>Recibo: ${recText}</div>
      `;

      const actions = document.createElement("div");
      actions.className = "ticket-actions";

      if (ticket.status === "em_atendimento" && !ticket.receivedAt) {
        const btnReceber = document.createElement("button");
        btnReceber.type = "button";
        btnReceber.textContent = "Receber Atendimento";
        btnReceber.addEventListener("click", () => {
          const result = window.IMTSBStore.markReceived(ticket.id, session.email);
          showMessage(result.ok ? "Atendimento confirmado." : result.message, result.ok ? "ok" : "warn");
          render();
        });
        actions.appendChild(btnReceber);
      }

      if (ticket.status === "concluido" && !ticket.rating) {
        const form = document.createElement("form");
        form.className = "rating-form";
        form.innerHTML = `
          <label>Avaliar atendimento</label>
          <select required>
            <option value="">Nota</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <input type="text" maxlength="100" placeholder="Comentario opcional">
          <button type="submit">Enviar Avaliacao</button>
        `;

        form.addEventListener("submit", (event) => {
          event.preventDefault();
          const score = form.querySelector("select").value;
          const comment = form.querySelector("input").value;
          const result = window.IMTSBStore.rateTicket(ticket.id, session.email, score, comment);
          showMessage(result.ok ? "Avaliacao enviada." : result.message, result.ok ? "ok" : "warn");
          render();
        });

        item.appendChild(form);
      }

      if (ticket.receipt && ticket.receipt.content) {
        const btnRecibo = document.createElement("button");
        btnRecibo.type = "button";
        btnRecibo.textContent = "Baixar Recibo";
        btnRecibo.addEventListener("click", () => {
          const blob = new Blob([ticket.receipt.content], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = ticket.receipt.fileName || `recibo_${ticket.code}.txt`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        });
        actions.appendChild(btnRecibo);
      }

      if (actions.children.length) item.appendChild(actions);
      ticketsList.appendChild(item);
    });
  }

  function render() {
    const snapshot = window.IMTSBStore.getSnapshot();
    const userTickets = getUserTickets(snapshot);

    if (ultimaChamadaEl) {
      ultimaChamadaEl.textContent = snapshot.lastCalled ? snapshot.lastCalled.code : "---";
    }

    renderStats(snapshot);
    renderTickets(userTickets);
  }

  servicesList.querySelectorAll(".service-card").forEach((card) => {
    card.addEventListener("click", () => {
      servicesList.querySelectorAll(".service-card").forEach((item) => item.classList.remove("ativo"));
      card.classList.add("ativo");
      selectedService = card.dataset.servico || "";
      renderServiceDocuments(selectedService);
      showMessage(`Servico selecionado: ${selectedService}`, "ok");
    });
  });

  btnEmitirSenha.addEventListener("click", async () => {
    if (!selectedService) {
      showMessage("Selecione um servico antes de emitir senha.", "warn");
      return;
    }

    if (!docInput.files || docInput.files.length === 0) {
      showMessage("Anexe os documentos necessarios para emitir a senha.", "warn");
      return;
    }

    try {
      const attachments = await readFiles(docInput.files);
      const result = window.IMTSBStore.issueTicket({
        service: selectedService,
        userEmail: session.email,
        userName: session.name,
        attachments
      });

      if (!result.ok) {
        showMessage(result.message, "warn");
        return;
      }

      showMessage(`Senha emitida com sucesso: ${result.ticket.code}`, "ok");
      docInput.value = "";
      renderSelectedFiles();
      render();
    } catch (error) {
      showMessage(error.message || "Falha ao anexar documentos.", "warn");
    }
  });

  docInput.addEventListener("change", renderSelectedFiles);
  if (btnSairDesk) btnSairDesk.addEventListener("click", () => window.IMTSBStore.logout());
  if (btnSairMobile) btnSairMobile.addEventListener("click", () => window.IMTSBStore.logout());
  if (btnMeusDadosDesktop) btnMeusDadosDesktop.addEventListener("click", abrirDados);
  if (btnMeusDadosMobile) btnMeusDadosMobile.addEventListener("click", () => {
    abrirDados();
    clickMenu();
  });
  if (btnFecharDados) btnFecharDados.addEventListener("click", fecharDados);
  if (meusDadosPanel) {
    meusDadosPanel.addEventListener("click", (event) => {
      if (event.target === meusDadosPanel) fecharDados();
    });
  }

  profileName.textContent = `Perfil: ${session.name}`;
  if (dadoNome) dadoNome.textContent = session.name || "-";
  if (dadoEmail) dadoEmail.textContent = session.email || "-";
  if (dadoPerfil) dadoPerfil.textContent = session.role || "-";
  if (dadoLogin) dadoLogin.textContent = formatDate(session.loggedAt);
  renderServiceDocuments("");
  renderSelectedFiles();
  window.IMTSBStore.onChange(render);
  render();
})();

function clickMenu() {
  const itens = document.getElementById("itens");
  if (!itens) return;
  itens.style.display = itens.style.display === "block" ? "none" : "block";
}

function mudoutamanho() {
  const itens = document.getElementById("itens");
  if (!itens) return;
  itens.style.display = window.innerWidth >= 768 ? "block" : "none";
}

window.addEventListener("resize", mudoutamanho);
window.addEventListener("load", mudoutamanho);

