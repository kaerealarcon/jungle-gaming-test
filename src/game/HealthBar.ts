import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { visualAsset } from './visualAssets';

export class HealthBar extends Container {
  private fill: Sprite;
  private clip = new Graphics();
  private lastRatio = -1;
  constructor(private textures: Record<string, Texture>, private enemy: boolean, private barWidth = 60) {
    super();
    const prefix = enemy ? 'enemy_health' : 'health';
    const frame = new Sprite(textures[visualAsset(`ui/hud/${prefix}_frame`)]);
    this.fill = new Sprite(textures[visualAsset(`ui/hud/${prefix}_fill_${enemy ? 'red' : 'green'}`)]);
    const barHeight = barWidth * (enemy ? 40 / 160 : 48 / 256);
    for (const sprite of [frame, this.fill]) { sprite.width = barWidth; sprite.height = barHeight; sprite.position.set(-barWidth / 2, -barHeight / 2); }
    this.fill.mask = this.clip;
    this.addChild(frame, this.fill, this.clip);
    this.updateHealth(1);
  }
  updateHealth(ratio: number) {
    ratio = Math.max(0, Math.min(1, ratio));
    if (ratio === this.lastRatio) return;
    this.lastRatio = ratio;
    const prefix = this.enemy ? 'enemy_health' : 'health';
    const color = this.enemy || ratio <= 0.25 ? 'red' : ratio <= 0.5 ? 'amber' : 'green';
    this.fill.texture = this.textures[visualAsset(`ui/hud/${prefix}_fill_${color}`)]!;
    const factor = this.barWidth / (this.enemy ? 160 : 256);
    const x = this.enemy ? 24 : 30;
    const y = this.enemy ? 12 : 15;
    const width = this.enemy ? 112 : 196;
    const height = this.enemy ? 15 : 20;
    this.clip.clear().rect(-this.barWidth / 2 + x * factor, -this.fill.height / 2 + y * factor, width * factor * ratio, height * factor).fill(0xffffff);
  }
}
