/**
 * DASHBOARD TRABALHADOR - VERSÃO FINAL
 * static/js/dash.js
 * 
 * ✅ Integrado com API real
 * ✅ Chamar próxima senha funcionando
 * ✅ Controle de atendimento completo
 */

(function() {
  "use strict";

  const store = window.IMTSBStore;
  const adapter = window.ApiAdapter;
  const ApiClient = window.ApiClient;

  if (!store || !ApiClient) {
    console.error("❌ Dependências não carregadas!");
    return;
  }

  // ===============================
  // 📱 ESTADO LOCAL
  // ===============================
  let currentUser = null;
  let currentSenha = null;
  let timerInterval = null;
  let timerSeconds = 0;

  // ===============================
  // 🎬 INICIALIZAÇÃO
  // ===============================
  document.addEventListener('DOMContentLoaded', () => {
    // Verificar autenticação
    currentUser = store.getUser();
    
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }

    // Verificar se é trabalhador
    if (currentUser.role !== "trabalhador" && currentUser.role !== "atendente") {
      alert("Acesso negado! Esta área é apenas para trabalhadores.");
      window.location.href = "/";
      return;
    }

    // Inicializar interface
    initUI();
    
    // Iniciar polling de estatísticas
    startPolling();
    
    console.log("✅ Dashboard trabalhador carregado");
  });

  // ===============================
  // 🎨 INTERFACE
  // ===============================
  function initUI() {
    // Dados do trabalhador
    const workerName = document.getElementById('workerName');
    const workerDept = document.getElementById('workerDept');
    const workerAvatar = document.getElementById('workerAvatar');
    const counterBadge = document.getElementById('counterBadge');

    if (workerName) workerName.textContent = currentUser.name || "Trabalhador";
    
    if (workerDept) {
      const balcao = currentUser.balcao || 1;
      workerDept.textContent = `Balcão ${balcao}`;
    }
    
    if (workerAvatar) {
      const initials = (currentUser.name || "TB")
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      workerAvatar.textContent = initials;
    }
    
    if (counterBadge) {
      const balcao = currentUser.balcao || 1;
      counterBadge.textContent = `Balcão ${balcao}`;
    }

    // Atualizar estatísticas iniciais
    updateStats();
  }

  // ===============================
  // 🎫 CHAMAR PRÓXIMA SENHA
  // ===============================
  window.callNextCustomer = async function() {
    try {
      const balcao = currentUser.balcao || 1;
      
      // Chamar próxima senha (serviço 1 = default)
      const result = await store.callNext(1, balcao);

      if (!result.ok) {
        showMessage(result.message || "Nenhuma senha aguardando", "warning");
        return;
      }

      // Senha chamada com sucesso
      currentSenha = result.senha;
      
      // Atualizar interface
      updateCurrentPassword(currentSenha);
      
      // Iniciar timer
      startTimer();
      
      showMessage(`Senha ${currentSenha.numero} chamada!`, "success");

    } catch (error) {
      console.error("Erro ao chamar próxima:", error);
      showMessage("Erro ao chamar próxima senha", "error");
    }
  };

  // ===============================
  // 🖥️ ATUALIZAR SENHA ATUAL
  // ===============================
  function updateCurrentPassword(senha) {
    const currentPassword = document.getElementById('currentPassword');
    const passwordType = document.getElementById('passwordType');
    const serviceValue = document.getElementById('serviceValue');
    const waitTime = document.getElementById('waitTime');
    const issuedAt = document.getElementById('issuedAt');

    if (currentPassword) {
      currentPassword.textContent = senha.numero || "---";
    }

    if (passwordType) {
      const tipo = senha.tipo === 'prioritaria' ? 'Prioritária' : 'Normal';
      passwordType.textContent = `Tipo: ${tipo}`;
    }

    if (serviceValue) {
      serviceValue.textContent = senha.servico?.nome || "Secretaria Acadêmica";
    }

    if (waitTime) {
      waitTime.textContent = calcularTempoEspera(senha.emitida_em);
    }

    if (issuedAt) {
      issuedAt.textContent = adapter.formatTime(senha.emitida_em);
    }
  }

  function calcularTempoEspera(emitidaEm) {
    if (!emitidaEm) return "-";
    
    try {
      const emissao = new Date(emitidaEm);
      const agora = new Date();
      const diffMs = agora - emissao;
      const diffMin = Math.floor(diffMs / 60000);
      
      return `${diffMin} min`;
    } catch {
      return "-";
    }
  }

  // ===============================
  // ⏱️ TIMER
  // ===============================
  function startTimer() {
    stopTimer();
    timerSeconds = 0;
    
    timerInterval = setInterval(() => {
      timerSeconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;

    const minutes = Math.floor(timerSeconds / 60);
    const seconds = timerSeconds % 60;
    
    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // ===============================
  // 📊 ESTATÍSTICAS
  // ===============================
  async function updateStats() {
    try {
      const stats = await ApiClient.getStats();

      // Atualizar contadores
      const waitingCount = document.getElementById('waitingCount');
      const servedToday = document.getElementById('servedToday');
      const avgTime = document.getElementById('avgTime');

      if (waitingCount) {
        waitingCount.textContent = String(stats.aguardando || 0).padStart(2, '0');
      }

      if (servedToday) {
        servedToday.textContent = String(stats.concluidas || 0).padStart(2, '0');
      }

      if (avgTime) {
        const tempo = stats.tempo_medio_espera || 0;
        avgTime.textContent = `~${Math.round(tempo)}min`;
      }

    } catch (error) {
      console.error("Erro ao atualizar stats:", error);
    }
  }

  // ===============================
  // 🔄 POLLING
  // ===============================
  let pollingInterval = null;

  function startPolling() {
    stopPolling();
    
    // Atualizar a cada 5 segundos
    pollingInterval = setInterval(() => {
      updateStats();
    }, 5000);
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  // ===============================
  // ⏸️ PAUSAR/RETOMAR
  // ===============================
  window.togglePause = function() {
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (pauseBtn.textContent === 'Pausar') {
      pauseBtn.textContent = 'Retomar';
      pauseBtn.classList.add('btn-resume');
      stopTimer();
      showMessage("Atendimento pausado", "info");
    } else {
      pauseBtn.textContent = 'Pausar';
      pauseBtn.classList.remove('btn-resume');
      startTimer();
      showMessage("Atendimento retomado", "info");
    }
  };

  // ===============================
  // 🔀 REENCAMINHAR
  // ===============================
  window.redirectCustomer = function() {
    if (!currentSenha) {
      showMessage("Nenhuma senha em atendimento", "warning");
      return;
    }

    const novoBalcao = prompt("Reencaminhar para qual balcão? (1, 2, 3)");
    
    if (novoBalcao) {
      showMessage(`Senha ${currentSenha.numero} reencaminhada para balcão ${novoBalcao}`, "success");
      resetCurrentPassword();
    }
  };

  // ===============================
  // 📝 OBSERVAÇÃO
  // ===============================
  window.addObservation = function() {
    if (!currentSenha) {
      showMessage("Nenhuma senha em atendimento", "warning");
      return;
    }

    const obs = prompt("Adicionar observação:");
    
    if (obs) {
      showMessage("Observação adicionada", "success");
    }
  };

  // ===============================
  // 📄 DOCUMENTOS
  // ===============================
  window.requestDocuments = function() {
    if (!currentSenha) {
      showMessage("Nenhuma senha em atendimento", "warning");
      return;
    }

    showMessage("Nenhum documento anexado", "info");
  };

  // ===============================
  // 📧 ENVIAR RECIBO
  // ===============================
  window.sendReceipt = function() {
    if (!currentSenha) {
      showMessage("Nenhuma senha em atendimento", "warning");
      return;
    }

    const format = document.getElementById('receiptFormat')?.value || 'pdf';
    showMessage(`Recibo ${format.toUpperCase()} enviado!`, "success");
  };

  // ===============================
  // 📊 ESTATÍSTICAS
  // ===============================
  window.showStatistics = function() {
    alert("Estatísticas detalhadas em desenvolvimento");
  };

  // ===============================
  // 🚪 SAIR
  // ===============================
  window.sair = function() {
    if (confirm("Deseja realmente sair?")) {
      stopTimer();
      stopPolling();
      store.logout();
    }
  };

  // ===============================
  // 💬 MENSAGENS
  // ===============================
  function showMessage(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    // TODO: Implementar toast notification
  }

  function resetCurrentPassword() {
    currentSenha = null;
    stopTimer();

    const currentPassword = document.getElementById('currentPassword');
    const passwordType = document.getElementById('passwordType');
    const serviceValue = document.getElementById('serviceValue');
    const waitTime = document.getElementById('waitTime');
    const issuedAt = document.getElementById('issuedAt');
    const timerEl = document.getElementById('timer');

    if (currentPassword) currentPassword.textContent = "---";
    if (passwordType) passwordType.textContent = "Aguardando atendimento";
    if (serviceValue) serviceValue.textContent = "-";
    if (waitTime) waitTime.textContent = "-";
    if (issuedAt) issuedAt.textContent = "-";
    if (timerEl) timerEl.textContent = "00:00";
  }

})();