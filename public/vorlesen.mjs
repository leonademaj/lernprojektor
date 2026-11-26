export function germanVoice(voices) {
  let selected;
  let best = -1;
  for (const voice of voices) {
    const language = voice.lang.toLowerCase();
    if (!/^de(?:[-_]|$)/.test(language)) continue;
    const name = `${voice.name} ${voice.voiceURI}`;
    const quality = /natural|premium|enhanced|neural|hochwertig|optimiert/i.test(name) ? 8 :
      /google deutsch/i.test(name) ? 6 : 0;
    const score = quality + (/^de[-_]de$/.test(language) ? 3 : 0) + (voice.default ? 1 : 0);
    if (score > best) {
      selected = voice;
      best = score;
    }
  }
  return selected;
}

export function createNarrator(engine, Utterance, onSpeaking) {
  let current;
  let timeout;

  function stop() {
    const wasActive = Boolean(current);
    current = undefined;
    clearTimeout(timeout);
    if (wasActive) engine.cancel();
    onSpeaking(false);
  }

  function play(parts, after, delay = 0) {
    stop();
    if (!engine || !Utterance || !parts.length) {
      after();
      return;
    }

    const session = {};
    current = session;
    const voice = germanVoice(engine.getVoices());
    onSpeaking(true);

    function finish() {
      if (current !== session) return;
      stop();
      after();
    }

    function read(index) {
      if (current !== session) return;
      const utterance = new Utterance(parts[index]);
      utterance.lang = voice?.lang || "de-DE";
      if (voice) utterance.voice = voice;
      utterance.rate = index === 0 && parts.length > 1 ? 0.95 : 0.9;
      utterance.pitch = 1;
      utterance.onend = () => {
        if (current !== session) return;
        clearTimeout(timeout);
        if (index + 1 === parts.length) finish();
        else timeout = setTimeout(() => read(index + 1), 320);
      };
      utterance.onerror = finish;
      timeout = setTimeout(finish, 30000);
      try {
        engine.speak(utterance);
      } catch {
        finish();
      }
    }

    if (delay) timeout = setTimeout(() => read(0), delay);
    else read(0);
  }

  return { play, stop, isPlaying: () => Boolean(current) };
}
