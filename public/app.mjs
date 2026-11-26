import { connectVoice, narrationText } from "./sprache.mjs";
import { createNarrator } from "./vorlesen.mjs";
import { chapterIndex, evaluateAnswer, initialRound, nextRound } from "./spiel.mjs";

const byId = (id) => document.getElementById(id);
const intro = byId("intro");
const game = byId("game");
const finish = byId("finish");
const start = byId("start");
const sound = byId("sound");
const replayAudio = byId("replay-audio");
const form = byId("answer-form");
const answer = byId("answer");
const advance = byId("continue");
const chapterVideo = byId("chapter-video");
const gameFallbackImg = byId("game-fallback-img");
const finishVideo = byId("finish-video");
const finishFallbackImg = byId("finish-fallback-img");
const stops = [...document.querySelectorAll(".stops li")];

let tasks;
let story;
let round = initialRound();
let audio;
let soundEnabled = false;
let soundPreferenceChosen = false;
let lastSpokenParts = [];
let currentChapterVideoSrc = "";
const narrator = createNarrator(window.speechSynthesis, window.SpeechSynthesisUtterance, (speaking) => {
  replayAudio.classList.toggle("speaking", speaking);
});
const voice = connectVoice(form, answer, {
  stopPlayback: stopSpeech,
  isReady: () => !game.hidden && !form.hidden && !narrator.isPlaying() && !answer.value,
});

function updateSoundUI() {
  sound.setAttribute("aria-pressed", String(soundEnabled));
  sound.textContent = soundEnabled ? "🔊 Ton an" : "🔇 Ton aus";
  replayAudio.hidden = !soundEnabled || !lastSpokenParts.length || !("speechSynthesis" in window);
}

async function enableSound() {
  if (soundEnabled) return;
  const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
  if (AudioCtx) {
    try {
      audio ??= new AudioCtx();
      if (audio.state !== "running") await audio.resume();
    } catch {
      // Fallback falls blockiert
    }
  }
  soundEnabled = true;
  updateSoundUI();
}

function stopSpeech() {
  narrator.stop();
}

function speak(content, after = () => {}, delay = 0) {
  lastSpokenParts = (Array.isArray(content) ? content : [content]).filter(Boolean).map(narrationText);
  updateSoundUI();
  if (!soundEnabled) {
    after();
    return;
  }
  voice.cancel();
  narrator.play(lastSpokenParts, after, delay);
}

function playToneSequence(notes, type = "sine", volume = 0.085) {
  if (!soundEnabled || !audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (const [index, [frequency, duration, delay]] of notes.entries()) {
    const time = now + (delay ?? index * 0.1);
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
  }
}

function playEffect(kind) {
  if (kind === "correct") {
    playToneSequence([
      [523.25, 0.25, 0],
      [659.25, 0.25, 0.095],
      [783.99, 0.35, 0.19],
    ]);
  } else if (kind === "hint" || kind === "solution") {
    playToneSequence([
      [440.0, 0.22, 0],
      [392.0, 0.3, 0.14],
    ], "triangle", 0.06);
  } else if (kind === "retry") {
    playToneSequence([[330.0, 0.18, 0]], "sine", 0.05);
  } else if (kind === "finale") {
    playToneSequence([
      [523.25, 0.22, 0],
      [659.25, 0.22, 0.11],
      [783.99, 0.22, 0.22],
      [1046.5, 0.55, 0.33],
    ]);
  }
}

function setStageMedia(videoEl, fallbackImgEl, src) {
  if (!src || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    videoEl.hidden = true;
    videoEl.pause();
    fallbackImgEl.hidden = false;
    return;
  }

  videoEl.onerror = () => {
    videoEl.hidden = true;
    fallbackImgEl.hidden = false;
  };

  videoEl.onloadeddata = () => {
    if (videoEl.parentElement.closest("[hidden]")) return;
    fallbackImgEl.hidden = true;
    videoEl.hidden = false;
    videoEl.play().catch(() => {
      if (videoEl.getAttribute("src") !== src) return;
      videoEl.hidden = true;
      fallbackImgEl.hidden = false;
    });
  };

  if (videoEl.getAttribute("src") !== src) {
    fallbackImgEl.hidden = false;
    videoEl.hidden = true;
    videoEl.src = src;
    videoEl.load();
  } else if (!videoEl.hidden) {
    videoEl.play().catch(() => {});
  }
}

function setRoute(current, complete = false) {
  for (const [index, stop] of stops.entries()) {
    if (index === current) stop.setAttribute("aria-current", "step");
    else stop.removeAttribute("aria-current");
  }
  byId("route-summary").textContent = complete ? "Alle Stationen geschafft!" :
    current < 0 ? `${stops.length} Stationen · ${tasks.length} Aufgaben` :
    `Station ${current + 1} von ${stops.length}`;
}

function starCount(number) {
  return `${number} ${number === 1 ? "Stern" : "Sterne"}`;
}

function showQuestion() {
  voice.reset();
  const task = tasks[round.position];
  const chapter = chapterIndex(story.kapitel, round.position);
  const place = story.kapitel[chapter];
  const sceneText = round.position === place.ab
    ? `${place.auftakt} ${task.szene}`
    : task.szene;

  byId("chapter").textContent = place.titel;
  byId("question-number").textContent = `Aufgabe ${round.position + 1} von ${tasks.length}`;
  byId("scene").textContent = `${sceneText} ${task.frage}`;
  byId("equation").textContent = `${task.a} ${task.op} ${task.b} = ?`;
  byId("stars").textContent = starCount(round.stars);
  game.dataset.chapter = chapter;
  setRoute(chapter);
  renderFeedback();

  if (currentChapterVideoSrc !== place.video) {
    currentChapterVideoSrc = place.video ?? "";
    setStageMedia(chapterVideo, gameFallbackImg, currentChapterVideoSrc);
  }

  speak([sceneText, task.frage], voice.startAutomatic);
  byId("chapter").focus({ preventScroll: true });
}

function renderFeedback() {
  const result = round.feedback;
  const feedback = byId("feedback");
  feedback.dataset.kind = result?.kind ?? "";
  feedback.textContent = round.spokenAnswer ? `${round.spokenAnswer} erkannt. ${result.text}` : result?.text ?? "";
  byId("stars").textContent = starCount(round.stars);
  form.hidden = Boolean(result?.advance);
  advance.hidden = !result?.advance;
  advance.textContent = round.position === tasks.length - 1 ? "Licht einschalten ✦" : "Weiter →";
}

async function begin() {
  if (!tasks || !story) return;
  if (!soundPreferenceChosen) await enableSound();
  finishVideo.pause();
  round = initialRound();
  currentChapterVideoSrc = "";
  answer.value = "";
  intro.hidden = true;
  finish.hidden = true;
  game.hidden = false;
  showQuestion();
  window.scrollTo(0, 0);
}

start.addEventListener("click", begin);
byId("restart").addEventListener("click", begin);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  voice.reset();
  const next = evaluateAnswer(round, tasks[round.position], answer.value);
  if (next === round) return;
  round = { ...next, spokenAnswer: form.dataset.spokenAnswer };
  delete form.dataset.spokenAnswer;
  playEffect(round.feedback.kind);
  speak(round.feedback.text, undefined, 480);
  answer.value = "";
  renderFeedback();
  if (round.feedback.advance) advance.focus();
  else answer.focus();
});

advance.addEventListener("click", () => {
  const next = nextRound(round);
  if (next === round) return;
  round = next;
  answer.value = "";
  if (round.position < tasks.length) {
    showQuestion();
  } else {
    game.hidden = true;
    chapterVideo.pause();
    finish.hidden = false;
    byId("final-stars").textContent = `✦ ${starCount(round.stars)} gesammelt`;
    byId("ending").textContent = story.ende;
    setRoute(-1, true);
    setStageMedia(finishVideo, finishFallbackImg, story.finale_video);
    playEffect("finale");
    speak(["Das Licht ist zurück!", story.ende], undefined, 840);
    byId("finish-title").focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
});

sound.addEventListener("click", async () => {
  soundPreferenceChosen = true;
  if (!soundEnabled) {
    await enableSound();
    if (lastSpokenParts.length) speak(lastSpokenParts, voice.startAutomatic);
  } else {
    soundEnabled = false;
    stopSpeech();
    updateSoundUI();
    voice.startAutomatic();
  }
});

replayAudio.addEventListener("click", () => {
  if (lastSpokenParts.length) speak(lastSpokenParts, voice.startAutomatic);
});

if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

async function readContent(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Spieldaten konnten nicht geladen werden.");
  return response.json();
}

try {
  [tasks, story] = await Promise.all([
    readContent("./aufgaben.json"),
    readContent("./geschichte.json"),
  ]);
  byId("intro-text").textContent = story.start;
  setRoute(-1);
  start.disabled = false;
} catch (error) {
  byId("load-note").textContent = "Das Abenteuer konnte nicht geladen werden. Lade die Seite neu.";
  console.error(error);
}
