/**
 * REALTIME STORE - FIX CALL NEXT
 * static/js/realtime-store.js
 * 
 * ✅ FIX: callNext retorna { senha } em vez de { data: { senha } }
 */

(function () {
  "use strict";

  const ApiClient = window.ApiClient;
  const apiConfig = window.IMTSBApiConfig || {};

  if (!ApiClient) {
    console.warn("⚠ ApiClient não carregado! Algumas funções ficarão indisponíveis.");
  }

  const IMTSBStore = {
    
    _state: {
      user: null,
      queue: [],
      history: [],
      stats: {
        aguardando: 0,
        concluidas: 0,
        tempo_medio: 0,
        satisfacao: 0
      },
      currentTicket: null,
      lastCall: null
    },

    _listeners: [],

    subscribe(callback) {
      this._listeners.push(callback);
      return () => {
        const index = this._listeners.indexOf(callback);
        if (index > -1) this._listeners.splice(index, 1);
      };
    },

    onChange(callback) {
      return this.subscribe(callback);
    },

    _notify() {
      this._listeners.forEach(fn => fn(this._state));
    },

    getSnapshot() {
      return {
        queue: [...this._state.queue],
        history: [...this._state.history],
        users: [...(this._state.users || [])],
        lastCalled: this._state.lastCall || null,
        stats: { ...this._state.stats },
        updatedAt: this._state.updatedAt || null
      };
    },

    async refreshSnapshot() {
      if (!apiConfig.enabled || !ApiClient?.getSnapshot) {
        return this.getSnapshot();
      }

      try {
        const result = await ApiClient.getSnapshot();
        if (!result.ok) return this.getSnapshot();

        const data = result.data || {};
        this._state.queue = Array.isArray(data.queue) ? data.queue : [];
        this._state.history = Array.isArray(data.history) ? data.history : [];
        this._state.users = Array.isArray(data.users) ? data.users : [];
        this._state.lastCall = data.lastCalled || data.lastCall || null;
        this._state.stats = data.stats || this._state.stats;
        this._state.updatedAt = data.updatedAt || null;
        this._notify();
        return this.getSnapshot();
      } catch (error) {
        console.error("❌ Erro ao atualizar snapshot:", error);
        return this.getSnapshot();
      }
    },

    getUser() {
      const stored = localStorage.getItem("imtsb_user");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
      return this._state.user;
    },

    getCurrentTicket() {
      return this._state.currentTicket;
    },

    async login(email, password) {
      if (!ApiClient?.login) {
        return { ok: false, message: "API indisponível no modo atual" };
      }
      try {
        const result = await ApiClient.login(email, password);

        if (!result.ok) {
          return { ok: false, message: result.message || "Erro no login" };
        }

        const user = {
          id: result.id,
          name: result.name,
          email: result.email,
          role: result.role,
          token: result.token,
          balcao: result.balcao,
          numero_balcao: result.numero_balcao || result.balcao,
          departamento: result.departamento
        };

        this._state.user = user;
        localStorage.setItem("imtsb_user", JSON.stringify(user));

        this._notify();

        return { ok: true, user, role: result.role };

      } catch (error) {
        console.error("❌ Erro no login:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async register(payload) {
      if (!ApiClient?.register) {
        return { ok: false, message: "API indisponível no modo atual" };
      }
      try {
        const result = await ApiClient.register(payload);

        if (!result.ok) {
          return { 
            ok: false, 
            message: result.message || "Erro no cadastro" 
          };
        }

        return { ok: true, data: result.data };

      } catch (error) {
        console.error("❌ Erro no cadastro:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    logout() {
      this._state.user = null;
      this._state.queue = [];
      this._state.history = [];
      this._state.currentTicket = null;

      localStorage.removeItem("imtsb_user");
      localStorage.removeItem("imtsb_access_token");
      localStorage.removeItem("imtsb_refresh_token");

      this._notify();

      window.location.href = "/";
    },

    requireRole(allowedRoles) {
      const user = this.getUser();
      
      if (!user) {
        console.warn("⚠️ Usuário não autenticado");
        return false;
      }

      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
      const hasPermission = roles.includes(user.role);
      
      if (!hasPermission) {
        console.warn(`⚠️ Permissão negada. Necessário: ${roles.join(', ')}, Atual: ${user.role}`);
      }
      
      return hasPermission;
    },

    getToken() {
      const user = this.getUser();
      return user ? user.token : null;
    },

    isAuthenticated() {
      return !!this.getToken();
    },

    isLoggedIn() {
      return this.isAuthenticated();
    },

    async issueTicket(serviceId, tipo = "normal", contato = null) {
      if (!ApiClient?.issueTicket) {
        return { ok: false, message: "API indisponível no modo atual" };
      }
      try {
        const result = await ApiClient.issueTicket({
          servico_id: serviceId,
          tipo: tipo,
          usuario_contato: contato
        });

        if (!result.ok) {
          return { ok: false, message: result.message || "Erro ao emitir senha" };
        }

        this._state.currentTicket = result.ticket;
        await this.refreshSnapshot();
        this._notify();

        return { ok: true, ticket: result.ticket };

      } catch (error) {
        console.error("❌ Erro ao emitir senha:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async refreshQueue(servicoId = null) {
      if (apiConfig.enabled && ApiClient?.getSnapshot) {
        await this.refreshSnapshot();
        return this._state.queue;
      }

      try {
        if (!ApiClient?.getQueue) return [];
        const queue = await ApiClient.getQueue(servicoId);
        this._state.queue = Array.isArray(queue) ? queue : [];
        this._notify();
        return this._state.queue;
      } catch (error) {
        console.error("❌ Erro ao atualizar fila:", error);
        return [];
      }
    },

    async refreshStats() {
      if (apiConfig.enabled && ApiClient?.getSnapshot) {
        await this.refreshSnapshot();
        return this._state.stats;
      }

      try {
        if (!ApiClient?.getStats) return this._state.stats;
        const stats = await ApiClient.getStats();
        this._state.stats = stats;
        this._notify();
        return stats;
      } catch (error) {
        console.error("❌ Erro ao atualizar stats:", error);
        return this._state.stats;
      }
    },

    async callNext(serviceId, balcao) {
      /**
       * ✅ FIX CRÍTICO: Backend retorna { senha } diretamente
       * NÃO retorna { data: { senha } }
       */
      try {
        console.log("\n[CALL NEXT] Chamando próxima senha...");
        console.log("  Serviço ID:", serviceId);
        console.log("  Balcão:", balcao);

        if (!ApiClient?.callNext) {
          return { ok: false, message: "API indisponível no modo atual" };
        }

        const result = await ApiClient.callNext({
          servico_id: serviceId,
          numero_balcao: balcao
        });

        console.log("[CALL NEXT] Resultado:", result);

        const senha = result?.senha || result?.data?.senha;

        if (result.ok && senha) {
          this._state.lastCall = senha;
          await this.refreshQueue(serviceId);
          this._notify();

          console.log("[SUCCESS] Senha chamada:", senha.numero);
          return { ok: true, senha };
        }

        // Se não houver senha
        const message = result?.data?.mensagem || result?.mensagem || result?.message || "Nenhuma senha disponível";
        console.log("[INFO]", message);
        
        return { ok: false, message };

      } catch (error) {
        console.error("❌ Erro ao chamar próxima:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async startAttendance(senhaId, balcao) {
      if (!ApiClient?.startAttendance) {
        return { ok: false, message: "API indisponível no modo atual" };
      }
      try {
        const result = await ApiClient.startAttendance(senhaId, balcao);
        if (result.ok) {
          await this.refreshSnapshot();
          this._notify();
        }
        return result;
      } catch (error) {
        console.error("❌ Erro ao iniciar atendimento:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    async finishAttendance(senhaId, observacoes = "") {
      if (!ApiClient?.finishAttendance) {
        return { ok: false, message: "API indisponível no modo atual" };
      }
      try {
        const result = await ApiClient.finishAttendance(senhaId, observacoes);
        if (result.ok) {
          await this.refreshSnapshot();
          this._notify();
        }
        return result;
      } catch (error) {
        console.error("❌ Erro ao finalizar atendimento:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    },

    _pollingInterval: null,

    startPolling(intervalMs = 5000) {
      this.stopPolling();
      this._pollingInterval = setInterval(async () => {
        if (apiConfig.enabled && ApiClient?.getSnapshot) {
          await this.refreshSnapshot();
        } else {
          await this.refreshQueue();
          await this.refreshStats();
        }
      }, intervalMs);
      console.log("✅ Polling iniciado:", intervalMs + "ms");
    },

    stopPolling() {
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval);
        this._pollingInterval = null;
        console.log("🛑 Polling parado");
      }
    },

    async rateTicket(senhaId, nota, comentario) {
      if (!ApiClient?.rateTicket) {
        return { ok: false, message: "API indisponível no modo atual" };
      }
      try {
        const result = await ApiClient.rateTicket(senhaId, nota, comentario);
        if (result.ok) {
          await this.refreshSnapshot();
          this._notify();
        }
        return result;
      } catch (error) {
        console.error("❌ Erro ao avaliar:", error);
        return { ok: false, message: "Erro de conexão" };
      }
    }
  };

  window.IMTSBStore = IMTSBStore;

  console.log("✅ IMTSBStore carregado (FIX callNext aplicado)");

})();

