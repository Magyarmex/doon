export class Renderer {
  constructor(canvas, debug) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.debug = debug;
    this.fov = 75 * (Math.PI / 180);
  }

  render(level, { camera, entities, weapon }) {
    this.clear();
    this.drawSkyAndFloor();
    this.drawGrid(level, camera);
    this.drawWalls(level, camera);
    entities.forEach((entity) => this.drawEntity(entity, camera));
    this.drawWeaponModel(weapon);
  }

  clear() {
    this.ctx.fillStyle = '#05070f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawSkyAndFloor() {
    const horizon = this.canvas.height / 2;
    this.ctx.fillStyle = '#0c1020';
    this.ctx.fillRect(0, 0, this.canvas.width, horizon);
    const gradient = this.ctx.createLinearGradient(0, horizon, 0, this.canvas.height);
    gradient.addColorStop(0, '#101525');
    gradient.addColorStop(1, '#06080f');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, horizon, this.canvas.width, this.canvas.height - horizon);
  }

  drawGrid(level, camera) {
    const gridSize = level.tileSize;
    const color = '#112030';
    for (let x = 0; x <= level.tiles[0].length; x += 1) {
      const start = this.project({ x: x * gridSize, y: 0, z: 0 }, camera);
      const end = this.project({ x: x * gridSize, y: 0, z: level.tiles.length * gridSize }, camera);
      if (start && end) this.drawLine(start, end, color);
    }
    for (let z = 0; z <= level.tiles.length; z += 1) {
      const start = this.project({ x: 0, y: 0, z: z * gridSize }, camera);
      const end = this.project({ x: level.tiles[0].length * gridSize, y: 0, z: z * gridSize }, camera);
      if (start && end) this.drawLine(start, end, color);
    }
  }

  drawWalls(level, camera) {
    const segments = level.getWallSegments();
    segments.forEach((segment) => {
      const projected = segment.vertices.map((v) => this.project(v, camera));
      if (projected.some((p) => !p)) return;

      const faces = [
        [projected[0], projected[1], projected[2], projected[3]],
        [projected[4], projected[5], projected[6], projected[7]],
        [projected[0], projected[1], projected[5], projected[4]],
        [projected[2], projected[3], projected[7], projected[6]],
        [projected[1], projected[2], projected[6], projected[5]],
        [projected[0], projected[3], projected[7], projected[4]]
      ];

      faces.forEach((face) => {
        this.ctx.fillStyle = segment.color;
        this.ctx.strokeStyle = '#0b1625';
        this.ctx.beginPath();
        face.forEach((point, index) => {
          if (index === 0) this.ctx.moveTo(point.x, point.y);
          else this.ctx.lineTo(point.x, point.y);
        });
        this.ctx.closePath();
        this.ctx.globalAlpha = 0.9;
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
        this.ctx.stroke();
      });
    });
  }

  drawEntity(entity, camera) {
    const size = entity.size || 16;
    const half = size / 2;
    const points = [
      { x: entity.position.x - half, y: entity.position.y, z: entity.position.z - half },
      { x: entity.position.x + half, y: entity.position.y, z: entity.position.z - half },
      { x: entity.position.x + half, y: entity.position.y + size, z: entity.position.z - half },
      { x: entity.position.x - half, y: entity.position.y + size, z: entity.position.z - half },
      { x: entity.position.x - half, y: entity.position.y, z: entity.position.z + half },
      { x: entity.position.x + half, y: entity.position.y, z: entity.position.z + half },
      { x: entity.position.x + half, y: entity.position.y + size, z: entity.position.z + half },
      { x: entity.position.x - half, y: entity.position.y + size, z: entity.position.z + half }
    ];
    const projected = points.map((p) => this.project(p, camera));
    if (projected.some((p) => !p)) return;

    const faces = [
      [projected[0], projected[1], projected[2], projected[3]],
      [projected[4], projected[5], projected[6], projected[7]],
      [projected[0], projected[1], projected[5], projected[4]],
      [projected[2], projected[3], projected[7], projected[6]],
      [projected[1], projected[2], projected[6], projected[5]],
      [projected[0], projected[3], projected[7], projected[4]]
    ];

    faces.forEach((face) => {
      this.ctx.fillStyle = entity.color;
      this.ctx.strokeStyle = '#112235';
      this.ctx.beginPath();
      face.forEach((point, index) => {
        if (index === 0) this.ctx.moveTo(point.x, point.y);
        else this.ctx.lineTo(point.x, point.y);
      });
      this.ctx.closePath();
      this.ctx.globalAlpha = 0.95;
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
      this.ctx.stroke();
    });
  }

  drawLine(start, end, color) {
    this.ctx.strokeStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();
  }

  project(point, camera) {
    // Translate to camera space
    const dx = point.x - camera.position.x;
    const dy = point.y - camera.position.y;
    const dz = point.z - camera.position.z;

    // Rotate by yaw
    const cosYaw = Math.cos(camera.rotation.yaw);
    const sinYaw = Math.sin(camera.rotation.yaw);
    let xz = cosYaw * dx - sinYaw * dz;
    let zz = sinYaw * dx + cosYaw * dz;

    // Rotate by pitch
    const cosPitch = Math.cos(camera.rotation.pitch);
    const sinPitch = Math.sin(camera.rotation.pitch);
    const yz = cosPitch * dy - sinPitch * zz;
    const zz2 = sinPitch * dy + cosPitch * zz;

    if (zz2 <= 0.1) return null;

    const aspect = this.canvas.width / this.canvas.height;
    const f = 1 / Math.tan(this.fov / 2);

    const x = (xz * f) / (aspect * zz2);
    const y = (yz * f) / zz2;

    return {
      x: (x + 1) * 0.5 * this.canvas.width,
      y: (1 - (y + 1) * 0.5) * this.canvas.height
    };
  }

  drawWeaponModel(model) {
    if (!model) return;
    const fields = ['swayX', 'swayY', 'recoil', 'recoilKick', 'reloadDip', 'boltOffset', 'boltLift'];
    const invalidField = fields.find((key) => !Number.isFinite(model[key]));
    if (invalidField) {
      this.debug.recordError(new Error(`Invalid weapon model value: ${invalidField}`));
      return;
    }

    const originX = this.canvas.width * 0.72 + model.swayX;
    const originY = this.canvas.height * 0.78 + model.swayY + model.reloadDip + model.recoilKick * -0.35;
    const ctx = this.ctx;

    ctx.save();
    ctx.translate(originX, originY);
    ctx.rotate(-0.1 + model.recoil * 0.05);
    ctx.globalAlpha = 0.95;

    // Stock and main body
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillRect(-90, -14, 210, 32);
    ctx.strokeRect(-90, -14, 210, 32);

    // Barrel
    ctx.fillStyle = '#8aa1cf';
    ctx.fillRect(120, -8 - model.recoilKick * 0.05, 160, 10);

    // Bolt carrier
    const boltShift = model.boltOffset * 24;
    ctx.fillStyle = '#c7d2fe';
    ctx.fillRect(36 - boltShift, -6 - model.boltLift * 0.3, 34, 12);
    ctx.fillRect(52 - boltShift, 6 - model.boltLift * 0.3, 12, 18);

    // Wooden foregrip accent
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(20, -10, 80, 24);

    // Receiver glow for activity
    if (model.animation === 'fire') {
      ctx.fillStyle = 'rgba(255, 244, 214, 0.25)';
      ctx.fillRect(30, -16, 60, 42);
    } else if (model.animation === 'reload') {
      ctx.fillStyle = 'rgba(120, 191, 255, 0.25)';
      ctx.fillRect(-60, -18, 120, 46);
    }

    // Iron sights
    ctx.fillStyle = '#cbd5f5';
    ctx.fillRect(170, -18 - model.recoilKick * 0.04, 8, 12);
    ctx.fillRect(258, -16 - model.recoilKick * 0.06, 10, 8);

    ctx.restore();
  }
}
