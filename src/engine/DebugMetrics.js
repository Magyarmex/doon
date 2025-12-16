export class DebugMetrics {
  constructor({ maxLogs = 250 } = {}) {
    this.maxLogs = maxLogs;
    this.logs = [];
    this.errorCount = 0;
    this.flags = new Map();
    this.counters = new Map();
    this.samples = new Map();
    this.lastError = null;
  }

  log(message, data = {}, level = 'info') {
    const entry = {
      message,
      data,
      level,
      timestamp: new Date().toISOString()
    };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    return entry;
  }

  recordError(error) {
    this.errorCount += 1;
    const message = error?.message || error || 'Unknown error';
    this.lastError = message;
    this.setFlag('last_error', message, { log: false });
    return this.log(`ERROR: ${message}`, { stack: error?.stack }, 'error');
  }

  recordWarning(message, data = {}) {
    return this.log(`WARN: ${message}`, data, 'warn');
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

  setSample(name, value) {
    this.samples.set(name, { value, timestamp: Date.now() });
    return value;
  }

  getSample(name) {
    return this.samples.get(name)?.value ?? null;
  }

  incrementCounter(name, amount = 1, { log = true } = {}) {
    const current = this.counters.get(name) ?? 0;
    const next = current + amount;
    this.counters.set(name, next);
    if (log) {
      this.log(`Counter ${name} incremented to ${next}`);
    }
    return next;
  }

  getCounter(name) {
    return this.counters.get(name) ?? 0;
  }

  guard(name, fn) {
    try {
      const result = fn();
      this.incrementCounter(`${name}_successes`, 1, { log: false });
      return { ok: true, result };
    } catch (error) {
      this.recordError(error);
      this.incrementCounter(`${name}_failures`, 1, { log: false });
      this.setFlag(`${name}_state`, 'failed');
      return { ok: false, error };
    }
  }
}
