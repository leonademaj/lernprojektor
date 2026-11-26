import { connectRecognition, registerActionKey, voiceCommand } from "./sprache.mjs";

const paths = [...document.querySelectorAll(".path-card")];
const voice = connectRecognition({
  button: document.querySelector(".voice-button"),
  status: document.querySelector(".voice-status"),
  note: document.querySelector(".voice-note"),
  automaticButton: document.querySelector("[data-automatic-voice]"),
  isReady: () => true,
  stopPlayback: () => {},
  prompt: () => "Ich höre zu. Sag „Leuchtturm“ oder „Fino“.",
  handle(text) {
    const command = voiceCommand(text);
    if (command !== "leuchtturm" && command !== "einmaleins") return false;
    paths[command === "leuchtturm" ? 0 : 1].click();
    return true;
  },
});
voice.startAutomatic();
registerActionKey(voice.startManual);

document.addEventListener("keydown", (event) => {
  const active = paths.indexOf(document.activeElement);
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) ||
      (active < 0 && document.activeElement !== document.body)) return;
  event.preventDefault();
  const step = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
  const index = active < 0 ? (step === 1 ? 0 : paths.length - 1) : (active + step + paths.length) % paths.length;
  paths[index].focus();
});
