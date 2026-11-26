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

const numberNames = new Map([...words].map(([word, number]) => [number, word]));
numberNames.set(1, "eins");
numberNames.set(100, "hundert");

export function narrationText(text) {
  return text.replace(/\b\d+\b/g, (digits) => numberNames.get(Number(digits)) ?? digits)
    .replaceAll(" + ", " plus ")
    .replaceAll(" − ", " minus ")
    .replaceAll(" × ", " mal ")
    .replaceAll(" = ", " ergibt ");
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
  "no-speech": "Ich habe dich gerade nicht gehört. Sag deine Zahl noch einmal oder tippe sie ein.",
  "network": "Die Spracherkennung ist gerade nicht erreichbar. Du kannst deine Antwort eintippen.",
};

export function voiceCommand(text) {
  const phrase = text.toLocaleLowerCase("de-DE").replace(/[^a-zäöüß\d ]/g, "").trim().replace(/ +/g, " ");
  const commands = {
    leuchtturm: ["leuchtturm", "sternleuchtturm", "sternenleuchtturm", "mika", "plus und minus", "eins", "1"],
    einmaleins: ["einmaleins", "kleines einmaleins", "fino", "fino und pip", "pip", "pip will nach hause", "zwei", "2"],
    start: ["start", "starten", "los", "los gehts", "abenteuer starten"],
    next: ["weiter", "nächste", "nächste aufgabe", "nächste szene", "licht einschalten", "geschichte abschließen"],
    repeat: ["nochmal", "noch mal", "noch einmal", "wiederholen", "vorlesen", "abspielen"],
    unknown: ["weiß nicht", "ich weiß nicht", "keine ahnung"],
    back: ["zurück", "vorherige szene"],
    menu: ["auswahl", "zur auswahl", "menü", "hauptmenü", "zur lernpfadauswahl", "startseite"],
    mute: ["ton aus", "leise"],
    unmute: ["ton an"],
    restart: ["neustart", "noch einmal spielen", "von vorne"],
  };
  return Object.keys(commands).find((command) => commands[command].includes(phrase));
}

export function connectRecognition({ button, status, note, automaticButton, isReady, stopPlayback, handle, prompt }) {
  const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const idleLabel = button.textContent.trim();
  const storedSetting = "lernprojektor:sprachsteuerung";
  let active = null;
  let automatic = false;

  function finish(session) {
    if (active !== session) return false;
    active = null;
    clearTimeout(session.timeout);
    button.textContent = idleLabel;
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
    status.textContent = "Spracheingabe ist in diesem Browser nicht verfügbar.";
    return { cancel, reset, startAutomatic() {}, startManual() {} };
  }
  button.hidden = false;
  note.hidden = false;

  function start(automaticStart = false) {
    if (active) return;
    if (!automaticStart) stopPlayback();
    const recognition = new Recognition();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.continuous = false;
    const session = { recognition };
    active = session;
    button.textContent = "Aufnahme abbrechen";
    button.setAttribute("aria-pressed", "true");
    status.textContent = "Mikrofon wird gestartet …";
    recognition.onaudiostart = () => {
      if (active === session) status.textContent = prompt();
    };

    recognition.onresult = (event) => {
      if (active === session) session.transcript = event.results[event.resultIndex][0].transcript;
    };
    recognition.onerror = (event) => {
      if (!finish(session)) return;
      if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
        setAutomatic(false);
      }
      status.textContent = messages[event.error] ?? "Die Spracherkennung ist gerade nicht verfügbar.";
    };
    const noSpeech = () => { status.textContent = "Ich habe dich nicht gehört. Du kannst das Mikrofon erneut starten."; };
    recognition.onend = () => {
      if (!finish(session)) return;
      if (!session.transcript) {
        noSpeech();
        return;
      }
      status.textContent = "";
      if (!handle(session.transcript)) {
        status.textContent = "Das habe ich nicht verstanden. Versuch es noch einmal.";
      }
    };

    try {
      session.timeout = setTimeout(() => {
        if (!finish(session)) return;
        recognition.abort();
        noSpeech();
      }, 12000);
      recognition.start();
    } catch {
      finish(session);
      if (automaticStart) setAutomatic(false);
      status.textContent = "Die Spracheingabe konnte nicht starten. Versuche es über das Mikrofonsymbol.";
    }
  }

  function setAutomatic(enabled) {
    automatic = enabled;
    try { sessionStorage.setItem(storedSetting, String(enabled)); } catch { /* Browser-Speicher ist optional. */ }
    automaticButton.setAttribute("aria-pressed", String(enabled));
    automaticButton.textContent = enabled ? "Sprachsteuerung aus" : "Sprachsteuerung an";
  }

  function startAutomatic() {
    if (automatic && isReady()) start(true);
  }

  automaticButton.hidden = false;
  try { automatic = sessionStorage.getItem(storedSetting) === "true"; } catch { /* Browser-Speicher ist optional. */ }
  setAutomatic(automatic);
  automaticButton.addEventListener("click", () => {
    setAutomatic(!automatic);
    if (automatic) startAutomatic();
    else cancel();
  });
  const startManual = () => {
    if (active) cancel();
    else start();
  };
  button.addEventListener("click", startManual);
  window.addEventListener("pagehide", reset);
  return { cancel, reset, startAutomatic, startManual };
}

export function connectVoice(form, input, { stopPlayback, isReady, command }) {
  const voice = connectRecognition({
    button: document.querySelector(".voice-button"),
    status: document.querySelector(".voice-status"),
    note: document.querySelector(".voice-note"),
    automaticButton: document.querySelector("[data-automatic-voice]"),
    stopPlayback,
    isReady,
    prompt: () => form.hidden ? "Ich höre zu. Sag zum Beispiel „Weiter“ oder „Auswahl“." :
      "Ich höre zu. Sag deine Antwort oder einen Befehl.",
    handle(transcript) {
      const value = spokenNumber(transcript);
      if (value !== null && !form.hidden) {
        input.value = String(value);
        form.dataset.spokenAnswer = String(value);
        form.requestSubmit();
        return true;
      }
      return command(voiceCommand(transcript));
    },
  });
  input.addEventListener("input", voice.reset);
  return voice;
}

export function registerActionKey(action) {
  document.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key) || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
        event.target.closest("button, a, textarea, select, audio, video, [contenteditable]") ||
        (event.target.matches("input") && (event.target.inputMode !== "numeric" || event.target.value))) return;
    event.preventDefault();
    action();
  });
}
