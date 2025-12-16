export class Level {
  constructor({ tiles, tileSize }) {
    this.tiles = tiles;
    this.tileSize = tileSize;
    this.wallHeight = tileSize * 1.5;
  }

  isWallAt(x, z) {
    const gridX = Math.floor(x / this.tileSize);
    const gridZ = Math.floor(z / this.tileSize);
    if (gridZ < 0 || gridZ >= this.tiles.length) return true;
    if (gridX < 0 || gridX >= this.tiles[0].length) return true;
    return this.tiles[gridZ][gridX] !== 0;
  }

  getWallSegments() {
    const segments = [];
    this.tiles.forEach((row, z) => {
      row.forEach((tile, x) => {
        if (tile === 0) return;
        const baseX = x * this.tileSize;
        const baseZ = z * this.tileSize;
        const size = this.tileSize;
        const h = this.wallHeight;
        // Each wall cell becomes a simple prism for rendering.
        segments.push({
          color: tile === 1 ? '#1f2b45' : '#2c3b5c',
          vertices: [
            { x: baseX, y: 0, z: baseZ },
            { x: baseX + size, y: 0, z: baseZ },
            { x: baseX + size, y: h, z: baseZ },
            { x: baseX, y: h, z: baseZ },
            { x: baseX, y: 0, z: baseZ + size },
            { x: baseX + size, y: 0, z: baseZ + size },
            { x: baseX + size, y: h, z: baseZ + size },
            { x: baseX, y: h, z: baseZ + size }
          ]
        });
      });
    });
    return segments;
  }
}
