export interface TriviaQuestion {
  id: string;
  prompt: string;
  options: string[];
  answerIndex: number;
}

export interface TriviaState {
  currentIndex: number;
  score: number;
  finished: boolean;
  questions: TriviaQuestion[];
  timerSeconds?: number;
}
