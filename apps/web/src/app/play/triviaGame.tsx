"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./play.module.css";
import { createTriviaState, answerQuestion, TriviaQuestion, TriviaState } from "@ai-studio/core";

type TriviaConfig = {
  title: string;
  questions?: TriviaQuestion[] | any[];
};

const FALLBACK_OPTIONS = ["Opción A", "Opción B", "Opción C", "Opción D"];

const FALLBACK_QUESTIONS: TriviaQuestion[] = [
  { id: "q1", prompt: "Capital de Francia", options: ["París", "Lyon", "Madrid", "Roma"], answerIndex: 0 },
  { id: "q2", prompt: "2 + 2", options: ["3", "4", "22", "5"], answerIndex: 1 },
  { id: "q3", prompt: "Color del cielo despejado", options: ["Azul", "Verde", "Rojo", "Amarillo"], answerIndex: 0 },
];

function normalizeTriviaQuestions(raw: any, title: string): TriviaQuestion[] {
  const source = Array.isArray(raw) && raw.length > 0 ? raw : [{ prompt: `${title || "Pregunta"} 1` }];
  return source.map((entry, idx) => {
    const prompt =
      (typeof entry?.prompt === "string" && entry.prompt.trim()) ||
      (typeof entry?.question === "string" && entry.question.trim()) ||
      (typeof entry?.q === "string" && entry.q.trim()) ||
      (typeof entry === "string" && entry.trim()) ||
      `${title || "Pregunta"} ${idx + 1}`;
    const optionSource =
      (Array.isArray(entry?.options) && entry.options) ||
      (Array.isArray(entry?.a) && entry.a) ||
      (Array.isArray(entry?.answers) && entry.answers) ||
      [];
    const mapped =
      optionSource.length > 0
        ? optionSource
            .map((opt: any, optIdx: number) =>
              typeof opt === "string" && opt.trim() ? opt.trim() : `Opción ${String.fromCharCode(65 + optIdx)}`
            )
            .filter(Boolean)
        : [];
    const fallback = FALLBACK_OPTIONS.map((opt) => (prompt ? `${prompt} - ${opt}` : opt));
    const options = mapped.slice(0, 4);
    while (options.length < 4) {
      options.push(fallback[options.length] || fallback[0]);
    }
    const answer =
      typeof entry?.answerIndex === "number"
        ? entry.answerIndex
        : typeof entry?.correctIndex === "number"
        ? entry.correctIndex
        : typeof entry?.correct === "number"
        ? entry.correct
        : typeof entry?.answer === "string"
        ? options.findIndex((opt) => opt.toLowerCase() === entry.answer.toLowerCase())
        : 0;
    const answerIndex = Math.min(Math.max(Number.isFinite(answer) ? answer : 0, 0), Math.max(options.length - 1, 0));
    return {
      id: (typeof entry?.id === "string" && entry.id.trim()) || `q-${idx + 1}`,
      prompt,
      options: Array.isArray(options) ? options : FALLBACK_OPTIONS,
      answerIndex,
    };
  });
}

export function TriviaGame({ config }: { config: TriviaConfig }) {
  const normalized = useMemo(
    () => normalizeTriviaQuestions(config?.questions || [], config.title || "Trivia"),
    [config?.questions, config?.title]
  );
  const initialQuestions = useMemo(
    () => (normalized.length > 0 ? normalized : FALLBACK_QUESTIONS),
    [normalized]
  );
  const [state, setState] = useState<TriviaState>(() => createTriviaState(initialQuestions));

  useEffect(() => {
    setState(createTriviaState(initialQuestions));
  }, [initialQuestions]);

  const current = state.questions[state.currentIndex];
  const total = state.questions.length;
  const options = Array.isArray(current?.options) ? current.options : [];
  const hasOptions = options.length > 0;
  const prompt = typeof current?.prompt === "string" && current.prompt.trim() ? current.prompt : "Pregunta sin texto";
  const hasNext = state.currentIndex + 1 < total;

  const handleAnswer = (idx: number) => {
    setState((prev) => {
      if (prev.finished) return prev;
      const currentQuestion = prev.questions[prev.currentIndex];
      if (!currentQuestion) return { ...prev, finished: true };
      return answerQuestion(prev, idx);
    });
  };

  const restart = () => setState(createTriviaState(initialQuestions));
  const skipQuestion = () =>
    setState((prev) => {
      if (prev.finished) return prev;
      const hasUpcoming = prev.currentIndex + 1 < prev.questions.length;
      if (!hasUpcoming) return { ...prev, finished: true };
      return { ...prev, currentIndex: prev.currentIndex + 1 };
    });

  return (
    <div className={styles.card}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.kicker}>Trivia</p>
          <h2 className={styles.title}>{config.title || "Trivia"}</h2>
          <p className={styles.subtle}>Pregunta {Math.min(state.currentIndex + 1, total)} / {total}</p>
        </div>
        <div className={styles.actions}>
          <button onClick={restart}>Restart</button>
        </div>
      </div>

      {!state.finished && (
        <div className={styles.card}>
          <p className={styles.itemTitle}>{prompt}</p>
          {hasOptions ? (
            <div className={styles.heroGrid}>
              {options.map((opt, idx) => (
                <button
                  key={idx}
                  className={styles.stageNode}
                  onClick={() => handleAnswer(idx)}
                  style={{ padding: "12px", width: "100%" }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.card} style={{ gap: 12 }}>
              <p className={styles.muted}>
                Esta pregunta no tiene opciones. Pulsa &quot;Siguiente&quot; o &quot;Reiniciar&quot;.
              </p>
              <div className={styles.actions} style={{ gap: 8, flexWrap: "wrap" }}>
                {hasNext && <button onClick={skipQuestion}>Siguiente</button>}
                <button onClick={restart}>Reiniciar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {state.finished && (
        <div className={styles.resultOverlay}>
          <h3 className={styles.title}>Resultado</h3>
          <p className={styles.status}>Score: {state.score} / {total}</p>
          <button onClick={restart}>Reintentar</button>
        </div>
      )}
    </div>
  );
}
