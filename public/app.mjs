import { chapterIndex, evaluateAnswer, initialRound, nextRound } from "./spiel.mjs";

const byId = (id) => document.getElementById(id);
const intro = byId("intro");
const game = byId("game");
const finish = byId("finish");
const start = byId("start");
const sound = byId("sound");
const form = byId("answer-form");
const answer = byId("answer");
const advance = byId("continue");
const stops = [...document.querySelectorAll(".stops li")];
let tasks;
let story;
let round = initialRound();
let audio;
let soundEnabled = false;

function playReward() {
  if (!soundEnabled || !audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (const [index, frequency] of [523.25, 659.25, 783.99].entries()) {
    const time = now + index * 0.095;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.085, time + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.26);
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
  const task = tasks[round.position];
  const chapter = chapterIndex(story.kapitel, round.position);
  const place = story.kapitel[chapter];
  byId("chapter").textContent = place.titel;
  byId("question-number").textContent = `Aufgabe ${round.position + 1} von ${tasks.length}`;
  byId("scene").textContent = round.position === place.ab
    ? `${place.auftakt} ${task.szene}`
    : task.szene;
  byId("equation").textContent = `${task.a} ${task.op} ${task.b} = ?`;
  byId("stars").textContent = starCount(round.stars);
  game.dataset.chapter = chapter;
  setRoute(chapter);
  renderFeedback();
  byId("chapter").focus({ preventScroll: true });
}

function renderFeedback() {
  const result = round.feedback;
  const feedback = byId("feedback");
  feedback.dataset.kind = result?.kind ?? "";
  feedback.textContent = result?.text ?? "";
  byId("stars").textContent = starCount(round.stars);
  form.hidden = Boolean(result?.advance);
  advance.hidden = !result?.advance;
  advance.textContent = round.position === tasks.length - 1 ? "Licht einschalten ✦" : "Weiter →";
}

function begin() {
  if (!tasks || !story) return;
  round = initialRound();
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
  const next = evaluateAnswer(round, tasks[round.position], answer.value);
  if (next === round) return;
  round = next;
  if (round.feedback.kind === "correct") playReward();
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
    finish.hidden = false;
    byId("final-stars").textContent = `✦ ${starCount(round.stars)} gesammelt`;
    byId("ending").textContent = story.ende;
    setRoute(-1, true);
    playReward();
    byId("finish-title").focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
});

const audioSupported = window.AudioContext ?? window.webkitAudioContext;
sound.hidden = !audioSupported;
sound.addEventListener("click", async () => {
  if (!soundEnabled) {
    try {
      audio ??= new audioSupported();
      await audio.resume();
    } catch {
      sound.hidden = true;
      return;
    }
  }
  soundEnabled = !soundEnabled;
  sound.setAttribute("aria-pressed", String(soundEnabled));
  sound.textContent = soundEnabled ? "Ton an" : "Ton aus";
});

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
