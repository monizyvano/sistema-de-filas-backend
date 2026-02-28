(function () {
  "use strict";

  const DATA_KEY = "imtsb_realtime_data_v1";
  const SESSION_KEY = "imtsb_session_v1";

  function nowIso() {
    return new Date().toISOString();
  }

  function seedData() {
    return {
      updatedAt: nowIso(),
      counterNormal: 0,
      counterPriority: 0,
      currentTicketId: null,
      lastCalled: null,
      dailyArchives: [],
      users: [
        { id: "u-admin-1", name: "Administrador 1", email: "admin1@sb.com", password: "Admin1234", role: "admin" },
        { id: "u-admin-2", name: "Administrador 2", email: "admin2@sb.com", password: "Admin2234", role: "admin" },
        { id: "u-worker-1", name: "Trabalhador 1", email: "trabalhador@sb.com", password: "Trab12345", role: "trabalhador", department: "Secretaria Academica" },
        { id: "u-user-1", name: "Usuario 1", email: "usuario@sb.com", password: "User12345", role: "usuario" }
      ],
      queue: [],
      history: []
    };
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeDepartment(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "secretaria academica" || raw === "secretaria") return "Secretaria Academica";
    if (raw === "contabilidade" || raw === "tesouraria") return "Contabilidade";
    if (raw === "apoio ao cliente") return "Apoio ao Cliente";
    return "Apoio ao Cliente";
  }

  function departmentCounterName(department) {
    const normalized = normalizeDepartment(department);
    if (normalized === "Secretaria Academica") return "Balcao 1 - Secretaria Academica";
    if (normalized === "Contabilidade") return "Balcao 2 - Contabilidade";
    return "Balcao 3 - Apoio ao Cliente";
  }

  function resolveRoutingByService(service) {
    const key = String(service || "").trim().toLowerCase();
    if (key === "matricula") return { department: "Secretaria Academica", counterNumber: 1 };
    if (key === "reconfirmacao") return { department: "Secretaria Academica", counterNumber: 1 };
    if (key === "tesouraria") return { department: "Contabilidade", counterNumber: 2 };
    if (key === "pedido de declaracao") return { department: "Secretaria Academica", counterNumber: 1 };
    if (key === "apoio ao cliente") return { department: "Apoio ao Cliente", counterNumber: 3 };
    return { department: "Apoio ao Cliente", counterNumber: 3 };
  }

  function readData() {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) {
      const data = seedData();
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      return data;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") throw new Error("invalid");
      if (!Array.isArray(parsed.users)) parsed.users = [];
      if (!Array.isArray(parsed.queue)) parsed.queue = [];
      if (!Array.isArray(parsed.history)) parsed.history = [];
      if (!Array.isArray(parsed.dailyArchives)) parsed.dailyArchives = [];
      parsed.users = parsed.users.map((user) => {
        if (user.role === "trabalhador") {
          user.department = normalizeDepartment(user.department);
        }
        return user;
      });
      parsed.queue = parsed.queue.map((ticket) => {
        const route = resolveRoutingByService(ticket.service);
        ticket.department = normalizeDepartment(ticket.department || route.department);
        ticket.counterNumber = ticket.counterNumber || route.counterNumber;
        ticket.counterName = ticket.counterName || departmentCounterName(ticket.department);
        return ticket;
      });
      parsed.history = parsed.history.map((ticket) => {
        const route = resolveRoutingByService(ticket.service);
        ticket.department = normalizeDepartment(ticket.department || route.department);
        ticket.counterNumber = ticket.counterNumber || route.counterNumber;
        ticket.counterName = ticket.counterName || departmentCounterName(ticket.department);
        return ticket;
      });
      if (typeof parsed.counterNormal !== "number") {
        parsed.counterNormal = typeof parsed.counter === "number" ? parsed.counter : 0;
      }
      if (typeof parsed.counterPriority !== "number") parsed.counterPriority = 0;
      if (!Object.prototype.hasOwnProperty.call(parsed, "currentTicketId")) parsed.currentTicketId = null;
      return parsed;
    } catch (_error) {
      const data = seedData();
      localStorage.setItem(DATA_KEY, JSON.stringify(data));
      return data;
    }
  }

  function writeData(data) {
    data.updatedAt = nowIso();
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("imtsb:data-changed"));
  }

  function updateData(mutator) {
    const data = readData();
    const result = mutator(data);
    writeData(data);
    return result;
  }

  function getSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (_error) {
      return null;
    }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || null,
      loggedAt: nowIso()
    }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function nextCode(counter, prefix) {
    const value = counter + 1;
    const padded = String(value).padStart(3, "0");
    return { counter: value, code: `${prefix}${padded}` };
  }

  function findTicketById(data, ticketId) {
    const inQueue = data.queue.find((item) => item.id === ticketId);
    if (inQueue) return inQueue;

    const inHistory = data.history.find((item) => item.id === ticketId);
    if (inHistory) return inHistory;

    return null;
  }

  const store = {
    dataKey: DATA_KEY,
    apiEnabled: !!(window.IMTSBApiConfig && window.IMTSBApiConfig.enabled),
    apiConfig: window.IMTSBApiConfig || null,
    apiClient: window.IMTSBApiClient || null,

    ensureSeed() {
      readData();
    },

    onChange(handler) {
      const wrapped = () => handler();
      window.addEventListener("imtsb:data-changed", wrapped);
      window.addEventListener("storage", (event) => {
        if (event.key === DATA_KEY) handler();
      });
      return () => window.removeEventListener("imtsb:data-changed", wrapped);
    },

    getSnapshot() {
      return clone(readData());
    },

    getSession,

    requireRole(roles) {
      const session = getSession();
      if (!session || !roles.includes(session.role)) {
        window.location.href = "logintcc.html";
        return null;
      }
      return session;
    },

    logout() {
      clearSession();
      window.location.href = "logintcc.html";
    },

    login(email, password, selectedRole) {
      const normalized = normalizeEmail(email);
      const typedPassword = String(password || "");

      const data = readData();
      const user = data.users.find((item) => item.email === normalized);

      if (!user) {
        return { ok: false, message: "Conta nao encontrada. Faça o cadastro." };
      }

      if (user.password !== typedPassword) {
        return { ok: false, message: "Senha incorreta." };
      }

      if (selectedRole && user.role !== selectedRole) {
        return { ok: false, message: "O perfil selecionado nao corresponde a esta conta." };
      }

      setSession(user);

      return {
        ok: true,
        user: { name: user.name, role: user.role, email: user.email },
        redirect: user.role === "admin" ? "dashadm.html" : (user.role === "trabalhador" ? "dashtrabalho.html" : "index.html")
      };
    },

    register(payload) {
      const name = String(payload.name || "").trim();
      const email = normalizeEmail(payload.email);
      const password = String(payload.password || "");
      const role = "usuario";

      if (name.length < 3) return { ok: false, message: "Nome deve ter pelo menos 3 caracteres." };
      if (!email.includes("@")) return { ok: false, message: "Email invalido." };
      if (password.length < 6) return { ok: false, message: "Senha deve ter pelo menos 6 caracteres." };

      return updateData((data) => {
        if (data.users.some((item) => item.email === email)) {
          return { ok: false, message: "Ja existe conta com este email." };
        }

        data.users.push({
          id: `u-${Date.now()}`,
          name,
          email,
          password,
          role
        });

        return { ok: true, message: "Conta criada com sucesso." };
      });
    },

    addWorker(payload) {
      const name = String(payload.name || "").trim();
      const email = normalizeEmail(payload.email);
      const password = String(payload.password || "");
      const department = normalizeDepartment(payload.department);

      if (name.length < 3) return { ok: false, message: "Nome deve ter pelo menos 3 caracteres." };
      if (!email.includes("@")) return { ok: false, message: "Email invalido." };
      if (password.length < 6) return { ok: false, message: "Senha deve ter pelo menos 6 caracteres." };

      return updateData((data) => {
        if (data.users.some((item) => item.email === email)) {
          return { ok: false, message: "Ja existe conta com este email." };
        }

        data.users.push({
          id: `u-${Date.now()}`,
          name,
          email,
          password,
          role: "trabalhador",
          department
        });

        return { ok: true, message: "Trabalhador adicionado com sucesso." };
      });
    },

    removeWorker(workerId) {
      const id = String(workerId || "").trim();
      if (!id) return { ok: false, message: "Trabalhador invalido." };

      return updateData((data) => {
        const index = data.users.findIndex((item) => item.id === id && item.role === "trabalhador");
        if (index === -1) return { ok: false, message: "Trabalhador nao encontrado." };
        const worker = data.users[index];
        const hasCurrent = data.queue.some((item) => item.status === "em_atendimento" && item.attendedBy === worker.name);
        if (hasCurrent) return { ok: false, message: "Nao e possivel remover trabalhador em atendimento." };
        data.users.splice(index, 1);
        return { ok: true, message: "Trabalhador removido com sucesso." };
      });
    },

    issueTicket(payload) {
      const service = String(payload.service || "").trim();
      const userEmail = normalizeEmail(payload.userEmail);
      const userName = String(payload.userName || "").trim() || "Usuario";
      const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

      if (!service) return { ok: false, message: "Selecione um servico." };

      return updateData((data) => {
        const serviceKey = service.toLowerCase();
        const isPriority = serviceKey === "pedido de declaracao" || serviceKey === "senhas prioritarias";
        const route = resolveRoutingByService(service);
        const next = isPriority
          ? nextCode(data.counterPriority, "P")
          : nextCode(data.counterNormal, "N");

        if (isPriority) data.counterPriority = next.counter;
        else data.counterNormal = next.counter;

        const ticket = {
          id: `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          code: next.code,
          service,
          userEmail,
          userName,
          status: "aguardando",
          department: route.department,
          counterNumber: route.counterNumber,
          counterName: departmentCounterName(route.department),
          createdAt: nowIso(),
          calledAt: null,
          receivedAt: null,
          completedAt: null,
          attendedBy: null,
          notes: "",
          rating: null,
          attachments: attachments.map((file, index) => ({
            id: `a-${Date.now()}-${index}`,
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl: file.dataUrl,
            uploadedAt: nowIso()
          }))
        };

        data.queue.push(ticket);
        return { ok: true, ticket: clone(ticket) };
      });
    },

    callNext(attendantInput, maybeDepartment) {
      const who = typeof attendantInput === "object"
        ? String(attendantInput.name || "Trabalhador").trim()
        : String(attendantInput || "Trabalhador").trim();
      const departmentRaw = typeof attendantInput === "object"
        ? attendantInput.department
        : maybeDepartment;
      const department = normalizeDepartment(departmentRaw);

      return updateData((data) => {
        if (data.queue.length === 0) {
          return { ok: false, message: "Nao ha senha na fila." };
        }

        const current = data.queue.find((item) => item.status === "em_atendimento" && item.attendedBy === who);
        if (current) {
          return { ok: false, message: "Finalize o atendimento atual antes de chamar o proximo." };
        }

        const waitingInDepartment = data.queue
          .filter((item) => item.status === "aguardando" && normalizeDepartment(item.department) === department)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const next = waitingInDepartment.find((item) => String(item.code || "").startsWith("P"))
          || waitingInDepartment[0];
        if (!next) return { ok: false, message: "Nao ha senha aguardando." };

        next.status = "em_atendimento";
        next.calledAt = nowIso();
        next.attendedBy = who;
        data.currentTicketId = next.id;
        data.lastCalled = { code: next.code, service: next.service, counterName: next.counterName, at: nowIso() };

        return { ok: true, ticket: clone(next) };
      });
    },

    concludeCurrent(attendantName, notes, serviceDurationSec) {
      const who = String(attendantName || "Trabalhador").trim();
      const note = String(notes || "").trim();
      const duration = Number(serviceDurationSec) || 0;

      return updateData((data) => {
        const ticket = data.queue.find((item) => item.status === "em_atendimento" && item.attendedBy === who)
          || data.queue.find((item) => item.id === data.currentTicketId && item.status === "em_atendimento");
        if (!ticket) {
          return { ok: false, message: "Nenhum atendimento em andamento." };
        }

        ticket.status = "concluido";
        ticket.completedAt = nowIso();
        ticket.attendedBy = who;
        if (note) ticket.notes = note;
        ticket.serviceDurationSec = duration;
        ticket.receipt = {
          fileName: `recibo_${ticket.code}.txt`,
          format: "txt",
          mimeType: "text/plain;charset=utf-8",
          generatedAt: nowIso(),
          content:
`Instituto Medio Tecnico Sao Benedito
Recibo de Atendimento
Senha: ${ticket.code}
Servico: ${ticket.service}
Usuario: ${ticket.userName} (${ticket.userEmail})
Atendido por: ${who}
Hora de emissao: ${ticket.createdAt}
Hora de conclusao: ${ticket.completedAt}
Duracao de atendimento (segundos): ${duration}
Observacoes: ${ticket.notes || "Sem observacoes"}
`
        };

        data.history.unshift(ticket);
        data.queue = data.queue.filter((item) => item.id !== ticket.id);
        if (data.currentTicketId === ticket.id) data.currentTicketId = null;

        return { ok: true, ticket: clone(ticket) };
      });
    },

    setReceipt(ticketId, receiptPayload) {
      const id = String(ticketId || "").trim();
      if (!id) return { ok: false, message: "Ticket invalido." };

      return updateData((data) => {
        const ticket = findTicketById(data, id);
        if (!ticket) return { ok: false, message: "Senha nao encontrada." };
        if (ticket.status !== "concluido") return { ok: false, message: "Recibo apenas para atendimento concluido." };

        ticket.receipt = {
          fileName: String(receiptPayload.fileName || `recibo_${ticket.code}.txt`),
          format: String(receiptPayload.format || "txt"),
          mimeType: String(receiptPayload.mimeType || "text/plain;charset=utf-8"),
          generatedAt: nowIso(),
          content: String(receiptPayload.content || ""),
          dataUrl: receiptPayload.dataUrl ? String(receiptPayload.dataUrl) : null
        };

        return { ok: true, ticket: clone(ticket) };
      });
    },

    redirectCurrent(attendantName, notes) {
      const who = String(attendantName || "Trabalhador").trim();
      const note = String(notes || "Reencaminhado").trim();

      return updateData((data) => {
        const ticket = data.queue.find((item) => item.status === "em_atendimento" && item.attendedBy === who)
          || data.queue.find((item) => item.id === data.currentTicketId && item.status === "em_atendimento");
        if (!ticket) {
          return { ok: false, message: "Nenhum atendimento em andamento." };
        }

        ticket.status = "aguardando";
        ticket.notes = `${note} (${nowIso()})`;
        ticket.calledAt = null;
        ticket.attendedBy = who;
        if (data.currentTicketId === ticket.id) data.currentTicketId = null;

        return { ok: true, ticket: clone(ticket) };
      });
    },

    setCurrentNote(note, attendantName) {
      const text = String(note || "").trim();
      const who = String(attendantName || "Trabalhador").trim();
      return updateData((data) => {
        const ticket = data.queue.find((item) => item.status === "em_atendimento" && item.attendedBy === who)
          || data.queue.find((item) => item.id === data.currentTicketId && item.status === "em_atendimento");
        if (!ticket) return { ok: false, message: "Nenhum atendimento em andamento." };
        ticket.notes = text;
        return { ok: true, ticket: clone(ticket) };
      });
    },

    markReceived(ticketId, userEmail) {
      return updateData((data) => {
        const ticket = findTicketById(data, ticketId);
        if (!ticket) return { ok: false, message: "Senha nao encontrada." };
        if (ticket.userEmail !== normalizeEmail(userEmail)) return { ok: false, message: "Senha nao pertence ao usuario logado." };

        ticket.receivedAt = nowIso();
        return { ok: true, ticket: clone(ticket) };
      });
    },

    rateTicket(ticketId, userEmail, score, comment) {
      const value = Number(score);
      const text = String(comment || "").trim();

      if (!Number.isFinite(value) || value < 1 || value > 5) {
        return { ok: false, message: "Avaliacao deve ser entre 1 e 5." };
      }

      return updateData((data) => {
        const ticket = findTicketById(data, ticketId);
        if (!ticket) return { ok: false, message: "Senha nao encontrada." };
        if (ticket.userEmail !== normalizeEmail(userEmail)) return { ok: false, message: "Senha nao pertence ao usuario logado." };
        if (ticket.status !== "concluido") return { ok: false, message: "Avaliacao disponivel apenas para atendimento concluido." };

        ticket.rating = {
          score: value,
          comment: text,
          at: nowIso()
        };

        return { ok: true, ticket: clone(ticket) };
      });
    },

    archiveAndResetDay(label) {
      const archiveLabel = String(label || "").trim() || new Date().toISOString().slice(0, 10);

      return updateData((data) => {
        const snapshot = {
          id: `day-${Date.now()}`,
          label: archiveLabel,
          createdAt: nowIso(),
          queue: clone(data.queue),
          history: clone(data.history),
          counterNormal: data.counterNormal,
          counterPriority: data.counterPriority,
          totalTickets: data.queue.length + data.history.length
        };

        data.dailyArchives.unshift(snapshot);
        data.queue = [];
        data.history = [];
        data.counterNormal = 0;
        data.counterPriority = 0;
        data.currentTicketId = null;
        data.lastCalled = null;

        return { ok: true, archive: clone(snapshot), message: "Historico guardado e painel reiniciado." };
      });
    }
  };

  window.IMTSBStore = store;
  store.ensureSeed();
})();

