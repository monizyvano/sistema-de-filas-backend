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
  const btnMeusDadosDesktop = document.getElementById("btnMeusDadosDesktop");
  const btnFecharDados = document.getElementById("btnFecharDados");
  const meusDadosPanel = document.getElementById("meusDadosPanel");
  const profileName = document.getElementById("userProfileName");
  const serviceDocsList = document.getElementById("serviceDocsList");
  const dadoNome = document.getElementById("dadoNome");
  const dadoEmail = document.getElementById("dadoEmail");
  const dadoPerfil = document.getElementById("dadoPerfil");
  const dadoLogin = document.getElementById("dadoLogin");
  const btnOpenCalendarNav = document.getElementById("btnOpenCalendarNav");
  const calendarPanel = document.getElementById("calendarPanel");
  const btnCloseCalendar = document.getElementById("btnCloseCalendar");
  const btnPrevYear = document.getElementById("btnPrevYear");
  const btnNextYear = document.getElementById("btnNextYear");
  const calendarYearLabel = document.getElementById("calendarYearLabel");
  const annualCalendarGrid = document.getElementById("annualCalendarGrid");

  const statFila = document.getElementById("statFila");
  const statTempo = document.getElementById("statTempo");
  const statDone = document.getElementById("statDone");
  const statSat = document.getElementById("statSat");

  const serviceDocuments = {
    Matricula: [
      "Bilhete de Identidade do aluno",
      "Certificado de habilitacoes",
      "2 fotografias tipo passe"
    ],
    Reconfirmacao: [
      "Cartao do aluno",
      "Comprovativo de pagamento",
      "Documento de identificacao"
    ],
    Tesouraria: [
      "Documento de identificacao",
      "Comprovativo de pagamento",
      "Requerimento de atendimento"
    ],
    "Pedido de declaracao": [
      "Comprovativo do motivo de prioridade",
      "Documento de identificacao",
      "Formulario do pedido"
    ],
    "Apoio ao Cliente": [
      "Documento de identificacao",
      "Descricao do problema ou solicitacao"
    ]
  };

  let selectedService = "";
  let calendarYear = new Date().getFullYear();
  const monthNames = [
    "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
  const fixedCalendarEvents = [
    { name: "1 Provas dos Professores", start: "2025-10-13", end: "2025-10-24" },
    { name: "1 Prova Trimestral", start: "2025-12-08", end: "2025-12-19" },
    { name: "Inicio das Provas dos Professores (2 Trimestre)", start: "2026-02-09", end: "2026-02-20" },
    { name: "2 Provas Trimestrais", start: "2026-03-16", end: "2026-03-27" },
    { name: "Jornadas Cientificas", start: "2026-03-27", end: "2026-04-01" },
    { name: "3 Prova dos Professores", start: "2026-05-04", end: "2026-05-15" },
    { name: "3 Prova Trimestral", start: "2026-06-01", end: "2026-06-12" },
    { name: "Exames", start: "2026-06-22", end: "2026-07-03" },
    { name: "Inicio das Aulas", start: "2026-09-07", end: "2026-09-07" }
  ];

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

  function abrirCalendario() {
    if (!calendarPanel) return;
    calendarPanel.classList.add("aberto");
  }

  function fecharCalendario() {
    if (!calendarPanel) return;
    calendarPanel.classList.remove("aberto");
  }

  function buildMonthMatrix(year, month) {
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startWeekDay = (firstDay.getDay() + 6) % 7;
    const cells = [];

    for (let i = 0; i < startWeekDay; i += 1) cells.push("");
    for (let d = 1; d <= totalDays; d += 1) cells.push(String(d));
    while (cells.length % 7 !== 0) cells.push("");

    return cells;
  }

  function parseDateKey(key) {
    const parts = String(key).split("-").map((n) => Number(n));
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function addDays(baseDate, days) {
    const d = new Date(baseDate.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  function addRangeToMap(eventsMap, startDate, endDate, label, targetYear) {
    let cursor = new Date(startDate.getTime());
    while (cursor <= endDate) {
      if (cursor.getFullYear() === targetYear) {
        const key = formatDateKey(cursor);
        if (!eventsMap[key]) eventsMap[key] = [];
        eventsMap[key].push(label);
      }
      cursor = addDays(cursor, 1);
    }
  }

  function buildEventsMapForYear(year) {
    const map = {};

    fixedCalendarEvents.forEach((eventItem) => {
      const start = parseDateKey(eventItem.start);
      const end = parseDateKey(eventItem.end);
      if (start.getFullYear() === year || end.getFullYear() === year || (start.getFullYear() < year && end.getFullYear() > year)) {
        addRangeToMap(map, start, end, eventItem.name, year);
      }
    });

    if (year >= 2027) {
      const recurrenceBase = fixedCalendarEvents.filter((eventItem) => eventItem.start.startsWith("2026-"));
      const weekShift = 7 * (year - 2026);
      recurrenceBase.forEach((eventItem) => {
        const shiftedStart = addDays(parseDateKey(eventItem.start), weekShift);
        const shiftedEnd = addDays(parseDateKey(eventItem.end), weekShift);
        addRangeToMap(map, shiftedStart, shiftedEnd, `${eventItem.name} (Planeado ${year})`, year);
      });
    }

    return map;
  }

  function renderAnnualCalendar() {
    if (!annualCalendarGrid || !calendarYearLabel) return;
    calendarYearLabel.textContent = String(calendarYear);
    annualCalendarGrid.innerHTML = "";
    const eventsMap = buildEventsMapForYear(calendarYear);

    for (let month = 0; month < 12; month += 1) {
      const matrix = buildMonthMatrix(calendarYear, month);
      const card = document.createElement("article");
      card.className = "month-card";

      let tableHtml = `<table class="month-table"><thead><tr>${weekDays.map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>`;
      for (let i = 0; i < matrix.length; i += 7) {
        const row = matrix.slice(i, i + 7);
        const rowHtml = row.map((day) => {
          if (!day) return "<td></td>";
          const key = `${calendarYear}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const events = eventsMap[key] || [];
          if (!events.length) return `<td>${day}</td>`;
          const title = events.join(" | ").replace(/"/g, "'");
          return `<td class="event-day" title="${title}">${day}<span class="event-dot"></span></td>`;
        }).join("");
        tableHtml += `<tr>${rowHtml}</tr>`;
      }
      tableHtml += "</tbody></table>";

      card.innerHTML = `<div class="month-title">${monthNames[month]}</div>${tableHtml}`;
      annualCalendarGrid.appendChild(card);
    }
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
          const link = document.createElement("a");
          if (ticket.receipt.dataUrl) {
            link.href = ticket.receipt.dataUrl;
          } else {
            const mime = ticket.receipt.mimeType || "text/plain;charset=utf-8";
            const blob = new Blob([ticket.receipt.content], { type: mime });
            link.href = URL.createObjectURL(blob);
          }
          const ext = ticket.receipt.format === "pdf" ? "pdf" : "txt";
          link.download = ticket.receipt.fileName || `recibo_${ticket.code}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          if (!ticket.receipt.dataUrl && link.href.startsWith("blob:")) {
            URL.revokeObjectURL(link.href);
          }
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
      if (snapshot.lastCalled) {
        const where = snapshot.lastCalled.counterName ? ` - ${snapshot.lastCalled.counterName}` : "";
        ultimaChamadaEl.textContent = `${snapshot.lastCalled.code}${where}`;
      } else {
        ultimaChamadaEl.textContent = "---";
      }
    }

    renderStats(snapshot);
    renderTickets(userTickets);
  }

  servicesList.querySelectorAll(".service-card").forEach((card) => {
    card.addEventListener("click", () => {
      servicesList.querySelectorAll(".service-card").forEach((item) => item.classList.remove("ativo"));
      card.classList.add("ativo");
      const directService = card.dataset.servico || "";
      if (directService) {
        selectedService = directService;
      } else {
        const menu = card.querySelector(".service-menu");
        selectedService = menu ? menu.value : "";
      }
      renderServiceDocuments(selectedService);
      if (selectedService) {
        showMessage(`Servico selecionado: ${selectedService}`, "ok");
      } else {
        showMessage("Selecione o servico no menu deste cartao.", "warn");
      }
    });
  });

  servicesList.querySelectorAll(".service-menu").forEach((menuEl) => {
    menuEl.addEventListener("change", () => {
      const parentCard = menuEl.closest(".service-card");
      servicesList.querySelectorAll(".service-card").forEach((item) => item.classList.remove("ativo"));
      if (parentCard) parentCard.classList.add("ativo");
      selectedService = menuEl.value || "";
      renderServiceDocuments(selectedService);
      if (selectedService) showMessage(`Servico selecionado: ${selectedService}`, "ok");
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
  if (btnMeusDadosDesktop) btnMeusDadosDesktop.addEventListener("click", abrirDados);
  if (btnFecharDados) btnFecharDados.addEventListener("click", fecharDados);
  if (meusDadosPanel) {
    meusDadosPanel.addEventListener("click", (event) => {
      if (event.target === meusDadosPanel) fecharDados();
    });
  }
  if (btnOpenCalendarNav) btnOpenCalendarNav.addEventListener("click", abrirCalendario);
  if (btnCloseCalendar) btnCloseCalendar.addEventListener("click", fecharCalendario);
  if (btnPrevYear) {
    btnPrevYear.addEventListener("click", () => {
      calendarYear -= 1;
      renderAnnualCalendar();
    });
  }
  if (btnNextYear) {
    btnNextYear.addEventListener("click", () => {
      calendarYear += 1;
      renderAnnualCalendar();
    });
  }
  if (calendarPanel) {
    calendarPanel.addEventListener("click", (event) => {
      if (event.target === calendarPanel) fecharCalendario();
    });
  }

  profileName.textContent = `Perfil: ${session.name}`;
  if (dadoNome) dadoNome.textContent = session.name || "-";
  if (dadoEmail) dadoEmail.textContent = session.email || "-";
  if (dadoPerfil) dadoPerfil.textContent = session.role || "-";
  if (dadoLogin) dadoLogin.textContent = formatDate(session.loggedAt);
  renderAnnualCalendar();
  renderServiceDocuments("");
  renderSelectedFiles();
  window.IMTSBStore.onChange(render);
  render();
})();

