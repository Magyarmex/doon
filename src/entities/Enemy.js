export class Enemy {
  constructor({ x, y }) {
    this.position = { x, y: 0, z: y };
    this.size = 18;
    this.color = '#ff5e5e';
    this.type = 'enemy';
    this.speed = 30;
  }

  update({ delta }) {
    const pulse = Math.sin(Date.now() / 500);
    this.position.x += pulse * this.speed * delta;
  }
}
