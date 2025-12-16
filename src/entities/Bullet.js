export class Bullet {
  constructor({ origin, direction, speed, color }) {
    this.position = { ...origin };
    this.direction = direction;
    this.speed = speed;
    this.life = 2.5;
    this.size = 6;
    this.color = color;
    this.type = 'projectile';
  }

  update({ delta, debug }) {
    this.life -= delta;
    if (this.life <= 0) {
      debug.log('Bullet expired');
      this.dead = true;
      return;
    }

    const sinYaw = Math.sin(this.direction.yaw);
    const cosYaw = Math.cos(this.direction.yaw);
    const sinPitch = Math.sin(this.direction.pitch);
    const cosPitch = Math.cos(this.direction.pitch);

    this.position.x += sinYaw * cosPitch * this.speed * delta;
    this.position.z += cosYaw * cosPitch * this.speed * delta;
    this.position.y += sinPitch * this.speed * delta;
  }
}
