(function () {
  "use strict";

  const serviceMap = {
    "Matricula": { servico_id: 1, tipo: "normal" },
    "Reconfirmacao": { servico_id: 2, tipo: "normal" },
    "Tesouraria": { servico_id: 3, tipo: "normal" },
    "Pedido de declaracao": { servico_id: 4, tipo: "prioritaria" },
    "Apoio ao Cliente": { servico_id: 5, tipo: "normal" }
  };

  const statusMap = {
    aguardando: "aguardando",
    atendendo: "em_atendimento",
    em_atendimento: "em_atendimento",
    concluida: "concluido",
    concluido: "concluido",
    cancelada: "cancelado",
    cancelado: "cancelado"
  };

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function detectRoleByEmail(email) {
    const normalized = normalizeEmail(email);
    if (normalized.includes("admin")) return "admin";
    if (normalized.includes("trabalhador") || normalized.includes("worker") || normalized.includes("atendente")) {
      return "trabalhador";
    }
    return "usuario";
  }

  function roleRedirect(role) {
    if (role === "admin") return "/dashadm.html";
    if (role === "trabalhador") return "/dashtrabalho.html";
    return "/index.html";
  }

  function mapService(serviceName) {
    return serviceMap[String(serviceName || "").trim()] || { servico_id: 1, tipo: "normal" };
  }

  function convertStatus(value) {
    const key = String(value || "").trim().toLowerCase();
    return statusMap[key] || "aguardando";
  }

  function adaptLoginResponse(apiData, fallbackEmail, selectedRole) {
    const atendente = apiData && apiData.atendente ? apiData.atendente : {};
    const email = normalizeEmail(atendente.email || fallbackEmail);
    const roleFromApi = atendente.tipo === "admin" ? "admin" : "trabalhador";
    const role = selectedRole || roleFromApi || detectRoleByEmail(email);

    return {
      ok: true,
      user: {
        id: atendente.id || null,
        name: atendente.nome || email || "Utilizador",
        email,
        role,
        department: null
      },
      accessToken: (apiData && apiData.access_token) || null,
      refreshToken: (apiData && apiData.refresh_token) || null,
      redirect: roleRedirect(role),
      raw: apiData || {}
    };
  }

  function adaptTicketResponse(rawTicket) {
    const ticket = rawTicket || {};
    const numero = ticket.numero || ticket.code || "";

    return {
      id: ticket.id || null,
      code: numero,
      status: convertStatus(ticket.status),
      serviceId: ticket.servico_id || ticket.servicoId || null,
      createdAt: ticket.data_emissao || ticket.created_at || ticket.createdAt || null,
      raw: ticket
    };
  }

  async function login(apiClient, payload) {
    if (!apiClient || typeof apiClient.login !== "function") {
      return { ok: false, message: "Cliente da API indisponivel." };
    }

    const email = normalizeEmail(payload && payload.email);
    const senha = String((payload && payload.senha) || "");
    const selectedRole = payload && payload.tipo ? payload.tipo : null;

    const result = await apiClient.login({ email, senha });
    if (!result || !result.ok) {
      return { ok: false, message: (result && result.message) || "Falha no login." };
    }

    return adaptLoginResponse(result.data, email, selectedRole);
  }

  async function emitirSenha(apiClient, payload) {
    const cfg = window.IMTSBApiConfig || {};
    const mapped = mapService(payload && payload.service);
    const accessToken = apiClient && typeof apiClient.getAccessToken === "function"
      ? apiClient.getAccessToken()
      : null;

    const headers = {
      "Content-Type": "application/json"
    };

    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    try {
      const response = await fetch(`${cfg.baseUrl || ""}/senhas`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          servico_id: mapped.servico_id,
          tipo: mapped.tipo,
          usuario_contato: (payload && payload.userEmail) || ""
        })
      });

      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        return { ok: false, message: data.erro || data.message || "Falha ao emitir senha.", raw: data };
      }

      const ticket = adaptTicketResponse(data.senha || data.ticket || data);
      return { ok: true, ticket, raw: data };
    } catch (error) {
      return { ok: false, message: "Erro de conexao com backend.", error: String(error || "") };
    }
  }

  const ApiAdapter = {
    serviceMap,
    statusMap,
    mapService,
    convertStatus,
    detectRoleByEmail,
    roleRedirect,
    adaptLoginResponse,
    adaptTicketResponse,
    login,
    emitirSenha
  };

  window.ApiAdapter = ApiAdapter;
})();
