import { Graphics } from 'pixi.js';

interface Sample { id: number; x: number; y: number; angle: number }
interface Ripple { x: number; y: number; angle: number; life: number; strength: number }
export class WakeTrail extends Graphics {
  private last = new Map<number, { x: number; y: number; distance: number }>();
  private ripples: Ripple[] = [];
  updateTrail(samples: Sample[], dt: number) {
    if (dt <= 0) return;
    this.ripples.forEach(ripple => { ripple.life -= dt; });
    this.ripples = this.ripples.filter(ripple => ripple.life > 0);
    const ids = new Set(samples.map(sample => sample.id));
    for (const id of this.last.keys()) if (!ids.has(id)) this.last.delete(id);
    for (const sample of samples) {
      const last = this.last.get(sample.id);
      if (last) {
        const movement = Math.hypot(sample.x - last.x, sample.y - last.y);
        last.distance += movement;
        if (movement > 0.02 && last.distance >= 5) {
          last.distance %= 5;
          this.ripples.push({ x: sample.x - Math.sin(sample.angle) * 31, y: sample.y + Math.cos(sample.angle) * 31, angle: sample.angle, life: 1.2, strength: Math.min(1, movement / dt / 180) });
        }
      }
      this.last.set(sample.id, { x: sample.x, y: sample.y, distance: last?.distance ?? 0 });
    }
    this.ripples = this.ripples.slice(-360);
    this.clear();
    for (const ripple of this.ripples) {
      const age = 1 - ripple.life / 1.2;
      const spread = 7 + age * 21;
      const dx = Math.cos(ripple.angle) * spread;
      const dy = Math.sin(ripple.angle) * spread;
      const backX = -Math.sin(ripple.angle) * age * 14;
      const backY = Math.cos(ripple.angle) * age * 14;
      this.moveTo(ripple.x - dx + backX, ripple.y - dy + backY).lineTo(ripple.x, ripple.y).lineTo(ripple.x + dx + backX, ripple.y + dy + backY)
        .stroke({ color: 0xf2ffff, width: 3, alpha: (1 - age) * 0.85 * ripple.strength });
    }
  }
}
