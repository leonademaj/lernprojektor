import { connectVoice, narrationText, registerActionKey } from "./sprache.mjs";
import { createNarrator } from "./vorlesen.mjs";
import { evaluateAnswer, initialRound } from "./spiel.mjs";

const byId = (id) => document.getElementById(id);
const title = byId("story-title");
const progress = byId("scene-progress");
const sceneBody = byId("scene-body");
const sceneTitle = byId("scene-title");
const sceneText = byId("scene-text");
const image = byId("scene-image");
const video = byId("scene-video");
const audio = byId("scene-audio");
const placeholder = byId("media-placeholder");
const mediaNote = byId("media-note");
const form = byId("story-answer");
const answer = byId("story-number");
const feedback = byId("story-feedback");
const previous = byId("previous-scene");
const next = byId("next-scene");
const finish = byId("story-finish");
const states = new Map();
const feedbackCopy = {
  correct: "Genau, das stimmt! Dafür bekommst du einen Stern.",
  hint: "Probier’s mal so:",
  solution: "Ich zeig dir, wie du rechnen kannst.",
};

let story;
let position = 0;
let advanceTimer;
const narrator = createNarrator(window.speechSynthesis, window.SpeechSynthesisUtterance, () => {});
function narrationMedia() {
  if (!video.hidden) return video;
  return audio.hidden ? null : audio;
}

function playNarration(media) {
  if (!media) return false;
  media.currentTime = 0;
  media.play().catch(voice.startAutomatic);
  return true;
}

function handleCommand(command) {
  if (command === "menu") {
    window.location.assign("./");
  } else if (!finish.hidden && ["restart", "start", "repeat"].includes(command)) {
    restart();
  } else if (command === "next" && !sceneBody.hidden && !next.hidden) {
    goNext();
  } else if (command === "back" && !sceneBody.hidden && position > 0) {
    goBack();
  } else if (!sceneBody.hidden && (command === "repeat" || command === "start")) {
    if (!playNarration(narrationMedia())) {
      const scene = story.szenen[position];
      narrator.play([narrationText(scene.text || scene.titel)], voice.startAutomatic);
    }
  } else {
    return false;
  }
  return true;
}
const voice = connectVoice(form, answer, {
  stopPlayback: () => {
    narrator.stop();
    audio.pause();
    video.pause();
  },
  isReady: () => {
    return Boolean(story) && !narrator.isPlaying() && !answer.value && (audio.hidden || audio.paused) && (video.hidden || video.paused) &&
      !advanceTimer;
  },
  command: handleCommand,
});

function setMedia(element, source) {
  if (element === audio || element === video) element.pause();
  if (source) element.src = source;
  else element.removeAttribute("src");
  element.hidden = !source;
  if (element === audio || element === video) element.load();
}

function renderMedia(scene = {}) {
  mediaNote.textContent = "";
  image.alt = scene.bildAlt ?? "";
  setMedia(image, scene.bild);
  setMedia(video, scene.video);
  setMedia(audio, scene.audio);
  image.hidden = !scene.bild || Boolean(scene.video);
  placeholder.hidden = Boolean(scene.bild || scene.video);
}

function mediaFailed(element, message) {
  if (!element.getAttribute("src") || element.hidden) return;
  element.hidden = true;
  if (element === video) image.hidden = !image.getAttribute("src");
  placeholder.hidden = !video.hidden || !image.hidden;
  mediaNote.textContent = [mediaNote.textContent, message].filter(Boolean).join(" ");
  voice.startAutomatic();
}

image.addEventListener("error", () => {
  if (image.getAttribute("src")) {
    image.removeAttribute("src");
    image.hidden = true;
    placeholder.hidden = !video.hidden;
  }
});
video.addEventListener("error", () => mediaFailed(video, "Das Video ist gerade nicht verfügbar."));
audio.addEventListener("error", () => mediaFailed(audio, "Die Tonspur ist gerade nicht verfügbar."));
video.addEventListener("play", () => {
  voice.cancel();
  narrator.stop();
  audio.pause();
});
audio.addEventListener("play", () => {
  voice.cancel();
  narrator.stop();
  video.pause();
});

video.addEventListener("ended", voice.startAutomatic);
audio.addEventListener("ended", voice.startAutomatic);

function renderAnswer() {
  const task = story.szenen[position].aufgabe;
  const state = states.get(position);
  const result = state?.feedback;
  form.hidden = !task || Boolean(result?.advance);
  next.hidden = Boolean(task && !result?.advance);
  feedback.dataset.kind = result?.kind ?? "";
  feedback.textContent = state?.spokenAnswer ? `${state.spokenAnswer} erkannt. ${result.text}` : result?.text ?? "";
}

function showScene() {
  clearTimeout(advanceTimer);
  advanceTimer = undefined;
  voice.reset();
  narrator.stop();
  const scene = story.szenen[position];
  finish.hidden = true;
  sceneBody.hidden = false;
  progress.textContent = `Szene ${position + 1} von ${story.szenen.length}`;
  sceneTitle.textContent = scene.titel;
  sceneText.textContent = scene.text ?? "";
  answer.value = "";
  previous.hidden = position === 0;
  next.textContent = position + 1 === story.szenen.length ? "Geschichte abschließen ✦" : "Weiter →";
  renderMedia(scene);
  renderAnswer();
  sceneTitle.focus({ preventScroll: true });
  voice.startAutomatic();
}

function showFinish() {
  clearTimeout(advanceTimer);
  advanceTimer = undefined;
  voice.reset();
  narrator.stop();
  renderMedia();
  sceneBody.hidden = true;
  finish.hidden = false;
  progress.textContent = "Geschafft!";
  const total = [...states.values()].reduce((sum, state) => sum + state.stars, 0);
  const result = `Du hast ${total} ${total === 1 ? "Stern" : "Sterne"} gesammelt.`;
  byId("story-result").textContent = [story.abschluss, result].filter(Boolean).join(" ");
  title.focus({ preventScroll: true });
  voice.startAutomatic();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const scene = story.szenen[position];
  if (!scene.aufgabe || form.hidden) return;
  voice.reset();
  narrator.stop();
  const current = states.get(position) ?? initialRound();
  const updated = evaluateAnswer(current, { ...scene.aufgabe, op: "×" }, answer.value, feedbackCopy);
  states.set(position, { ...updated, spokenAnswer: form.dataset.spokenAnswer });
  delete form.dataset.spokenAnswer;
  answer.value = "";
  renderAnswer();
  if (updated.feedback.advance) next.focus();
  else answer.focus();
  if (updated.feedback.kind === "correct") {
    const answeredPosition = position;
    advanceTimer = setTimeout(() => { if (position === answeredPosition) goNext(); }, 1100);
  } else {
    voice.startAutomatic();
  }
});

function goBack() {
  if (position === 0) return;
  position--;
  showScene();
}

function goNext() {
  if (next.hidden || sceneBody.hidden) return;
  position++;
  if (position === story.szenen.length) showFinish();
  else showScene();
}

function restart() {
  position = 0;
  states.clear();
  showScene();
}
previous.addEventListener("click", goBack);
next.addEventListener("click", goNext);
byId("story-restart").addEventListener("click", restart);
registerActionKey(() => {
  if (!sceneBody.hidden && !next.hidden) goNext();
  else voice.startManual();
});

const load = byId("story-load");
try {
  const response = await fetch("./einmaleins.json");
  if (!response.ok) throw new Error("Die Datei konnte nicht geladen werden.");
  story = await response.json();
  if (!story.szenen?.length) throw new Error("Die Geschichte enthält noch keine Szenen.");
  title.textContent = story.titel;
  if (story.beispiel) byId("story-label").textContent = "Beispielrunde · Kleines Einmaleins";
  load.hidden = true;
  showScene();
} catch (error) {
  load.textContent = "Die Geschichte konnte nicht geladen werden. Lade die Seite neu.";
  console.error(error);
}
