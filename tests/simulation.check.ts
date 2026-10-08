import { isMatchResult, loadMatchResult, saveMatchResult, type MatchResult } from '../src/player/result';
import assert from 'node:assert/strict';
import { createGameConfig, defaultOptions } from '../src/game/config';
import { NavigationSimulation, type Enemy, type GameAction } from '../src/game/simulation';
import { clearPath, findRoute } from '../src/game/navigation';
import { islands } from '../src/game/simulation';
import { validateCaptainName } from '../src/player/name';

const enemy = (kind: Enemy['kind'], x: number, y: number): Enemy => ({ id: 900, kind, x, y, angle: Math.PI, health: 60, maxHealth: 60, radius: 24, hitSeconds: 0, cooldown: 0, grace: 0, pathSeconds: 0, route: [] });
const step = (sim: NavigationSimulation, seconds: number, actions: GameAction[] = []) => { for (let frame = 0; frame < Math.round(seconds * 120); frame++) sim.update(1 / 120, new Set(actions)); };
const create = () => new NavigationSimulation(createGameConfig(defaultOptions), islands);

const initial = create();
assert.deepEqual(initial.targets.map(target => target.kind), ['chaser', 'shooter']);
for (const target of initial.targets) {
  assert.equal(initial.obstructed(target.x, target.y, target.radius), false);
  assert.ok(Math.hypot(target.x - initial.ship.x, target.y - initial.ship.y) >= initial.config.spawn.minPlayerDistance);
}
assert.deepEqual(create().targets, initial.targets, 'Spawns should reproduce with the same seed');

const spawnConfig = createGameConfig(defaultOptions);
spawnConfig.chaser.speed = 0; spawnConfig.shooter.speed = 0; spawnConfig.shooter.attackRange = 0;
const spawning = new NavigationSimulation(spawnConfig);
step(spawning, 4.9); assert.equal(spawning.targets.length, 2);
step(spawning, 0.1); assert.equal(spawning.targets.length, 3);
for (const target of spawning.targets) assert.ok(Math.hypot(target.x - spawning.ship.x, target.y - spawning.ship.y) >= spawnConfig.spawn.minPlayerDistance);

const chase = create();
chase.targets.splice(0, chase.targets.length, enemy('chaser', 640, 340));
step(chase, 1);
assert.equal(chase.ship.health, 75); assert.equal(chase.score, 0); assert.equal(chase.targets.length, 0);
step(chase, 1); assert.equal(chase.ship.health, 75, 'Destroyed Chaser must not damage twice');

const shooting = create();
shooting.config.shooter.speed = 0;
shooting.targets.splice(0, shooting.targets.length, enemy('shooter', 640, 200));
step(shooting, 0.02);
assert.equal(shooting.projectiles.filter(projectile => projectile.owner === 'enemy').length, 1);
step(shooting, 0.7); assert.equal(shooting.ship.health, 90);
assert.equal(shooting.projectiles.length, 0, 'Enemy projectile applies damage once');
step(shooting, 0.5); assert.equal(shooting.ship.health, 90, 'Shooter respects cooldown');

const combat = create();
combat.config.shooter.speed = 0; combat.config.shooter.attackRange = 0;
combat.targets.splice(0, combat.targets.length, enemy('shooter', 640, 190));
step(combat, 1.5, ['fireFront']); assert.equal(combat.score, 1); assert.equal(combat.targets.length, 0);
step(combat, 1, ['fireFront']); assert.equal(combat.score, 1);

const navigation = create();
navigation.ship.x = 640; navigation.ship.y = 275;
navigation.targets.splice(0, navigation.targets.length, enemy('chaser', 160, 275));
const blocked = (x: number, y: number, radius: number) => navigation.obstructed(x, y, radius);
const route = findRoute(navigation.targets[0]!, navigation.ship, 24, islands, blocked);
assert.ok(route.length > 1, 'Island detour needs waypoints');
let from = { x: 160, y: 275 };
for (const point of route) { assert.ok(clearPath(from, point, 24, blocked)); from = point; }
for (let frame = 0; frame < 12 * 120; frame++) {
  navigation.update(1 / 120, new Set());
  for (const target of navigation.targets) assert.equal(navigation.obstructed(target.x, target.y, target.radius), false);
  if (navigation.ship.health < 100) break;
}
assert.ok(navigation.ship.health < 100, 'Chaser should navigate around the island and reach the player');

const low = create(); low.ship.health = 30;
low.targets.splice(0, low.targets.length, enemy('chaser', 640, 370));
step(low, 0.01); assert.equal(low.ship.health, 5); assert.equal(low.sounds.filter(sound => sound === 'health_low').length, 1);
low.targets.push(enemy('chaser', 640, 370)); step(low, 0.01);
assert.equal(low.ship.health, 0); assert.equal(low.dead, true); assert.equal(low.score, 0);
const frozen = JSON.stringify({ ship: low.ship, targets: low.targets, projectiles: low.projectiles, score: low.score, cooldowns: low.cooldowns });
step(low, 10, ['forward', 'fireFront']);
assert.equal(JSON.stringify({ ship: low.ship, targets: low.targets, projectiles: low.projectiles, score: low.score, cooldowns: low.cooldowns }), frozen);
assert.equal(low.sounds.filter(sound => sound === 'game_over').length, 1);
assert.equal(create().ship.health, 100, 'New simulation restores player health');

const clockConfig = createGameConfig({ sessionSeconds: 60, spawnSeconds: 30 });
clockConfig.chaser.speed = 0; clockConfig.shooter.speed = 0; clockConfig.shooter.attackRange = 0;
const clock = new NavigationSimulation(clockConfig);
step(clock, 50);
assert.ok(Math.abs(clock.remainingSeconds - 10) < 1e-6);
assert.equal(clock.sounds.filter(sound => sound === 'time_warning').length, 1);
step(clock, 10);
assert.equal(clock.remainingSeconds, 0); assert.equal(clock.endedReason, 'time');
assert.equal(clock.sounds.filter(sound => sound === 'game_complete').length, 1);
const finished = JSON.stringify({ ship: clock.ship, targets: clock.targets, projectiles: clock.projectiles, score: clock.score, elapsed: clock.elapsedSeconds });
step(clock, 5, ['forward', 'fireFront']);
assert.equal(JSON.stringify({ ship: clock.ship, targets: clock.targets, projectiles: clock.projectiles, score: clock.score, elapsed: clock.elapsedSeconds }), finished);
assert.equal(new NavigationSimulation(clockConfig).remainingSeconds, 60);

const hulls = create();
hulls.config.shooter.speed = 0; hulls.config.shooter.attackRange = 0;
hulls.targets.splice(0, hulls.targets.length, enemy('shooter', 640, 300));
step(hulls, 1, ['forward']);
assert.ok(Math.hypot(hulls.ship.x - 640, hulls.ship.y - 300) >= hulls.config.player.radius + 24, 'Player must stop at the enemy hull');
assert.equal(hulls.ship.health, 100, 'Ordinary hull contact is physical, not Chaser damage');
const fleet = create(); fleet.config.shooter.attackRange = 0;
const first = enemy('shooter', 640, 160); first.id = 901;
const second = enemy('shooter', 640, 230); second.id = 902;
fleet.targets.splice(0, fleet.targets.length, first, second);
for (let frame = 0; frame < 120; frame++) {
  fleet.update(1 / 120, new Set());
  assert.ok(Math.hypot(first.x - second.x, first.y - second.y) >= first.radius + second.radius, 'Enemy hulls must not cross');
  for (const target of fleet.targets) assert.ok(Math.hypot(target.x - fleet.ship.x, target.y - fleet.ship.y) >= target.radius + fleet.config.player.radius);
}

for (const name of ['Kaere', 'João', 'Cassio', 'Captain123']) assert.equal(validateCaptainName(name), null);
const layouts = new Set<string>();
for (let seed = 0; seed < 100; seed++) {
  const config = createGameConfig(defaultOptions); config.spawn.seed = seed;
  const simulation = new NavigationSimulation(config);
  assert.equal(simulation.islands.length, 3);
  assert.equal(simulation.blocked(simulation.ship.x, simulation.ship.y), false);
  assert.deepEqual(new NavigationSimulation(config).islands, simulation.islands);
  for (const island of simulation.islands) {
    assert.ok(island.x >= config.terrain.edgeMargin && island.y >= config.terrain.edgeMargin);
    assert.ok(island.x + island.width <= config.arena.width - config.terrain.edgeMargin);
    assert.ok(island.y + island.height <= config.arena.height - config.terrain.edgeMargin);
    for (const other of simulation.islands) if (other !== island) assert.ok(island.x + island.width + config.terrain.islandGap <= other.x || other.x + other.width + config.terrain.islandGap <= island.x || island.y + island.height + config.terrain.islandGap <= other.y || other.y + other.height + config.terrain.islandGap <= island.y);
  }
  for (const enemy of simulation.targets) assert.equal(simulation.obstructed(enemy.x, enemy.y, enemy.radius), false);
  layouts.add(JSON.stringify(simulation.islands));
}
assert.ok(layouts.size > 90, 'New seeds should produce varied island layouts');
for (const name of ['', 'Captain1234', 'f_u_c_k', 'sh1t', '<script>', 'buceta']) assert.notEqual(validateCaptainName(name), null);
console.log('Simulation and name validation checks passed.');

const resultStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => resultStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { resultStorage.set(key, value); },
} });
assert.equal(loadMatchResult(), null);
const completed: MatchResult = { id: 'match-1', completedAt: '2026-10-07T12:00:00.000Z', score: 4, durationSeconds: 43.75, reason: 'death', config: createGameConfig(defaultOptions), captainName: 'Captain' };
assert.equal(saveMatchResult(completed), true);
assert.deepEqual(loadMatchResult(), completed);
assert.equal(saveMatchResult({ ...completed, captainName: 'Sailor' }), true);
assert.equal(resultStorage.size, 1, 'Updating a name must not duplicate the result');
assert.equal(loadMatchResult()?.id, completed.id);
assert.equal(loadMatchResult()?.captainName, 'Sailor');
assert.equal(isMatchResult({ ...completed, durationSeconds: 200 }), false);
assert.equal(isMatchResult({ ...completed, score: -1 }), false);
assert.equal(isMatchResult({ ...completed, captainName: 'fuck' }), false);
resultStorage.set('pirate-battle.last-result.v1', '{broken');
assert.equal(loadMatchResult(), null);
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: () => { throw new Error('Storage unavailable'); },
  setItem: () => { throw new Error('Storage unavailable'); },
} });
assert.equal(loadMatchResult(), null);
assert.equal(saveMatchResult(completed), false);
console.log('Result persistence checks passed.');
