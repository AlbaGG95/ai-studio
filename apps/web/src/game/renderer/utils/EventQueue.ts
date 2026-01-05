type ProcessFn<T> = (item: T) => Promise<void> | void;

export class EventQueue<T> {
  private queue: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private paused = false;
  private speed: 1 | 2 = 1;
  private processFn: ProcessFn<T> | null = null;
  private readonly baseDelayMs: number;

  constructor(opts: { baseDelayMs: number }) {
    this.baseDelayMs = Math.max(1, opts.baseDelayMs);
  }

  setSpeed(mult: 1 | 2) {
    this.speed = mult;
  }

  enqueue(items: T[]) {
    this.queue.push(...items);
    this.schedule();
  }

  start(process: ProcessFn<T>) {
    this.processFn = process;
    this.running = true;
    this.paused = false;
    this.schedule();
  }

  pause() {
    this.paused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  resume() {
    this.paused = false;
    this.running = true;
    this.schedule();
  }

  clear() {
    this.queue = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.running = false;
    this.paused = false;
  }

  isRunning() {
    return this.running && !this.paused;
  }

  private schedule() {
    if (!this.running || this.paused || this.timer) return;
    if (!this.queue.length || !this.processFn) return;

    const next = this.queue.shift();
    if (!next) return;

    const delay = Math.max(1, Math.round(this.baseDelayMs / this.speed));
    this.timer = setTimeout(async () => {
      this.timer = null;
      try {
        await this.processFn?.(next);
      } catch {
        // swallow to keep queue moving
      }
      this.schedule();
    }, delay);
  }
}
