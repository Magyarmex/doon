export class DebugMetrics {
  constructor() {
    this.logs = [];
    this.errorCount = 0;
    this.flags = new Map();
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

  setFlag(name, value) {
    this.flags.set(name, value);
    this.log(`Flag ${name} set to ${value}`);
  }

  getFlag(name) {
    return this.flags.get(name);
  }
}
