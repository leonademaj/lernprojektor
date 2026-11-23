export function initialRound() {
  return { position: 0, stars: 0, failures: 0, feedback: null };
}

export function evaluateAnswer(round, task, input) {
  if (round.feedback?.advance) return round;

  const digits = input.trim();
  if (!/^[0-9]{1,3}$/.test(digits) || Number(digits) > 100) {
    const lastHint = round.feedback?.hint ?? "";
    return {
      ...round,
      feedback: {
        kind: "retry",
        text: ["Gib eine ganze Zahl von 0 bis 100 ein.", lastHint].filter(Boolean).join(" "),
        hint: lastHint,
        advance: false,
      },
    };
  }

  const answer = Number(digits);
  const solution = task.op === "+" ? task.a + task.b : task.a - task.b;
  if (answer === solution) {
    return { ...round, stars: round.stars + 1, feedback: {
      kind: "correct", text: "Richtig! Mika gibt dir einen Stern.", advance: true,
    } };
  }

  if (round.failures === 0) {
    const hint = answer === task.extra_hinweis.bei ? task.extra_hinweis.text : task.hinweis;
    return { ...round, failures: 1, feedback: {
      kind: "hint", text: `Mikas Tipp: ${hint}`, hint, advance: false,
    } };
  }

  return { ...round, failures: 2, feedback: {
    kind: "solution", text: `Mika zeigt dir den Rechenweg. ${task.weg}`, advance: true,
  } };
}

export function nextRound(round) {
  if (!round.feedback?.advance) return round;
  return { ...round, position: round.position + 1, failures: 0, feedback: null };
}

export function chapterIndex(chapters, position) {
  return chapters.findLastIndex((chapter) => chapter.ab <= position);
}
