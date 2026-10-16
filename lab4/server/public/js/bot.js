// Простейший бот: идёт к ближайшей монете.
export class Bot {
  constructor(fieldW = 800, fieldH = 600, playerSize = 40, speed = 6) {
    this.fieldW = fieldW;
    this.fieldH = fieldH;
    this.playerSize = playerSize;
    this.speed = speed; // px за tick (30 Hz => ~180 px/s)
  }

  nextMove(pos, coins) {
    if (!coins || coins.length === 0) return pos;

    let target = coins[0];
    let best = Infinity;
    for (const c of coins) {
      const d = Math.hypot(c.x - (pos.x + this.playerSize / 2),
                           c.y - (pos.y + this.playerSize / 2));
      if (d < best) { best = d; target = c; }
    }

    const cx = pos.x + this.playerSize / 2;
    const cy = pos.y + this.playerSize / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return pos;

    const step = Math.min(this.speed, dist);
    const nx = pos.x + (dx / dist) * step;
    const ny = pos.y + (dy / dist) * step;

    return {
      x: Math.max(0, Math.min(this.fieldW - this.playerSize, nx)),
      y: Math.max(0, Math.min(this.fieldH - this.playerSize, ny))
    };
  }
}