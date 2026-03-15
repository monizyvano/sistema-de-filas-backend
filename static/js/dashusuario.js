/**
 * DASHUSUARIO.JS - VERSÃO FINAL CORRIGIDA
 * Localização: static/js/dashusuario.js
 * 
 * ✅ Modo anônimo funcionando
 * ✅ Redirecionamento corrigido
 * ✅ Botão de login visível
 * ✅ Mensagens claras
 */

(function () {
  "use strict";

  // Permitir modo anônimo
  const session = window.IMTSBStore.requireRole(["usuario"]);
  if (!session) return;

  const isAnonymous = session.isAnonymous === true;

  // Elementos DOM
  const servicesList = document.getElementById("servicesList");
  const docInput = document.getElementById("docInput");
  const selectedFiles = document.getElementById("selectedFiles");
  const btnEmitirSenha = document.getElementById("btnAtendimento");
  const ticketMessage = document.getElementById("ticketMessage");
  const ticketsList = document.getElementById("ticketsList");
  const currentTicketEl = document.getElementById("currentTicket");
  const profileName = document.getElementById("userProfileName");
  const serviceDocsList = document.getElementById("serviceDocsList");
  const dadoNome = document.getElementById("dadoNome");
  const dadoEmail = document.getElementById("dadoEmail");
  const dadoPerfil = document.getElementById("dadoPerfil");

  const statFila = document.getElementById("statFila");
  const statTempo = document.getElementById("statTempo");
  const statDone = document.getElementById("statDone");
  const statSat = document.getElementById("statSat");

  let selectedService = "";
  let pollingInterval = null;
  let acompanhamentoInterval = null;

  const serviceDocuments = {
    "Matricula": [
      "Bilhete de Identidade do aluno",
      "Certificado de habilitações",
      "2 fotografias tipo passe"
    ],
    "Reconfirmacao": [
      "Cartão do aluno",
      "Comprovativo de pagamento",
      "Documento de identificação"
    ],
    "Pedido de declaracao": [
      "Comprovativo do motivo de prioridade",
      "Documento de identificação",
      "Formulário do pedido"
    ],
    "Tesouraria": [
      "Comprovativo de pagamento",
      "Documento de identificação"
    ],
    "Apoio ao Cliente": [
      "Nenhum documento necessário"
    ]
  };

  // =============================
  // FUNÇÕES AUXILIARES
  // =============================

  function showMessage(text, type) {
    if (!ticketMessage) return;
    ticketMessage.textContent = text || "";
    ticketMessage.className = "ticket-message";
    if (type) ticketMessage.classList.add(type);
  }

  function statusLabel(status) {
    const map = {
      "aguardando": "Aguardando",
      "em_atendimento": "Em Atendimento",
      "atendendo": "Em Atendimento",
      "concluido": "Concluído",
      "concluida": "Concluído"
    };
    return map[status] || status;
  }

  function formatDate(iso) {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("pt-BR");
    } catch {
      return "-";
    }
  }

  function renderSelectedFiles() {
    const files = Array.from(docInput?.files || []);
    if (!files.length) {
      if (selectedFiles) selectedFiles.textContent = "Nenhum documento selecionado.";
      return;
    }
    if (selectedFiles) {
      selectedFiles.textContent = files.map(f => 
        `${f.name} (${Math.ceil(f.size / 1024)} KB)`
      ).join(" | ");
    }
  }

  function renderServiceDocuments(service) {
    const docs = serviceDocuments[service] || ["Selecione um serviço."];
    if (!serviceDocsList) return;
    serviceDocsList.innerHTML = "";
    docs.forEach(doc => {
      const li = document.createElement("li");
      li.textContent = doc;
      serviceDocsList.appendChild(li);
    });
  }

  function getServiceName(servicoId) {
    const map = {
      1: "Matricula",
      2: "Reconfirmacao", 
      3: "Tesouraria",
      4: "Pedido de declaracao",
      5: "Apoio ao Cliente"
    };
    return map[servicoId] || `Serviço ${servicoId}`;
  }



  // ═══════════════════════════════════════════════════════════
  // 📍 ACOMPANHAMENTO DE SENHA — SPRINT 3
  // Mostra posição na fila e tempo estimado após emissão
  // ═══════════════════════════════════════════════════════════

  function iniciarAcompanhamento(numeroSenha) {
    /**
     * Inicia polling de 10s para actualizar posição na fila
     * da senha emitida. Para automaticamente quando chamada.
     */
    pararAcompanhamento();

    const tracker = document.getElementById('ticketTracker');
    if (tracker) tracker.style.display = 'block';

    // Executar imediatamente e depois a cada 10s
    actualizarPosicao(numeroSenha);
    acompanhamentoInterval = setInterval(
      () => actualizarPosicao(numeroSenha),
      10000
    );
  }

  function pararAcompanhamento() {
    if (acompanhamentoInterval) {
      clearInterval(acompanhamentoInterval);
      acompanhamentoInterval = null;
    }
  }

  async function actualizarPosicao(numeroSenha) {
    try {
      const resp = await fetch(`/api/dashboard/public/senha/${numeroSenha}`);
      if (!resp.ok) return;

      const data = await resp.json();

      // Elementos do ecrã do utente
      const posEl = document.getElementById('currentTicketPos');
      const tempoEl = document.getElementById('currentTicketTime');
      const statusEl = document.getElementById('currentTicketStatus');

      if (data.status === 'aguardando') {
        if (posEl) posEl.textContent = data.posicao || '–';
        if (tempoEl) {
          tempoEl.textContent = data.tempo_espera_estimado > 0
            ? `~${data.tempo_espera_estimado}min`
            : '–';
        }
        if (statusEl) statusEl.textContent = 'Aguardando';

      } else if (data.status === 'atendendo') {
        if (posEl) posEl.textContent = '🔔';
        if (tempoEl) tempoEl.textContent = 'É a sua vez!';
        if (statusEl) statusEl.textContent = `Balcão ${data.balcao}`;
        // Para o polling — já foi chamado
        pararAcompanhamento();

      } else if (data.status === 'concluida' || data.status === 'cancelada') {
        pararAcompanhamento();
        if (statusEl) statusEl.textContent = data.status;
      }

    } catch (e) {
      console.error('Erro ao actualizar posição:', e);
    }
  }

  // =============================
  // BUSCAR DADOS DA API
  // =============================

  async function fetchStats() {
    try {
      const stats = await window.ApiClient.getStats();
      
      if (statFila) statFila.textContent = String(stats.aguardando || 0);
      if (statDone) statDone.textContent = String(stats.concluidas || 0);
      if (statTempo) {
        const avgMin = Math.round((stats.tempo_medio_espera || 0));
        statTempo.textContent = `~${Math.max(1, avgMin)}min`;
      }
      if (statSat) {
        const sat = Math.round((stats.satisfacao || 0) * 100);
        statSat.textContent = `${sat}%`;
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    }
  }

  async function fetchMyTickets() {
    // Se anônimo, não buscar senhas
    if (isAnonymous) {
      if (currentTicketEl) currentTicketEl.textContent = "---";
      if (ticketsList) {
        ticketsList.innerHTML = `
          <p style="text-align: center; padding: 20px;">
            <strong>Faça login para ver seus atendimentos.</strong><br><br>
            <button 
              onclick="window.location.href='/login'" 
              style="padding: 10px 20px; background: #8C6746; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
              Fazer Login
            </button>
          </p>
        `;
      }
      return;
    }

    try {
      const allTickets = await window.ApiClient.getQueue();
      const myTickets = allTickets.filter(t => 
        t.usuario_contato === session.email
      );
      renderTickets(myTickets);
    } catch (error) {
      console.error("Erro ao buscar minhas senhas:", error);
      if (ticketsList) ticketsList.innerHTML = "<p>Erro ao carregar atendimentos.</p>";
    }
  }

  function renderTickets(tickets) {
    if (!tickets || tickets.length === 0) {
      if (currentTicketEl) currentTicketEl.textContent = "---";
      const tracker = document.getElementById("ticketTracker");
      if (tracker) tracker.style.display = "none";
      pararAcompanhamento();
      if (ticketsList) ticketsList.innerHTML = "<p>Sem atendimentos.</p>";
      return;
    }

    const active = tickets.find(t => 
      t.status !== "concluida" && t.status !== "concluido"
    ) || tickets[0];

    if (currentTicketEl) {
      currentTicketEl.textContent = `${active.numero} (${statusLabel(active.status)})`;
    }

    if (active.numero) {
      iniciarAcompanhamento(active.numero);
    }

    if (!ticketsList) return;
    ticketsList.innerHTML = "";

    tickets.forEach(ticket => {
      const item = document.createElement("article");
      item.className = "ticket-item";
      const serviceName = getServiceName(ticket.servico_id);

      item.innerHTML = `
        <div class="ticket-top">
          <span>${ticket.numero} - ${serviceName}</span>
          <span>${statusLabel(ticket.status)}</span>
        </div>
        <div>Emitida em: ${formatDate(ticket.emitida_em)}</div>
        <div>Tipo: ${ticket.tipo === 'prioritaria' ? 'Prioritária' : 'Normal'}</div>
      `;

      ticketsList.appendChild(item);
    });
  }

  // =============================
  // EMITIR SENHA (COM LOGIN)
  // =============================

  if (btnEmitirSenha) {
    btnEmitirSenha.addEventListener("click", async () => {
      if (!selectedService) {
        showMessage("⚠️ Selecione um serviço antes de emitir senha.", "warn");
        return;
      }

      // VERIFICAR LOGIN
      if (isAnonymous || !window.IMTSBStore.isLoggedIn()) {
        showMessage("🔒 Você precisa fazer login para emitir senha. Redirecionando...", "warn");
        
        // Redirecionar para login após 2s
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return;
      }

      showMessage("⏳ Emitindo senha...", "");

      try {
        const result = await window.ApiClient.issueTicket({
          service: selectedService,
          userEmail: session.email,
          userName: session.name
        });

        if (!result.ok) {
          if (result.requireLogin) {
            showMessage("🔒 Faça login para emitir senha. Redirecionando...", "warn");
            setTimeout(() => {
              window.location.href = "/login";
            }, 2000);
            return;
          }
          showMessage(result.message || "❌ Erro ao emitir senha", "warn");
          return;
        }

        const numeroSenha = result.ticket.code || result.ticket.numero;
        showMessage(`✅ Senha emitida com sucesso: ${numeroSenha}`, "ok");

        if (numeroSenha) {
          iniciarAcompanhamento(numeroSenha);
        }

        setTimeout(() => fetchMyTickets(), 500);

      } catch (error) {
        console.error("Erro ao emitir senha:", error);
        showMessage("❌ Erro ao conectar com servidor", "warn");
      }
    });
  }

  // =============================
  // SELEÇÃO DE SERVIÇO
  // =============================

  if (servicesList) {
    servicesList.querySelectorAll(".service-card").forEach(card => {
      card.addEventListener("click", () => {
        const servicoDireto = card.dataset.servico;
        const grupo = card.dataset.grupo;

        servicesList.querySelectorAll(".service-card").forEach(c => 
          c.classList.remove("ativo")
        );
        card.classList.add("ativo");

        const menu = card.querySelector("select");
        if (menu) {
          menu.addEventListener("change", () => {
            selectedService = menu.value;
            if (selectedService) {
              renderServiceDocuments(selectedService);
              showMessage(`✅ Serviço selecionado: ${selectedService}`, "ok");
            }
          });
          return;
        }

        // Serviço direto
        if (servicoDireto) {
          selectedService = servicoDireto;
          renderServiceDocuments(servicoDireto);
          showMessage(`✅ Serviço selecionado: ${servicoDireto}`, "ok");
        } else if (grupo) {
          selectedService = grupo;
          renderServiceDocuments(grupo);
          showMessage(`✅ Serviço selecionado: ${grupo}`, "ok");
        }
      });
    });
  }

  // =============================
  // UPLOAD DE DOCUMENTOS
  // =============================

  if (docInput) {
    docInput.addEventListener("change", renderSelectedFiles);
  }

  // =============================
  // BOTÕES
  // =============================

  const btnSairDesk = document.getElementById("btnSairUserDesktop");
  const btnSairMobile = document.getElementById("btnSairUserMobile");

  if (btnSairDesk) {
    btnSairDesk.addEventListener("click", () => {
      if (isAnonymous) {
        window.location.href = "/login";
      } else {
        window.IMTSBStore.logout();
      }
    });
  }

  if (btnSairMobile) {
    btnSairMobile.addEventListener("click", () => {
      if (isAnonymous) {
        window.location.href = "/login";
      } else {
        window.IMTSBStore.logout();
      }
    });
  }

  // Mudar texto do botão se anônimo
  if (isAnonymous) {
    if (btnSairDesk) {
      btnSairDesk.textContent = "🔑 Login";
      btnSairDesk.classList.add("btn-login-highlight");
    }
    if (btnSairMobile) {
      btnSairMobile.textContent = "🔑 Login";
      btnSairMobile.classList.add("btn-login-highlight");
    }
  }

  // =============================
  // INICIALIZAÇÃO
  // =============================

  if (profileName) {
    profileName.textContent = isAnonymous 
      ? "👤 Visitante (não logado)" 
      : `👤 ${session.name}`;
  }
  
  if (dadoNome) dadoNome.textContent = session.name || "-";
  if (dadoEmail) dadoEmail.textContent = isAnonymous ? "Não logado - Clique em Login" : (session.email || "-");
  if (dadoPerfil) dadoPerfil.textContent = isAnonymous ? "Visitante" : (session.role || "-");

  renderServiceDocuments("");
  renderSelectedFiles();

  fetchStats();
  fetchMyTickets();

  // Polling a cada 5 segundos
  pollingInterval = setInterval(() => {
    fetchStats();
    if (!isAnonymous) {
      fetchMyTickets();
    }
  }, 5000);

  console.log(isAnonymous 
    ? "✅ Dashboard usuário (modo anônimo - login disponível)"
    : "✅ Dashboard usuário (logado como " + session.email + ")"
  );

})();

// Funções globais
function clickMenu() {
  const itens = document.getElementById("itens");
  if (itens) {
    itens.style.display = itens.style.display === "block" ? "none" : "block";
  }
}

function mudoutamanho() {
  const itens = document.getElementById("itens");
  if (itens) {
    itens.style.display = window.innerWidth >= 768 ? "block" : "none";
  }
}

window.addEventListener("resize", mudoutamanho);
window.addEventListener("load", mudoutamanho);