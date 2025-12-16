export class Player {
  constructor({ x, y }) {
    this.position = { x, y: 16, z: y };
    this.speed = 140;
    this.size = 18;
    this.color = '#5eff8b';
    this.type = 'player';
    this.rotation = { yaw: 0, pitch: 0 };
    this.pitchLimits = { min: -Math.PI / 3, max: Math.PI / 3 };
    this.cameraOffset = { x: 0, y: 18, z: 0 };
    this.weapon = null;
  }

  update({ delta, input, level, debug, entities, audio }) {
    let forward = 0;
    let strafe = 0;
    if (input.isPressed('KeyW')) forward += 1;
    if (input.isPressed('KeyS')) forward -= 1;
    if (input.isPressed('KeyA')) strafe -= 1;
    if (input.isPressed('KeyD')) strafe += 1;

    const yawSpeed = input.isPressed('ArrowLeft') ? -1 : input.isPressed('ArrowRight') ? 1 : 0;
    const pitchSpeed = input.isPressed('ArrowUp') ? 1 : input.isPressed('ArrowDown') ? -1 : 0;

    this.rotation.yaw += yawSpeed * delta * 1.8;
    this.rotation.pitch += pitchSpeed * delta * 1.4;
    this.rotation.pitch = Math.max(this.pitchLimits.min, Math.min(this.pitchLimits.max, this.rotation.pitch));

    const sinYaw = Math.sin(this.rotation.yaw);
    const cosYaw = Math.cos(this.rotation.yaw);
    const moveX = (forward * sinYaw + strafe * cosYaw) * this.speed * delta;
    const moveZ = (forward * cosYaw - strafe * sinYaw) * this.speed * delta;

    const nextX = this.position.x + moveX;
    const nextZ = this.position.z + moveZ;
    if (!level.isWallAt(nextX, this.position.z)) this.position.x = nextX;
    if (!level.isWallAt(this.position.x, nextZ)) this.position.z = nextZ;

    if (this.weapon) {
      const shot = this.weapon.update({ delta, input, owner: this, debug, audio });
      if (shot) {
        entities.push(shot);
      }
    }

    const aimingBand = this.rotation.pitch > 0.35 ? 'upward' : this.rotation.pitch < -0.35 ? 'downward' : 'level';
    debug.setFlag('aim_band', aimingBand);
  }
}
