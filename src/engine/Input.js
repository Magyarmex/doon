export class Input {
  constructor(debug) {
    this.debug = debug;
    this.keys = new Set();
    this.mouse = { dx: 0, dy: 0 };
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('mousemove', this.handleMouseMove);
    }
  }

  handleKeyDown(event) {
    this.keys.add(event.code);
  }

  handleKeyUp(event) {
    this.keys.delete(event.code);
  }

  handleMouseMove(event) {
    if (document.pointerLockElement) {
      this.mouse.dx += event.movementX || 0;
      this.mouse.dy += event.movementY || 0;
    }
  }

  isPressed(code) {
    return this.keys.has(code);
  }

  get hasActiveMovement() {
    return (
      this.keys.has('KeyW') ||
      this.keys.has('KeyA') ||
      this.keys.has('KeyS') ||
      this.keys.has('KeyD') ||
      this.keys.has('Space')
    );
  }

  consumeMouseDelta() {
    const { dx, dy } = this.mouse;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    return { dx, dy };
  }
}
