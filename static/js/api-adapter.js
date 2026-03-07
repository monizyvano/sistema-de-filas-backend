/**
 * API ADAPTER - VERSÃO CORRIGIDA
 * static/js/api-adapter.js
 * 
 * ✅ Adaptação backend ↔ frontend
 * ✅ Role mapping correto (atendente → usuario para não-admins)
 * ✅ Transformação de dados
 */

(function () {
  "use strict";

  const ApiAdapter = {
    
    // ===============================
    // 🔐 AUTENTICAÇÃO
    // ===============================
    
    adaptLoginResponse(backendData, email) {
      /**
       * Adapta resposta de login do backend para frontend
       * 
       * Backend retorna:
       * {
       *   access_token: "...",
       *   atendente: {
       *     id: 1,
       *     nome: "João",
       *     email: "joao@...",
       *     tipo: "admin" | "atendente",
       *     balcao: 1 | null
       *   }
       * }
       * 
       * Frontend espera:
       * {
       *   ok: true,
       *   token: "...",
       *   id: 1,
       *   name: "João",
       *   email: "joao@...",
       *   role: "admin" | "trabalhador" | "usuario"
       * }
       */
      
      const atendente = backendData.atendente || {};
      const tipo = atendente.tipo || "atendente";
      const balcao = atendente.balcao;
      
      // ✅ MAPEAMENTO CORRETO DE ROLES
      let role;
      
      if (tipo === "admin") {
        role = "admin";
      } else if (tipo === "atendente" && balcao != null) {
        // Atendente COM balcão → trabalhador
        role = "trabalhador";
      } else {
        // Atendente SEM balcão → usuário comum
        role = "usuario";
      }
      
      return {
        ok: true,
        token: backendData.access_token,
        id: atendente.id,
        name: atendente.nome,
        email: atendente.email || email,
        role: role,
        balcao: balcao
      };
    },
    
    // ===============================
    // 🎫 SENHAS
    // ===============================
    
    adaptIssueTicket(frontendData) {
      /**
       * Adapta dados de emissão de senha frontend → backend
       * 
       * Frontend envia:
       * {
       *   servico_id: 1,
       *   tipo: "normal",
       *   usuario_contato: "923456789"
       * }
       * 
       * Backend espera o mesmo formato
       */
      return {
        servico_id: frontendData.servico_id,
        tipo: frontendData.tipo || "normal",
        usuario_contato: frontendData.usuario_contato || null
      };
    },
    
    adaptTicketResponse(backendSenha) {
      /**
       * Adapta resposta de senha backend → frontend
       * 
       * Backend retorna:
       * {
       *   id: 1,
       *   numero: "N001",
       *   tipo: "normal",
       *   status: "aguardando",
       *   servico_id: 1,
       *   data_emissao: "2026-03-07",
       *   emitida_em: "2026-03-07T14:30:00",
       *   ...
       * }
       */
      return {
        id: backendSenha.id,
        number: backendSenha.numero,
        type: backendSenha.tipo,
        status: backendSenha.status,
        serviceId: backendSenha.servico_id,
        issuedAt: backendSenha.emitida_em,
        calledAt: backendSenha.chamada_em,
        balcao: backendSenha.numero_balcao
      };
    },
    
    // ===============================
    // 👨‍💼 TRABALHADOR
    // ===============================
    
    adaptCallNext(frontendData) {
      /**
       * Adapta dados de "chamar próxima" frontend → backend
       * 
       * Frontend envia:
       * {
       *   servico_id: 1,
       *   numero_balcao: 1
       * }
       * 
       * Backend espera o mesmo formato
       */
      return {
        servico_id: frontendData.servico_id,
        numero_balcao: frontendData.numero_balcao
      };
    },
    
    // ===============================
    // 📊 ESTATÍSTICAS
    // ===============================
    
    adaptStatsResponse(backendStats) {
      /**
       * Adapta estatísticas backend → frontend
       */
      return {
        waiting: backendStats.aguardando || 0,
        serving: backendStats.atendendo || 0,
        completed: backendStats.concluidas || 0,
        cancelled: backendStats.canceladas || 0,
        totalToday: backendStats.total_emitidas || 0,
        avgWaitTime: backendStats.tempo_medio_espera || 0
      };
    },
    
    // ===============================
    // 🔧 HELPERS
    // ===============================
    
    formatDate(isoString) {
      /**
       * Formata data ISO para exibição
       * "2026-03-07T14:30:00" → "07/03/2026 14:30"
       */
      if (!isoString) return "-";
      
      try {
        const date = new Date(isoString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${day}/${month}/${year} ${hours}:${minutes}`;
      } catch {
        return isoString;
      }
    },
    
    formatTime(isoString) {
      /**
       * Formata apenas hora
       * "2026-03-07T14:30:00" → "14:30"
       */
      if (!isoString) return "-";
      
      try {
        const date = new Date(isoString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch {
        return "-";
      }
    },
    
    statusToPortuguese(status) {
      /**
       * Traduz status para português
       */
      const translations = {
        'aguardando': 'Aguardando',
        'chamada': 'Chamada',
        'atendendo': 'Em Atendimento',
        'concluida': 'Concluída',
        'cancelada': 'Cancelada'
      };
      
      return translations[status] || status;
    },
    
    typeToPortuguese(type) {
      /**
       * Traduz tipo para português
       */
      const translations = {
        'normal': 'Normal',
        'prioritaria': 'Prioritária'
      };
      
      return translations[type] || type;
    }
  };

  // ===============================
  // 🌐 EXPORTAR
  // ===============================
  window.ApiAdapter = ApiAdapter;
  
  console.log("✅ ApiAdapter carregado (corrigido)");

})();