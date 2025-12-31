import { TriviaQuestion, TriviaState } from "./types.js";

export function createTriviaState(questions: TriviaQuestion[], timerSeconds?: number): TriviaState {
  return {
    currentIndex: 0,
    score: 0,
    finished: false,
    questions,
    timerSeconds,
  };
}

export function answerQuestion(state: TriviaState, optionIndex: number): TriviaState {
  if (state.finished) return state;
  const current = state.questions[state.currentIndex];
  const isCorrect = optionIndex === current.answerIndex;
  const nextScore = state.score + (isCorrect ? 1 : 0);
  const nextIndex = state.currentIndex + 1;
  const finished = nextIndex >= state.questions.length;
  return {
    ...state,
    currentIndex: nextIndex,
    score: nextScore,
    finished,
  };
}
