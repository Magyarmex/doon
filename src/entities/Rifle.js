import { Bullet } from './Bullet.js';
import { EngineError } from '../utils/Errors.js';

export class Rifle {
  constructor(debug) {
    this.type = 'rifle';
    this.magazineSize = 12;
    this.ammo = this.magazineSize;
    this.reloadTime = 4;
    this.fireInterval = 1.5;
    this.cooldown = 0;
    this.reloading = 0;
    this.debug = debug;
  }

  update({ delta, input, owner, debug }) {
    if (this.cooldown > 0) this.cooldown -= delta;
    if (this.reloading > 0) {
      this.reloading -= delta;
      if (this.reloading <= 0) {
        this.ammo = this.magazineSize;
        debug.log('Rifle reloaded');
        debug.setFlag('rifle_state', 'ready');
      }
      return null;
    }

    const wantsReload = input.isPressed('KeyR') || this.ammo <= 0;
    if (wantsReload && this.ammo < this.magazineSize) {
      this.reloading = this.reloadTime;
      debug.log('Rifle reload started');
      debug.setFlag('rifle_state', 'reloading');
      return null;
    }

    if (input.isPressed('Space')) {
      return this.shoot(owner, debug);
    }

    return null;
  }

  shoot(owner, debug) {
    if (this.cooldown > 0) return null;
    if (this.ammo <= 0) {
      debug.recordError(new EngineError('Cannot shoot: empty magazine'));
      return null;
    }
    if (this.reloading > 0) return null;

    this.ammo -= 1;
    this.cooldown = this.fireInterval;
    debug.log('Rifle fired', { remaining: this.ammo });
    debug.setFlag('rifle_ammo', this.ammo);

    const muzzle = {
      x: owner.position.x,
      y: owner.position.y + owner.cameraOffset.y,
      z: owner.position.z
    };

    return new Bullet({
      origin: muzzle,
      direction: { ...owner.rotation },
      speed: 400,
      color: '#ffef8a'
    });
  }
}
