import { connectVoice } from "./sprache.mjs";
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
  correct: "Richtig gerechnet! Du bekommst einen Stern.",
  hint: "Tipp:",
  solution: "So kannst du rechnen.",
};

let story;
let position = 0;
const voice = connectVoice(form, answer, () => {
  audio.pause();
  video.pause();
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
  audio.pause();
});
audio.addEventListener("play", () => {
  voice.cancel();
  video.pause();
});

function renderAnswer() {
  const task = story.szenen[position].aufgabe;
  const result = states.get(position)?.feedback;
  form.hidden = !task || Boolean(result?.advance);
  next.hidden = Boolean(task && !result?.advance);
  feedback.dataset.kind = result?.kind ?? "";
  feedback.textContent = result?.text ?? "";
}

function showScene() {
  voice.reset();
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
}

function showFinish() {
  voice.reset();
  renderMedia();
  sceneBody.hidden = true;
  finish.hidden = false;
  progress.textContent = "Geschafft!";
  const total = [...states.values()].reduce((sum, state) => sum + state.stars, 0);
  const result = `Du hast ${total} ${total === 1 ? "Stern" : "Sterne"} gesammelt.`;
  byId("story-result").textContent = [story.abschluss, result].filter(Boolean).join(" ");
  title.focus({ preventScroll: true });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const scene = story.szenen[position];
  if (!scene.aufgabe || form.hidden) return;
  voice.reset();
  const current = states.get(position) ?? initialRound();
  const updated = evaluateAnswer(current, { ...scene.aufgabe, op: "×" }, answer.value, feedbackCopy);
  states.set(position, updated);
  answer.value = "";
  renderAnswer();
  if (updated.feedback.advance) next.focus();
  else answer.focus();
});

previous.addEventListener("click", () => {
  if (position === 0) return;
  position--;
  showScene();
});

next.addEventListener("click", () => {
  if (next.hidden) return;
  position++;
  if (position === story.szenen.length) showFinish();
  else showScene();
});

byId("story-restart").addEventListener("click", () => {
  position = 0;
  states.clear();
  showScene();
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
