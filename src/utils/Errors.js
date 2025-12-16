export class EngineError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'EngineError';
    this.cause = cause;
  }
}
