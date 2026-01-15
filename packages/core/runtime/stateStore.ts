import type { SliceReducer, StateStore } from "./types.js";

type SliceEntry<State, Action> = {
  state: State;
  reducer: SliceReducer<State, Action>;
};

export class RuntimeStateStore implements StateStore {
  private slices = new Map<string, SliceEntry<any, any>>();

  registerSlice<State, Action>(
    name: string,
    initialState: State,
    reducer: SliceReducer<State, Action>
  ) {
    if (this.slices.has(name)) {
      throw new Error(`Slice already registered: ${name}`);
    }
    this.slices.set(name, { state: initialState, reducer });
  }

  getSlice<State>(name: string): State {
    const entry = this.slices.get(name);
    if (!entry) {
      throw new Error(`Slice not registered: ${name}`);
    }
    return entry.state as State;
  }

  dispatch<Action>(name: string, action: Action) {
    const entry = this.slices.get(name);
    if (!entry) {
      throw new Error(`Slice not registered: ${name}`);
    }
    entry.state = entry.reducer(entry.state, action);
  }

  snapshot(): Record<string, unknown> {
    const snapshot: Record<string, unknown> = {};
    for (const [key, entry] of this.slices.entries()) {
      snapshot[key] = entry.state;
    }
    return snapshot;
  }
}
