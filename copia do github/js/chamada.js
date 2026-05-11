(function () {
  "use strict";

  let audioContext = null;
  let audioEnabled = false;
  let lastCalledKey = "";
  let lastCompletedKey = "";

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function formatClock() {
    return new Date().toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatTime(iso) {
    if (!iso) return "--:--";
    return new Date(iso).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function counterLabel(ticket) {
    if (!ticket) return "Aguardando chamada";
    if (ticket.counterName) return ticket.counterName;
    if (ticket.counterNumber) return `Balcao ${ticket.counterNumber}`;
    return "Balcao";
  }

  function eventKey(event) {
    if (!event) return "";
    return `${event.code || ""}|${event.counterName || ""}|${event.at || ""}`;
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function ensureAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext) audioContext = new AudioCtx();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function beep(frequency, duration, delay) {
    if (!audioEnabled) return;
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const start = ctx.currentTime + (delay || 0);
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  function playCallSound() {
    beep(880, 0.18, 0);
    beep(1174, 0.22, 0.2);
  }

  function playCompletedSound() {
    beep(784, 0.14, 0);
    beep(659, 0.14, 0.16);
    beep(523, 0.24, 0.33);
  }

  function speak(text) {
    if (!audioEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-PT";
    utterance.rate = 0.8;
    utterance.pitch = 0.98;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const portugueseVoices = voices.filter((item) => String(item.lang || "").toLowerCase().startsWith("pt"));
    const voice = portugueseVoices.find((item) => /francisca|maria|helia|joana|luciana|ines|natural/i.test(item.name))
      || portugueseVoices.find((item) => /google|microsoft/i.test(item.name))
      || portugueseVoices.find((item) => String(item.lang || "").toLowerCase() === "pt-pt")
      || portugueseVoices[0];
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  }

  function speechCounterLabel(ticket) {
    return counterLabel(ticket)
      .replace(/\s+-\s+/g, ", ")
      .replace(/\bBalcao\b/g, "Balcão")
      .replace(/\bSecretaria Academica\b/g, "Secretaria Académica")
      .replace(/\bContabilidade\b/g, "Contabilidade")
      .replace(/\bApoio ao Cliente\b/g, "Apoio ao Cliente");
  }

  function speechCounterNumber(ticket) {
    const names = {
      1: "um",
      2: "dois",
      3: "três",
      4: "quatro",
      5: "cinco",
      6: "seis",
      7: "sete",
      8: "oito",
      9: "nove"
    };

    const number = Number(ticket && ticket.counterNumber);
    return names[number] || String(ticket && ticket.counterNumber || "");
  }

  function speechTicketCode(code) {
    return String(code || "")
      .trim()
      .toUpperCase()
      .split("")
      .join(", ");
  }

  function buildCallText(ticket) {
    if (!ticket) return "";
    const counter = ticket.counterNumber
      ? `Balcão ${speechCounterNumber(ticket)}`
      : speechCounterLabel(ticket);
    const code = speechTicketCode(ticket.code);
    return `Atenção por favor, senha número ${code}, pode dirigir-se ao ${counter}`;
  }

  function announceCall(ticket) {
    if (!ticket) return;
    playCallSound();
    window.setTimeout(() => speak(buildCallText(ticket)), 620);
  }

  function renderServing(queue) {
    const serving = queue
      .filter((item) => item.status === "em_atendimento")
      .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime());

    if (!els.servingList) return;
    els.servingList.innerHTML = "";

    if (!serving.length) {
      els.servingList.innerHTML = '<p class="empty">Nenhuma senha em atendimento.</p>';
      return;
    }

    serving.slice(0, 5).forEach((ticket) => {
      const item = document.createElement("article");
      item.className = "serving-item";
      item.innerHTML = `
        <strong>${ticket.code}</strong>
        <span>${counterLabel(ticket)}</span>
      `;
      els.servingList.appendChild(item);
    });
  }

  function renderHistory(snapshot) {
    if (!els.recentCalls) return;
    els.recentCalls.innerHTML = "";

    const calledFromQueue = snapshot.queue
      .filter((item) => item.calledAt)
      .map((item) => ({
        code: item.code,
        counterName: counterLabel(item),
        at: item.calledAt
      }));

    const calledFromHistory = snapshot.history
      .filter((item) => item.calledAt)
      .map((item) => ({
        code: item.code,
        counterName: counterLabel(item),
        at: item.calledAt
      }));

    [...calledFromQueue, ...calledFromHistory]
      .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
      .slice(0, 8)
      .forEach((ticket) => {
        const item = document.createElement("article");
        item.className = "history-item";
        item.innerHTML = `
          <strong>${ticket.code}</strong>
          <span>${ticket.counterName} - ${formatTime(ticket.at)}</span>
        `;
        els.recentCalls.appendChild(item);
      });

    if (!els.recentCalls.children.length) {
      els.recentCalls.innerHTML = '<p class="empty">Ainda nao ha chamadas.</p>';
    }
  }

  function getVisibleCall(snapshot) {
    const last = snapshot.lastCalled;
    if (!last) return null;

    return snapshot.queue.find((item) => (
      item.status === "em_atendimento"
      && item.code === last.code
      && (!last.attendedBy || item.attendedBy === last.attendedBy)
    )) || null;
  }

  function renderScreen(snapshot) {
    const last = getVisibleCall(snapshot);
    setText(els.calledCode, last ? last.code : "---");
    setText(els.calledCounter, counterLabel(last));
    setText(els.calledService, last ? `${last.service || "Atendimento"} - chamado as ${formatTime(last.calledAt)}` : "Quando uma senha for chamada, ela aparecera aqui.");
    setText(els.waitingTotal, String(snapshot.queue.filter((item) => item.status === "aguardando").length));
    setText(els.servedTotal, String(snapshot.history.length));

    renderServing(snapshot.queue);
    renderHistory(snapshot);
  }

  function refreshFromStore(shouldAnnounce) {
    const snapshot = window.IMTSBStore.getSnapshot();
    const calledKey = eventKey(snapshot.lastCalled);
    const completedKey = eventKey(snapshot.lastCompleted);

    renderScreen(snapshot);

    if (shouldAnnounce && calledKey && calledKey !== lastCalledKey) {
      if (els.mainCall) {
        els.mainCall.classList.remove("pulse-call");
        void els.mainCall.offsetWidth;
        els.mainCall.classList.add("pulse-call");
      }
      announceCall(snapshot.lastCalled);
    }

    if (shouldAnnounce && completedKey && completedKey !== lastCompletedKey) {
      playCompletedSound();
    }

    lastCalledKey = calledKey;
    lastCompletedKey = completedKey;
  }

  function enableAudio() {
    audioEnabled = true;
    ensureAudioContext();
    playCallSound();
    if (els.enableAudioBtn) els.enableAudioBtn.textContent = "Som ativo";
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.IMTSBStore) return;

    els.screenClock = $("screenClock");
    els.calledCode = $("calledCode");
    els.calledCounter = $("calledCounter");
    els.calledService = $("calledService");
    els.enableAudioBtn = $("enableAudioBtn");
    els.repeatCallBtn = $("repeatCallBtn");
    els.servingList = $("servingList");
    els.waitingTotal = $("waitingTotal");
    els.servedTotal = $("servedTotal");
    els.recentCalls = $("recentCalls");
    els.mainCall = document.querySelector(".main-call");

    setText(els.screenClock, formatClock());
    setInterval(() => setText(els.screenClock, formatClock()), 1000);

    refreshFromStore(false);
    window.IMTSBStore.onChange(() => refreshFromStore(true));

    if (els.enableAudioBtn) {
      els.enableAudioBtn.addEventListener("click", enableAudio);
    }

    if (els.repeatCallBtn) {
      els.repeatCallBtn.addEventListener("click", () => {
        const snapshot = window.IMTSBStore.getSnapshot();
        const last = getVisibleCall(snapshot);
        if (!last) return;
        enableAudio();
        announceCall(last);
      });
    }
  });
})();
