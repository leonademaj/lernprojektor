const ones = "null eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn".split(" ");
const tens = "zwanzig dreißig vierzig fünfzig sechzig siebzig achtzig neunzig".split(" ");
const words = new Map(ones.map((word, number) => [word, number]));
words.set("ein", 1);
words.set("hundert", 100);
words.set("einhundert", 100);
for (const [index, ten] of tens.entries()) {
  const value = (index + 2) * 10;
  words.set(ten, value);
  for (let digit = 1; digit <= 9; digit++) {
    const one = digit === 1 ? "ein" : ones[digit];
    words.set(`${one}und${ten}`, value + digit);
  }
}

export function spokenNumber(transcript) {
  const phrase = transcript.normalize("NFC").toLocaleLowerCase("de-DE").trim()
    .replace(/[.!?]+$/, "")
    .replace(/^(?:(?:die |meine )?(?:lösung|antwort) ist|das (?:sind|ist|ergibt)|es sind|ich (?:denke|glaube))[ ,]+/, "")
    .trim();
  if (/^\d{1,3}$/.test(phrase)) return Number(phrase) <= 100 ? Number(phrase) : null;
  if (!/^[a-zäöüß]+(?:[ -]+[a-zäöüß]+)*$/.test(phrase)) return null;
  return words.get(phrase.replace(/[ -]+/g, "")) ?? null;
}

const messages = {
  "not-allowed": "Das Mikrofon ist gesperrt. Erlaube den Zugriff im Browser oder tippe deine Antwort.",
  "service-not-allowed": "Die Spracherkennung ist im Browser gesperrt. Du kannst deine Antwort eintippen.",
  "audio-capture": "Es wurde kein Mikrofon gefunden. Du kannst deine Antwort eintippen.",
  "no-speech": "Ich habe keine Zahl gehört. Sprich noch einmal oder tippe deine Antwort.",
  "network": "Die Spracherkennung ist gerade nicht erreichbar. Du kannst deine Antwort eintippen.",
};

export function connectVoice(form, input, { stopPlayback, isReady }) {
  const button = form.querySelector(".voice-button");
  const status = form.querySelector(".voice-status");
  const note = form.querySelector(".voice-note");
  const automaticButton = document.querySelector("[data-automatic-voice]");
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  let active = null;
  let automatic = false;

  function finish(session) {
    if (active !== session) return false;
    active = null;
    clearTimeout(session.timeout);
    button.textContent = "🎙 Antwort sprechen";
    button.setAttribute("aria-pressed", "false");
    return true;
  }

  function cancel() {
    if (!active) return;
    const session = active;
    finish(session);
    session.recognition.abort();
    status.textContent = "";
  }

  function reset() {
    cancel();
    if (Recognition) status.textContent = "";
  }

  if (!Recognition) {
    status.textContent = "Spracheingabe ist in diesem Browser nicht verfügbar. Tippe deine Antwort ein.";
    return { cancel, reset, startAutomatic() {} };
  }
  button.hidden = false;
  note.hidden = false;

  function start(automaticStart = false) {
    if (active || form.hidden) return;
    if (!automaticStart) stopPlayback();
    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.continuous = false;
    const session = { recognition, automaticStart };
    active = session;
    button.textContent = "Aufnahme abbrechen";
    button.setAttribute("aria-pressed", "true");
    status.textContent = "Mikrofon wird gestartet …";
    recognition.onaudiostart = () => {
      if (active === session) status.textContent = "Ich höre zu. Sag deine Antwort.";
    };

    recognition.onresult = (event) => {
      if (!finish(session)) return;
      const value = spokenNumber(event.results[event.resultIndex][0].transcript);
      if (form.hidden) return;
      if (value === null) {
        status.textContent = "Ich habe keine eindeutige Zahl verstanden. Versuche es noch einmal.";
        return;
      }
      input.value = String(value);
      form.dataset.spokenAnswer = String(value);
      form.requestSubmit();
    };
    recognition.onerror = (event) => {
      if (!finish(session)) return;
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        setAutomatic(false);
      }
      status.textContent = messages[event.error] ?? "Die Spracherkennung ist gerade nicht verfügbar. Tippe deine Antwort ein.";
    };
    recognition.onend = () => {
      if (!finish(session)) return;
      status.textContent = messages["no-speech"];
    };

    try {
      session.timeout = setTimeout(() => {
        if (!finish(session)) return;
        recognition.abort();
        status.textContent = messages["no-speech"];
      }, 15000);
      recognition.start();
    } catch {
      finish(session);
      if (session.automaticStart) setAutomatic(false);
      status.textContent = "Die Spracheingabe konnte nicht starten. Tippe deine Antwort ein.";
    }
  }

  function setAutomatic(enabled) {
    automatic = enabled;
    automaticButton.setAttribute("aria-pressed", String(enabled));
    automaticButton.textContent = enabled ? "Auto-Mikrofon aus" : "Auto-Mikrofon an";
  }

  function startAutomatic() {
    if (automatic && isReady()) start(true);
  }

  automaticButton.hidden = false;
  automaticButton.addEventListener("click", () => {
    setAutomatic(!automatic);
    if (automatic) startAutomatic();
    else cancel();
  });
  button.addEventListener("click", () => {
    if (active) cancel();
    else start();
  });
  input.addEventListener("input", reset);
  window.addEventListener("pagehide", cancel);
  return { cancel, reset, startAutomatic };
}
