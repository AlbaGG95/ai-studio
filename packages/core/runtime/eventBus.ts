export class RuntimeEventBus<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<(payload: any) => void>>();

  on<K extends keyof Events>(
    event: K,
    handler: (payload: Events[K]) => void
  ): () => void {
    const set = this.listeners.get(event) || new Set();
    set.add(handler as (payload: any) => void);
    this.listeners.set(event, set);
    return () => {
      set.delete(handler as (payload: any) => void);
    };
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      handler(payload);
    }
  }

  clear() {
    this.listeners.clear();
  }
}
