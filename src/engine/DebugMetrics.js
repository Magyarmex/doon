export class DebugMetrics {
  constructor() {
    this.logs = [];
    this.errorCount = 0;
    this.flags = new Map();
    this.counters = new Map();
  }

  log(message, data = {}) {
    const entry = {
      message,
      data,
      timestamp: new Date().toISOString()
    };
    this.logs.push(entry);
    if (this.logs.length > 100) {
      this.logs.shift();
    }
    return entry;
  }

  recordError(error) {
    this.errorCount += 1;
    return this.log(`ERROR: ${error.message || error}`, { stack: error.stack });
  }

  setFlag(name, value, { log = true } = {}) {
    const current = this.flags.get(name);
    this.flags.set(name, value);

    if (log && current !== value) {
      this.log(`Flag ${name} set to ${value}`);
    }
  }

  getFlag(name) {
    return this.flags.get(name);
  }

  incrementCounter(name, amount = 1) {
    const current = this.counters.get(name) ?? 0;
    const next = current + amount;
    this.counters.set(name, next);
    this.log(`Counter ${name} incremented to ${next}`);
    return next;
  }

  getCounter(name) {
    return this.counters.get(name) ?? 0;
  }
}
