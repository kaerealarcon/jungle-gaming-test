import type { GameConfig } from './config';
import type { SoundName } from '../audio/SoundManager';
import { clearPath, findRoute, type Point } from './navigation';

export type Steering = 'forward' | 'left' | 'right';
export type Attack = 'fireFront' | 'fireLeft' | 'fireRight';
export type GameAction = Steering | Attack;
export interface Projectile { id: number; x: number; y: number; angle: number; speed: number; damage: number; radius: number; remaining: number; range: number; owner: 'player' | 'enemy' }
export interface Enemy { id: number; kind: 'chaser' | 'shooter'; x: number; y: number; angle: number; health: number; maxHealth: number; radius: number; hitSeconds: number; cooldown: number; grace: number; pathSeconds: number; route: Point[] }
export interface CombatEffect { id: number; x: number; y: number; kind: 'shot' | 'impact' | 'explosion' | 'splash'; remaining: number; duration: number }
export interface Island { x: number; y: number; width: number; height: number; corner: number }
export const islands: readonly Island[] = [
  { x: 250, y: 160, width: 230, height: 230, corner: 48 },
  { x: 820, y: 440, width: 250, height: 250, corner: 48 },
  { x: 860, y: 100, width: 160, height: 160, corner: 34 },
];

export class NavigationSimulation {
  readonly islands: Island[];
  readonly ship = { x: 640, y: 400, angle: 0, speed: 0, health: 100, hitSeconds: 0 };
  readonly targets: Enemy[] = [];
  dead = false;
  elapsedSeconds = 0;
  endedReason: 'time' | 'death' | null = null;
  private timeWarned = false;
  get remainingSeconds() { return Math.max(0, this.config.sessionSeconds - this.elapsedSeconds); }
  private seed: number;
  private spawnSeconds = 0;
  private lowHealthWarned = false;
  projectiles: Projectile[] = [];
  effects: CombatEffect[] = [];
  score = 0;
  readonly sounds: SoundName[] = [];
  private collision = false;
  private shotVariant = 0;
  private hitVariant = 0;
  private splashVariant = 0;
  private explosionVariant = 0;
  readonly cooldowns: Record<Attack, number> = { fireFront: 0, fireLeft: 0, fireRight: 0 };
  private nextId = 10;
  constructor(readonly config: GameConfig, fixedIslands?: readonly Island[]) {
    this.seed = config.spawn.seed;
    this.islands = fixedIslands ? fixedIslands.map(island => ({ ...island })) : this.generateIslands();
    this.ship.health = config.player.health;
    this.spawn('chaser');
    this.spawn('shooter');
  }

  private random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  private generateIslands(): Island[] {
    const { edgeMargin, islandGap, playerClearance, attempts } = this.config.terrain;
    const layout: Island[] = [];
    for (const template of islands) {
      let placed = false;
      for (let attempt = 0; attempt < attempts; attempt++) {
        const candidate = { ...template,
          x: edgeMargin + this.random() * (this.config.arena.width - template.width - edgeMargin * 2),
          y: edgeMargin + this.random() * (this.config.arena.height - template.height - edgeMargin * 2),
        };
        const dx = Math.max(candidate.x - this.ship.x, this.ship.x - candidate.x - candidate.width, 0);
        const dy = Math.max(candidate.y - this.ship.y, this.ship.y - candidate.y - candidate.height, 0);
        if (Math.hypot(dx, dy) < playerClearance) continue;
        if (layout.some(other => candidate.x < other.x + other.width + islandGap && candidate.x + candidate.width + islandGap > other.x
          && candidate.y < other.y + other.height + islandGap && candidate.y + candidate.height + islandGap > other.y)) continue;
        layout.push(candidate); placed = true; break;
      }
      if (!placed) return islands.map(island => ({ ...island }));
    }
    return layout;
  }

  private spawn(kind: Enemy['kind']) {
    const stats = this.config[kind];
    for (let attempt = 0; attempt < this.config.spawn.attempts; attempt++) {
      const margin = stats.radius + this.config.spawn.clearance;
      const x = margin + this.random() * (this.config.arena.width - margin * 2);
      const y = margin + this.random() * (this.config.arena.height - margin * 2);
      if (this.obstructed(x, y, margin) || Math.hypot(x - this.ship.x, y - this.ship.y) < this.config.spawn.minPlayerDistance
        || this.targets.some(enemy => Math.hypot(x - enemy.x, y - enemy.y) < margin + enemy.radius)) continue;
      this.targets.push({ id: this.nextId++, kind, x, y, angle: Math.atan2(this.ship.x - x, y - this.ship.y), health: stats.health, maxHealth: stats.health, radius: stats.radius, hitSeconds: 0, cooldown: this.config.weapons.enemy.cooldownSeconds, grace: this.config.spawn.graceSeconds, pathSeconds: 0, route: [] });
      return;
    }
    // If no safe location exists, skip this spawn rather than inflicting unavoidable damage.
  }

  private damagePlayer(damage: number) {
    if (this.dead) return;
    this.ship.health = Math.max(0, this.ship.health - damage);
    this.ship.hitSeconds = this.config.combat.impactSeconds;
    this.sounds.push(this.hitVariant++ % 2 ? 'ship_wood_hit_2' : 'ship_wood_hit_1');
    if (!this.lowHealthWarned && this.ship.health > 0 && this.ship.health <= this.config.player.health * 0.25) { this.lowHealthWarned = true; this.sounds.push('health_low'); }
    if (!this.ship.health) {
      this.dead = true; this.ship.speed = 0;
      this.endedReason = 'death';
      this.sounds.push('ship_explosion_1', 'ship_sinking', 'game_over');
      this.effect(this.ship.x, this.ship.y, 'explosion');
    }
  }

  private hullBlocked(x: number, y: number, radius: number, enemyId?: number) {
    if (enemyId !== undefined && Math.hypot(x - this.ship.x, y - this.ship.y) < radius + this.config.player.radius) return true;
    return this.targets.some(enemy => enemy.health > 0 && enemy.id !== enemyId && Math.hypot(x - enemy.x, y - enemy.y) < radius + enemy.radius);
  }

  private impactChaser(enemy: Enemy) {
    if (enemy.health <= 0 || enemy.grace > 0 || this.dead) return;
    enemy.health = 0;
    this.sounds.push('ship_collision', 'ship_explosion_2');
    this.effect(enemy.x, enemy.y, 'explosion');
    this.damagePlayer(this.config.chaser.impactDamage);
  }

  private updateEnemy(enemy: Enemy, dt: number) {
    if (enemy.health <= 0 || this.dead) return;
    enemy.grace = Math.max(0, enemy.grace - dt);
    enemy.hitSeconds = Math.max(0, enemy.hitSeconds - dt);
    if (enemy.grace > 0) return;
    const stats = this.config[enemy.kind];
    const playerDistance = Math.hypot(this.ship.x - enemy.x, this.ship.y - enemy.y);
    const blocked = (x: number, y: number, radius: number) => this.obstructed(x, y, radius);
    enemy.pathSeconds -= dt;
    if (enemy.pathSeconds <= 0) { enemy.route = findRoute(enemy, this.ship, enemy.radius, this.islands, blocked); enemy.pathSeconds = this.config.ai.pathRefreshSeconds; }
    if (enemy.route.length > 1 && Math.hypot(enemy.route[0]!.x - enemy.x, enemy.route[0]!.y - enemy.y) < this.config.ai.waypointDistance) enemy.route.shift();
    const sight = enemy.kind === 'shooter' && clearPath(enemy, this.ship, this.config.weapons.enemy.projectileRadius, blocked);
    const inRange = enemy.kind === 'shooter' && playerDistance <= this.config.shooter.attackRange && sight;
    const goal = inRange ? this.ship : enemy.route[0] ?? this.ship;
    const desired = Math.atan2(goal.x - enemy.x, enemy.y - goal.y);
    const difference = Math.atan2(Math.sin(desired - enemy.angle), Math.cos(desired - enemy.angle));
    enemy.angle += Math.max(-stats.rotationSpeed * dt, Math.min(stats.rotationSpeed * dt, difference));
    if (!(inRange && playerDistance <= this.config.shooter.attackRange * this.config.ai.stoppingRangeRatio)) {
      const speed = stats.speed * Math.max(0, Math.cos(difference));
      const x = enemy.x + Math.sin(enemy.angle) * speed * dt;
      const y = enemy.y - Math.cos(enemy.angle) * speed * dt;
      if (enemy.kind === 'chaser' && Math.hypot(x - this.ship.x, y - this.ship.y) <= enemy.radius + this.config.player.radius) { this.impactChaser(enemy); if (enemy.health <= 0) return; }
      if (!this.obstructed(x, y, enemy.radius) && !this.hullBlocked(x, y, enemy.radius, enemy.id)) { enemy.x = x; enemy.y = y; }
      else enemy.pathSeconds = 0;
    }
    if (enemy.kind === 'chaser' && Math.hypot(enemy.x - this.ship.x, enemy.y - this.ship.y) <= enemy.radius + this.config.player.radius) {
      this.impactChaser(enemy);
      return;
    }
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    if (inRange && enemy.cooldown <= 0 && Math.abs(difference) <= this.config.ai.aimTolerance) {
      const weapon = this.config.weapons.enemy;
      const x = enemy.x + Math.sin(enemy.angle) * weapon.muzzleDistance;
      const y = enemy.y - Math.cos(enemy.angle) * weapon.muzzleDistance;
      this.projectiles.push({ id: this.nextId++, owner: 'enemy', x, y, angle: enemy.angle, speed: weapon.speed, damage: weapon.damage, radius: weapon.projectileRadius, remaining: weapon.lifetimeSeconds, range: weapon.range });
      this.effect(x, y, 'shot'); this.sounds.push('cannon_fire_2'); enemy.cooldown = weapon.cooldownSeconds;
    }
  }

  blocked(x: number, y: number) {
    return this.obstructed(x, y, this.config.player.radius);
  }

  obstructed(x: number, y: number, radius: number) {
    const { width, height } = this.config.arena;
    if (x < radius || y < radius || x > width - radius || y > height - radius) return true;
    return this.islands.some(island => {
      const dx = Math.max(Math.abs(x - island.x - island.width / 2) - (island.width / 2 - island.corner), 0);
      const dy = Math.max(Math.abs(y - island.y - island.height / 2) - (island.height / 2 - island.corner), 0);
      return Math.hypot(dx, dy) < island.corner + radius;
    });
  }

  private effect(x: number, y: number, kind: CombatEffect['kind']) {
    const duration = kind === 'explosion' ? this.config.combat.explosionSeconds : this.config.combat.impactSeconds;
    this.effects.push({ id: this.nextId++, x, y, kind, remaining: duration, duration });
  }

  private fire(action: Attack) {
    const front = action === 'fireFront';
    const weapon = front ? this.config.weapons.front : this.config.weapons.broadside;
    const angle = this.ship.angle + (front ? 0 : action === 'fireLeft' ? -Math.PI / 2 : Math.PI / 2);
    for (const offset of front ? [0] : [-1, 0, 1]) {
      const x = this.ship.x + Math.sin(angle) * weapon.muzzleDistance + Math.sin(this.ship.angle) * offset * this.config.combat.broadsideSpacing;
      const y = this.ship.y - Math.cos(angle) * weapon.muzzleDistance - Math.cos(this.ship.angle) * offset * this.config.combat.broadsideSpacing;
      this.projectiles.push({ id: this.nextId++, owner: 'player', x, y, angle, speed: weapon.speed, damage: weapon.damage, radius: weapon.projectileRadius, remaining: weapon.lifetimeSeconds, range: weapon.range });
      this.effect(x, y, 'shot');
    }
    this.cooldowns[action] = weapon.cooldownSeconds;
    this.sounds.push(front ? (['cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3'] as const)[this.shotVariant++ % 3]! : 'cannon_broadside');
  }

  update(seconds: number, input: ReadonlySet<GameAction>) {
    if (this.endedReason) return;
    // Small substeps prevent tunneling through obstacles on slow frames.
    const steps = Math.ceil(seconds / (1 / 120));
    if (!steps) return;
    const frameStep = seconds / steps;
    for (let step = 0; step < steps; step++) {
      if (this.endedReason) break;
      const dt = Math.min(frameStep, this.remainingSeconds);
      this.elapsedSeconds = Math.min(this.config.sessionSeconds, this.elapsedSeconds + dt);
      if (!this.timeWarned && this.remainingSeconds <= 10 + 1e-8) { this.timeWarned = true; this.sounds.push('time_warning'); }
      if (this.remainingSeconds <= 1e-8) {
        this.elapsedSeconds = this.config.sessionSeconds;
        this.endedReason = 'time'; this.ship.speed = 0; this.sounds.push('game_complete'); break;
      }
      this.ship.hitSeconds = Math.max(0, this.ship.hitSeconds - dt);
      this.spawnSeconds += dt;
      if (this.spawnSeconds + 1e-8 >= this.config.spawn.intervalSeconds) { this.spawnSeconds -= this.config.spawn.intervalSeconds; this.spawn(this.random() < this.config.spawn.chaserProbability ? 'chaser' : 'shooter'); }
      this.ship.angle += (Number(input.has('right')) - Number(input.has('left'))) * this.config.player.rotationSpeed * dt;
      const previousSpeed = this.ship.speed;
      this.ship.speed = input.has('forward')
        ? Math.min(this.config.player.speed, previousSpeed + this.config.player.speed / this.config.player.accelerationSeconds * dt)
        : Math.max(0, previousSpeed - this.config.player.speed / this.config.player.coastSeconds * dt);
      const distance = (previousSpeed + this.ship.speed) / 2 * dt;
      const x = this.ship.x + Math.sin(this.ship.angle) * distance;
      const y = this.ship.y - Math.cos(this.ship.angle) * distance;
      for (const enemy of this.targets) if (enemy.kind === 'chaser' && enemy.health > 0 && Math.hypot(x - enemy.x, y - enemy.y) <= enemy.radius + this.config.player.radius) this.impactChaser(enemy);
      if (this.dead) break;
      if (!this.blocked(x, y) && !this.hullBlocked(x, y, this.config.player.radius)) { this.ship.x = x; this.ship.y = y; this.collision = false; }
      else {
        if (!this.collision && distance > 0) this.sounds.push('ship_collision');
        this.collision = true;
        this.ship.speed = 0;
      }
      this.effects.forEach(effect => { effect.remaining -= dt; });
      this.effects = this.effects.filter(effect => effect.remaining > 0);
      this.targets.forEach(target => this.updateEnemy(target, dt));
      if (this.dead) break;
      for (const action of ['fireFront', 'fireLeft', 'fireRight'] as const) {
        this.cooldowns[action] = Math.max(0, this.cooldowns[action] - dt);
        if (input.has(action) && this.cooldowns[action] <= 1e-8) this.fire(action);
      }
      this.projectiles = this.projectiles.filter(projectile => {
        if (this.dead) return true;
        // Check the muzzle too, so shots cannot originate beyond a nearby obstacle.
        if (this.obstructed(projectile.x, projectile.y, projectile.radius)) { this.sounds.push(this.splashVariant++ % 2 ? 'cannonball_water_hit_2' : 'cannonball_water_hit_1'); this.effect(projectile.x, projectile.y, 'impact'); return false; }
        const travel = Math.min(projectile.speed * dt, projectile.range, projectile.speed * projectile.remaining);
        projectile.x += Math.sin(projectile.angle) * travel;
        projectile.y -= Math.cos(projectile.angle) * travel;
        projectile.remaining -= dt;
        projectile.range -= travel;
        if (this.obstructed(projectile.x, projectile.y, projectile.radius)) { this.sounds.push(this.splashVariant++ % 2 ? 'cannonball_water_hit_2' : 'cannonball_water_hit_1'); this.effect(projectile.x, projectile.y, 'impact'); return false; }
        if (projectile.owner === 'enemy' && Math.hypot(this.ship.x - projectile.x, this.ship.y - projectile.y) <= this.config.player.radius + projectile.radius) {
          this.effect(projectile.x, projectile.y, 'impact'); this.damagePlayer(projectile.damage); return false;
        }
        const target = projectile.owner === 'player' ? this.targets.find(target => target.health > 0 && Math.hypot(target.x - projectile.x, target.y - projectile.y) <= target.radius + projectile.radius) : undefined;
        if (target) {
          target.health = Math.max(0, target.health - projectile.damage);
          target.hitSeconds = this.config.combat.impactSeconds;
          this.sounds.push(this.hitVariant++ % 2 ? 'ship_wood_hit_2' : 'ship_wood_hit_1');
          this.effect(projectile.x, projectile.y, 'impact');
          if (!target.health) { this.score++; this.sounds.push(this.explosionVariant++ % 2 ? 'ship_explosion_2' : 'ship_explosion_1', 'ship_sinking', 'score_point'); this.effect(target.x, target.y, 'explosion'); }
          return false;
        }
        if (projectile.remaining <= 0 || projectile.range <= 0) {
          this.effect(projectile.x, projectile.y, 'splash');
          this.sounds.push(this.splashVariant++ % 2 ? 'cannonball_water_hit_2' : 'cannonball_water_hit_1');
          return false;
        }
        return true;
      });
      for (let index = this.targets.length - 1; index >= 0; index--) if (this.targets[index]!.health <= 0) this.targets.splice(index, 1);
    }
  }
}
