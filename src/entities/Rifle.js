import { Bullet } from './Bullet.js';
import { EngineError } from '../utils/Errors.js';

export class Rifle {
  constructor(debug, sfx) {
    this.type = 'rifle';
    this.magazineSize = 12;
    this.ammo = this.magazineSize;
    this.reloadTime = 4;
    this.fireInterval = 1.5;
    this.cooldown = 0;
    this.reloading = 0;
    this.debug = debug;
    this.sfx = sfx;
    this.viewModel = {
      animation: 'idle',
      animationTime: 0,
      animationDuration: 0,
      recoil: 0,
      boltOffset: 0,
      reloadProgress: 0,
      swayPhase: 0,
      lastReportedReloadStep: -1,
      lastReportedBolt: 'closed'
    };
    this.debug.setFlag('rifle_animation', 'idle');
    this.debug.setFlag('rifle_reload_progress', '0%');
    this.debug.setFlag('rifle_bolt', 'closed');
    this.debug.setFlag('rifle_sound_channel', this.sfx?.supported ? 'available' : 'disabled');
    this.debug.incrementCounter('rifle_models_initialized');
  }

  update({ delta, input, owner, debug }) {
    this.updateViewModel(delta, input, debug);
    if (this.cooldown > 0) this.cooldown -= delta;
    if (this.reloading > 0) {
      this.reloading -= delta;
      this.viewModel.animation = 'reload';
      this.viewModel.animationTime += delta;
      this.viewModel.animationDuration = this.reloadTime;
      this.viewModel.reloadProgress = Math.min(1, 1 - this.reloading / this.reloadTime);
      this.reportBoltState(debug, 'open');
      this.reportReloadProgress(debug);
      if (this.reloading <= 0) {
        this.ammo = this.magazineSize;
        debug.log('Rifle reloaded');
        debug.setFlag('rifle_state', 'ready');
        debug.setFlag('rifle_animation', 'idle');
        this.viewModel.animation = 'idle';
        this.viewModel.reloadProgress = 0;
        this.viewModel.animationTime = 0;
        this.reportReloadProgress(debug, true);
      }
      return null;
    }

    const wantsReload = input.isPressed('KeyR') || this.ammo <= 0;
    if (wantsReload && this.ammo < this.magazineSize) {
      this.reloading = this.reloadTime;
      debug.log('Rifle reload started');
      debug.incrementCounter('rifle_reload_requests');
      debug.setFlag('rifle_state', 'reloading');
      debug.setFlag('rifle_animation', 'reload');
      this.viewModel.animation = 'reload';
      this.viewModel.animationTime = 0;
      this.viewModel.animationDuration = this.reloadTime;
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
    debug.incrementCounter('rifle_shots_fired');
    debug.setFlag('rifle_ammo', this.ammo);
    this.startFireAnimation(debug);
    this.playSound(debug, 'rifle_fire');

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

  updateViewModel(delta, input, debug) {
    this.viewModel.swayPhase += delta * (input.hasActiveMovement ? 6 : 2.5);
    this.viewModel.recoil = Math.max(0, this.viewModel.recoil - delta * 2.75);

    if (this.viewModel.animation === 'fire') {
      this.viewModel.animationTime += delta;
      const progress = Math.min(1, this.viewModel.animationTime / this.viewModel.animationDuration);
      const boltOut = progress < 0.45 ? progress / 0.45 : Math.max(0, 1 - (progress - 0.45) / 0.35);
      this.viewModel.boltOffset = Math.min(1, boltOut);
      if (progress >= 1) {
        this.viewModel.animation = 'idle';
        this.viewModel.animationTime = 0;
        this.viewModel.animationDuration = 0;
        this.reportBoltState(debug, 'closed');
      }
    }

    if (this.viewModel.animation === 'idle') {
      const previousBolt = this.viewModel.boltOffset;
      this.viewModel.boltOffset = Math.max(0, this.viewModel.boltOffset - delta * 1.5);
      if (previousBolt !== this.viewModel.boltOffset && this.viewModel.boltOffset < 0.1) {
        this.reportBoltState(debug, 'closed');
      }
      this.viewModel.reloadProgress = 0;
    }
  }

  startFireAnimation(debug) {
    this.viewModel.animation = 'fire';
    this.viewModel.animationTime = 0;
    this.viewModel.animationDuration = 0.8;
    this.viewModel.recoil = 1.15;
    debug.setFlag('rifle_animation', 'fire');
    this.reportBoltState(debug, 'cycling');
  }

  reportReloadProgress(debug, force = false) {
    const step = Math.floor(this.viewModel.reloadProgress * 10);
    if (!force && step === this.viewModel.lastReportedReloadStep) return;
    this.viewModel.lastReportedReloadStep = step;
    const percentage = `${Math.min(100, Math.max(0, Math.round(this.viewModel.reloadProgress * 100)))}%`;
    debug.setFlag('rifle_reload_progress', percentage);
  }

  reportBoltState(debug, state) {
    if (state === this.viewModel.lastReportedBolt) return;
    this.viewModel.lastReportedBolt = state;
    debug.setFlag('rifle_bolt', state);
  }

  playSound(debug, key) {
    debug.incrementCounter('rifle_sound_play_requests');
    if (!this.sfx || typeof this.sfx.play !== 'function') {
      debug.setFlag('rifle_sound_last', 'skipped:no-library');
      debug.incrementCounter('rifle_sound_skips');
      return;
    }

    const playback = this.sfx.play(key, { baseVolume: 1 });
    if (!playback) {
      debug.incrementCounter('rifle_sound_skips');
      debug.setFlag('rifle_sound_last', `${key}:failed`);
    } else {
      debug.setFlag('rifle_sound_last', `${key}:triggered`);
    }
  }

  getModelState() {
    const swayAmount = 10;
    const sway = Math.sin(this.viewModel.swayPhase) * swayAmount;
    const bob = Math.cos(this.viewModel.swayPhase * 0.6) * (swayAmount * 0.35);
    const reloadDip = this.viewModel.animation === 'reload' ? Math.sin(this.viewModel.reloadProgress * Math.PI) * 18 : 0;
    const boltLift = this.viewModel.boltOffset * 16;
    const recoilKick = this.viewModel.recoil * 18;

    return {
      swayX: sway,
      swayY: bob,
      recoil: this.viewModel.recoil,
      recoilKick,
      reloadDip,
      boltOffset: this.viewModel.boltOffset,
      boltLift,
      animation: this.viewModel.animation,
      reloadProgress: this.viewModel.reloadProgress
    };
  }
}
