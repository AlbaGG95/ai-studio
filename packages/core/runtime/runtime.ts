import { RuntimeEventBus } from "./eventBus.js";
import { RuntimeStateStore } from "./stateStore.js";
import { DeterministicRng } from "./rng.js";
import { RuntimeClock } from "./clock.js";
import type { Logger, RuntimeContext, RuntimeModule } from "./types.js";

export class Runtime<Spec, Events extends Record<string, unknown>> {
  private modules: RuntimeModule<Spec, Events>[] = [];
  private ctx: RuntimeContext<Spec, Events>;

  constructor(spec: Spec, logger: Logger, seed = 1) {
    this.ctx = {
      spec,
      state: new RuntimeStateStore(),
      events: new RuntimeEventBus<Events>(),
      rng: new DeterministicRng(seed),
      clock: new RuntimeClock(),
      logger,
    };
  }

  get context(): RuntimeContext<Spec, Events> {
    return this.ctx;
  }

  register(module: RuntimeModule<Spec, Events>) {
    this.modules.push(module);
  }

  init() {
    for (const module of this.modules) {
      module.init(this.ctx);
    }
  }

  start() {
    for (const module of this.modules) {
      module.start(this.ctx);
    }
  }

  tick(dtMs: number) {
    this.ctx.clock.advance(dtMs);
    for (const module of this.modules) {
      module.tick(this.ctx, dtMs);
    }
  }

  stop() {
    for (const module of this.modules) {
      module.stop(this.ctx);
    }
  }

  dispose() {
    for (const module of this.modules) {
      module.dispose(this.ctx);
    }
  }
}
