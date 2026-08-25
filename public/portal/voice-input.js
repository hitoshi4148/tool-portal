(function (global) {
  const UNSUPPORTED_HINT = "音声入力は PC または Android の Chrome / Edge で使えます";

  function speechRecognitionCtor() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }

  function joinSpoken(prefix, spoken) {
    if (!spoken) return prefix;
    if (!prefix) return spoken;
    if (/\s$/.test(prefix) || /^[、。,.!?\s]/.test(spoken)) return prefix + spoken;
    const glue = /[A-Za-z0-9]$/.test(prefix) ? " " : "";
    return prefix + glue + spoken;
  }

  const sessions = [];

  function isSupported() {
    return Boolean(speechRecognitionCtor());
  }

  function revealUnsupportedHints(root) {
    if (isSupported()) return;
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".voice-unsupported-hint").forEach((el) => {
      el.hidden = false;
      if (!el.textContent.trim()) el.textContent = UNSUPPORTED_HINT;
    });
  }

  function pruneSessions() {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (typeof sessions[i].isDead === "function" && sessions[i].isDead()) {
        sessions[i].stop();
        sessions.splice(i, 1);
      }
    }
  }

  function stopAll() {
    pruneSessions();
    for (const session of sessions) {
      session.stop();
    }
  }

  function bindVoiceField(options) {
    const input = options.input;
    const micBtn = options.micBtn;
    const micStatus = options.micStatus;
    const maxLength = options.maxLength ?? 200;
    if (!input || !micBtn || !micStatus) return null;

    const Ctor = speechRecognitionCtor();
    let recognition = null;
    let wantListen = false;
    let baseText = "";

    pruneSessions();

    function setMicStatus(message, isError = false) {
      if (!message) {
        micStatus.hidden = true;
        micStatus.textContent = "";
        micStatus.classList.remove("error");
        return;
      }
      micStatus.hidden = false;
      micStatus.textContent = message;
      micStatus.classList.toggle("error", isError);
    }

    function setListeningUi(on) {
      micBtn.classList.toggle("listening", on);
      micBtn.setAttribute("aria-pressed", on ? "true" : "false");
      const idleLabel = micBtn.getAttribute("data-mic-label") || "音声入力を開始";
      micBtn.setAttribute("aria-label", on ? "音声入力を終了" : idleLabel);
    }

    function stopListening() {
      wantListen = false;
      setListeningUi(false);
      if (micStatus.textContent.startsWith("聞いています")) setMicStatus("");
      if (recognition) {
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
      }
    }

    const self = { stop: stopListening, isDead: () => !micBtn.isConnected };
    sessions.push(self);

    if (!Ctor) {
      micBtn.addEventListener("click", () => {
        setMicStatus(
          "このブラウザでは音声入力ができません。PC または Android の Chrome / Edge をご利用ください。",
          true
        );
      });
      return { stop: stopListening };
    }

    recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = (event.results[i][0]?.transcript || "").trim();
        if (!piece) continue;
        if (event.results[i].isFinal) {
          baseText = joinSpoken(baseText, piece).slice(0, maxLength);
        } else {
          interimText += piece;
        }
      }
      input.value = joinSpoken(baseText, interimText).slice(0, maxLength);
    };

    recognition.onerror = (event) => {
      const error = event.error;
      if (error === "no-speech" || error === "aborted") return;
      wantListen = false;
      setListeningUi(false);
      if (error === "not-allowed" || error === "service-not-allowed") {
        setMicStatus("マイクの使用が許可されていません。ブラウザの設定を確認してください。", true);
        return;
      }
      if (error === "network") {
        setMicStatus("音声認識に接続できませんでした。通信を確認してください。", true);
        return;
      }
      setMicStatus("音声認識を開始できませんでした。", true);
    };

    recognition.onend = () => {
      if (wantListen) {
        try {
          recognition.start();
        } catch {
          /* start in progress */
        }
        return;
      }
      setListeningUi(false);
      if (micStatus.textContent.startsWith("聞いています")) setMicStatus("");
    };

    micBtn.addEventListener("click", () => {
      if (wantListen) {
        stopListening();
        setMicStatus("");
        input.focus({ preventScroll: true });
        return;
      }
      for (const session of sessions) {
        if (session !== self) session.stop();
      }
      baseText = input.value.trimEnd();
      wantListen = true;
      setListeningUi(true);
      setMicStatus("聞いています… もう一度マイクを押すと終了します。音声はブラウザが文字にします。");
      try {
        recognition.start();
      } catch {
        wantListen = false;
        setListeningUi(false);
        setMicStatus("音声認識を開始できませんでした。", true);
      }
    });

    return { stop: stopListening };
  }

  global.VoiceInput = {
    bindVoiceField,
    stopAll,
    isSupported,
    revealUnsupportedHints,
    unsupportedHint: UNSUPPORTED_HINT,
  };

  function revealOnReady() {
    revealUnsupportedHints();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", revealOnReady);
  } else {
    revealOnReady();
  }
})(window);
