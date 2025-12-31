"use client";

import { useMemo, useState } from "react";
import styles from "./play.module.css";
import { createTriviaState, answerQuestion, TriviaQuestion, TriviaState } from "@ai-studio/core";

type TriviaConfig = {
  title: string;
  questions?: TriviaQuestion[];
};

const FALLBACK_QUESTIONS: TriviaQuestion[] = [
  { id: "q1", prompt: "Capital de Francia", options: ["París", "Lyon", "Madrid", "Roma"], answerIndex: 0 },
  { id: "q2", prompt: "2 + 2", options: ["3", "4", "22", "5"], answerIndex: 1 },
  { id: "q3", prompt: "Color del cielo despejado", options: ["Azul", "Verde", "Rojo", "Amarillo"], answerIndex: 0 },
];

export function TriviaGame({ config }: { config: TriviaConfig }) {
  const initialQuestions = useMemo(() => config.questions?.length ? config.questions : FALLBACK_QUESTIONS, [config]);
  const [state, setState] = useState<TriviaState>(() => createTriviaState(initialQuestions));

  const current = state.questions[state.currentIndex];
  const total = state.questions.length;

  const handleAnswer = (idx: number) => {
    if (state.finished) return;
    const next = answerQuestion(state, idx);
    setState(next);
  };

  const restart = () => setState(createTriviaState(initialQuestions));

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

      {!state.finished && current && (
        <div className={styles.card}>
          <p className={styles.itemTitle}>{current.prompt}</p>
          <div className={styles.heroGrid}>
            {current.options.map((opt, idx) => (
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
