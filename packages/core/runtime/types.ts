export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export interface RuntimeContext<Spec, Events extends Record<string, unknown>> {
  spec: Spec;
  state: StateStore;
  events: EventBus<Events>;
  rng: DeterministicRng;
  clock: RuntimeClock;
  logger: Logger;
}

export interface RuntimeModule<Spec, Events extends Record<string, unknown>> {
  id: string;
  init(ctx: RuntimeContext<Spec, Events>): void;
  start(ctx: RuntimeContext<Spec, Events>): void;
  tick(ctx: RuntimeContext<Spec, Events>, dtMs: number): void;
  stop(ctx: RuntimeContext<Spec, Events>): void;
  dispose(ctx: RuntimeContext<Spec, Events>): void;
}

export interface SliceReducer<State, Action> {
  (state: State, action: Action): State;
}

export interface StateStore {
  registerSlice<State, Action>(
    name: string,
    initialState: State,
    reducer: SliceReducer<State, Action>
  ): void;
  getSlice<State>(name: string): State;
  dispatch<Action>(name: string, action: Action): void;
  snapshot(): Record<string, unknown>;
}

export interface EventBus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void;
  emit<K extends keyof Events>(event: K, payload: Events[K]): void;
  clear(): void;
}

export interface DeterministicRng {
  next(): number;
  int(min: number, max: number): number;
}

export interface RuntimeClock {
  now(): number;
  advance(dtMs: number): void;
}
