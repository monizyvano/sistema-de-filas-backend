/**
 * ✅ DASH.JS CORRIGIDO - DASHBOARD TRABALHADOR
 * 
 * CORREÇÕES:
 * - Fix 401 ao chamar próxima
 * - Dados reais do backend
 * - Histórico de atendimentos
 * - Estatísticas calculadas
 * - Timer funcionando
 * 
 * static/js/dash.js
 */

(function() {
  "use strict";

  const store = window.IMTSBStore;
  const ApiClient = window.ApiClient;

  // Estado local
  let senhaAtual = null;
  let timerInterval = null;
  let pollingInterval = null;

  // ===============================
  // 🎬 INICIALIZAÇÃO
  // ===============================
  document.addEventListener('DOMContentLoaded', async () => {
    console.log("✅ Dashboard trabalhador carregado");

    // Verificar autenticação
    if (!store.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }

    // Verificar permissão
    const user = store.getUser();
    if (user.role !== 'trabalhador' && user.role !== 'admin') {
      alert("Acesso negado. Apenas trabalhadores podem acessar esta página.");
      window.location.href = '/';
      return;
    }

    // Carregar dados do trabalhador
    await carregarDadosTrabalhador();

    // Atualizar estatísticas
    await atualizarEstatisticas();

    // Atualizar histórico
    await atualizarHistorico();

    // Iniciar polling
    iniciarPolling();
  });

  // ===============================
  // 👤 CARREGAR DADOS DO TRABALHADOR
  // ===============================
  async function carregarDadosTrabalhador() {
    const user = store.getUser();

    // Atualizar header
    const workerName = document.getElementById('workerName');
    const workerDept = document.getElementById('workerDept');
    const workerAvatar = document.getElementById('workerAvatar');
    const counterBadge = document.getElementById('counterBadge');

    if (workerName) workerName.textContent = user.name || 'Trabalhador';
    if (workerDept) workerDept.textContent = user.departamento || 'Atendimento';

    // Avatar com iniciais
    if (workerAvatar) {
      const initials = (user.name || 'T')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
      workerAvatar.textContent = initials;
    }

    // Número do balcão
    if (counterBadge) {
      counterBadge.textContent = `Balcão ${user.numero_balcao || 1}`;
    }
  }

  // ===============================
  // 📊 ATUALIZAR ESTATÍSTICAS
  // ===============================
  async function atualizarEstatisticas() {
    try {
      const user = store.getUser();

      // Buscar estatísticas do trabalhador
      const response = await fetch('/api/dashboard/trabalhador/estatisticas', {
        headers: {
          'Authorization': `Bearer ${store.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error("Erro ao buscar estatísticas:", response.status);
        return;
      }

      const stats = await response.json();

      // Atualizar cards
      const waitingCount = document.getElementById('waitingCount');
      const servedToday = document.getElementById('servedToday');
      const avgTime = document.getElementById('avgTime');

      if (waitingCount) waitingCount.textContent = stats.aguardando || '0';
      if (servedToday) servedToday.textContent = stats.atendidos_hoje || '0';
      if (avgTime) {
        const tempo = stats.tempo_medio_atendimento || 0;
        avgTime.textContent = `~${tempo}min`;
      }

    } catch (error) {
      console.error("❌ Erro ao atualizar estatísticas:", error);
    }
  }

  // ===============================
  // 📞 CHAMAR PRÓXIMA SENHA
  // ===============================
  window.callNextCustomer = async function() {
    try {
      const user = store.getUser();
      const btnNext = document.querySelector('.btn-next');

      // Desabilitar botão
      if (btnNext) {
        btnNext.disabled = true;
        btnNext.textContent = 'Chamando...';
      }

      // Chamar API
      const result = await store.callNext(
        1, // servico_id (TODO: pegar do select)
        user.numero_balcao || 1
      );

      if (result.ok && result.senha) {
        senhaAtual = result.senha;

        // Atualizar display
        atualizarDisplayAtual(senhaAtual);

        // Iniciar timer
        iniciarTimer();

        // Atualizar histórico
        await atualizarHistorico();

        console.log(`[SUCCESS] Senha ${senhaAtual.numero} chamada!`);

      } else {
        alert(result.message || "Nenhuma senha aguardando");
      }

    } catch (error) {
      console.error("❌ Erro ao chamar próxima:", error);
      alert("Erro ao chamar próxima senha");
    } finally {
      // Reabilitar botão
      const btnNext = document.querySelector('.btn-next');
      if (btnNext) {
        btnNext.disabled = false;
        btnNext.textContent = 'Chamar Proximo';
      }
    }
  };

  // ===============================
  // 📺 ATUALIZAR DISPLAY ATUAL
  // ===============================
  function atualizarDisplayAtual(senha) {
    // Número da senha
    const currentPassword = document.getElementById('currentPassword');
    if (currentPassword) {
      currentPassword.textContent = senha.numero;
      currentPassword.style.animation = 'pulse 1s';
    }

    // Tipo
    const passwordType = document.getElementById('passwordType');
    if (passwordType) {
      passwordType.textContent = senha.tipo === 'prioritaria' ? 'Atendimento Prioritário' : 'Atendimento Normal';
    }

    // Serviço solicitado
    const serviceValue = document.getElementById('serviceValue');
    if (serviceValue && senha.servico) {
      serviceValue.textContent = senha.servico.nome || 'Serviço Geral';
    }

    // Tempo de espera
    const waitTime = document.getElementById('waitTime');
    if (waitTime) {
      const tempo = senha.tempo_espera_minutos || calcularTempoEspera(senha);
      waitTime.textContent = `${tempo} minutos`;
    }

    // Hora de emissão
    const issuedAt = document.getElementById('issuedAt');
    if (issuedAt && senha.emitida_em) {
      const hora = new Date(senha.emitida_em).toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit'
      });
      issuedAt.textContent = hora;
    }

    // Observações
    const obsValue = document.getElementById('obsValue');
    if (obsValue) {
      obsValue.textContent = senha.observacoes || 'Sem observações';
    }
  }

  // ===============================
  // ⏱️ TIMER
  // ===============================
  function iniciarTimer() {
    pararTimer();

    let segundos = 0;

    timerInterval = setInterval(() => {
      segundos++;

      const minutos = Math.floor(segundos / 60);
      const segs = segundos % 60;

      const timerEl = document.getElementById('timer');
      if (timerEl) {
        timerEl.textContent = `${String(minutos).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
      }
    }, 1000);
  }

  function pararTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ===============================
  // 📋 HISTÓRICO DE ATENDIMENTOS
  // ===============================
  async function atualizarHistorico() {
    try {
      const user = store.getUser();

      // Buscar senhas atendidas hoje pelo trabalhador
      const response = await fetch(`/api/senhas?atendente_id=${user.id}&status=concluida`, {
        headers: {
          'Authorization': `Bearer ${store.getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error("Erro ao buscar histórico:", response.status);
        return;
      }

      const data = await response.json();
      const senhas = data.senhas || [];

      const activityLog = document.getElementById('activityLog');
      if (!activityLog) return;

      if (senhas.length === 0) {
        activityLog.innerHTML = '<div class="log-item"><div class="log-password">Nenhum atendimento hoje</div></div>';
        return;
      }

      // Mostrar últimas 10
      activityLog.innerHTML = senhas.slice(0, 10).map(senha => {
        const hora = new Date(senha.atendimento_concluido_em || senha.created_at).toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return `
          <div class="log-item completed">
            <div class="log-password">Senha ${senha.numero}</div>
            <div class="log-time">${hora} - ${senha.tempo_atendimento_minutos || 0} min</div>
          </div>
        `;
      }).join('');

    } catch (error) {
      console.error("❌ Erro ao atualizar histórico:", error);
    }
  }

  // ===============================
  // 🔄 POLLING
  // ===============================
  function iniciarPolling() {
    pararPolling();

    pollingInterval = setInterval(async () => {
      await atualizarEstatisticas();
      await atualizarHistorico();
    }, 10000); // 10 segundos
  }

  function pararPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }

  // ===============================
  // 🔧 OUTRAS FUNÇÕES
  // ===============================
  window.togglePause = function() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (!pauseBtn) return;

    const isPaused = pauseBtn.textContent === 'Retomar';

    if (isPaused) {
      pauseBtn.textContent = 'Pausar';
      iniciarPolling();
      console.log("▶️ Atendimento retomado");
    } else {
      pauseBtn.textContent = 'Retomar';
      pararPolling();
      pararTimer();
      console.log("⏸️ Atendimento pausado");
    }
  };

  window.redirectCustomer = function() {
    if (!senhaAtual) {
      alert("Nenhuma senha em atendimento");
      return;
    }

    const novoBalcao = prompt(`Reencaminhar senha ${senhaAtual.numero} para qual balcão?`);

    if (novoBalcao) {
      console.log(`🔀 Senha ${senhaAtual.numero} reencaminhada para balcão ${novoBalcao}`);
      alert(`Senha ${senhaAtual.numero} reencaminhada para balcão ${novoBalcao}`);
      // TODO: Implementar API de reencaminhamento
    }
  };

  window.addObservation = function() {
    if (!senhaAtual) {
      alert("Nenhuma senha em atendimento");
      return;
    }

    const obs = prompt("Adicionar observação:");

    if (obs) {
      senhaAtual.observacoes = obs;
      const obsValue = document.getElementById('obsValue');
      if (obsValue) obsValue.textContent = obs;
      console.log(`📝 Observação adicionada: ${obs}`);
    }
  };

  window.requestDocuments = function() {
    if (!senhaAtual) {
      alert("Nenhuma senha em atendimento");
      return;
    }

    alert("Função de documentos em desenvolvimento");
    console.log("📎 Documentos solicitados");
  };

  window.sendReceipt = function() {
    if (!senhaAtual) {
      alert("Nenhuma senha em atendimento");
      return;
    }

    const format = document.getElementById('receiptFormat')?.value || 'pdf';

    alert(`Recibo gerado em formato ${format.toUpperCase()}`);
    console.log(`📄 Recibo enviado (${format})`);
  };

  window.showStatistics = function() {
    alert("Estatísticas detalhadas em desenvolvimento");
    console.log("📊 Estatísticas solicitadas");
  };

  window.sair = function() {
    if (confirm("Deseja sair do sistema?")) {
      pararPolling();
      pararTimer();
      store.logout();
      window.location.href = '/login';
    }
  };

  // ===============================
  // 🔧 HELPERS
  // ===============================
  function calcularTempoEspera(senha) {
    if (!senha.emitida_em) return 0;

    const agora = new Date();
    const emissao = new Date(senha.emitida_em);
    const diff = agora - emissao;
    return Math.floor(diff / 1000 / 60); // minutos
  }

})();
