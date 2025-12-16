export class Enemy {
  constructor({ x, z }) {
    this.position = { x, y: 0, z };
    this.size = 18;
    this.color = '#ff5e5e';
    this.type = 'enemy';
    this.speed = 30;
    this.maxOffset = 18;
  }

  update({ delta, level, debug, player }) {
    const pulse = Math.sin(Date.now() / 500) * this.maxOffset;
    const fallbackTarget = { x: this.position.x + pulse, z: this.position.z + 4 };
    const anchor = player?.position ?? fallbackTarget;
    const aimX = anchor.x + pulse;
    const aimZ = anchor.z - 24;

    const stepX = aimX - this.position.x;
    const stepZ = aimZ - this.position.z;
    const distance = Math.hypot(stepX, stepZ) || 1;
    const move = this.speed * delta;
    const nextX = this.position.x + (stepX / distance) * move;
    const nextZ = this.position.z + (stepZ / distance) * move;

    const wouldHitWall = level?.isWallAt(nextX, nextZ);
    if (wouldHitWall) {
      const lateralStep = this.size;
      const leftTargetX = this.position.x - lateralStep;
      const rightTargetX = this.position.x + lateralStep;
      const canStepLeft = !level?.isWallAt(leftTargetX, nextZ);
      const canStepRight = !level?.isWallAt(rightTargetX, nextZ);

      if (canStepLeft || canStepRight) {
        const preferredX = canStepLeft && (!canStepRight || Math.abs(leftTargetX - anchor.x) <= Math.abs(rightTargetX - anchor.x))
          ? leftTargetX
          : rightTargetX;
        this.position.x = preferredX;
        this.position.z = nextZ;
        debug?.incrementCounter('enemy_wall_sidestep');
        debug?.setFlag('enemy_state', 'patrolling');
      } else {
        debug?.incrementCounter('enemy_wall_deflections');
        debug?.setFlag('enemy_state', 'blocked');
      }
    } else {
      this.position.x = nextX;
      this.position.z = nextZ;
      debug?.setFlag('enemy_state', 'patrolling');
    }

    if (debug) {
      debug.setFlag('enemy_x', Number(this.position.x.toFixed(2)), { log: false });
      debug.setFlag('enemy_z', Number(this.position.z.toFixed(2)), { log: false });
    }
  }
}
