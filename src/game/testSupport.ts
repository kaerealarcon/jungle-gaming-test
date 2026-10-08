import type { NavigationSimulation } from './simulation';

declare global {
  interface Window {
    __pirateSetup?: { seed: number; manualTime: boolean };
    __pirateTest?: {
      snapshot: () => ReturnType<typeof snapshot>;
      advance: (seconds: number) => void;
    };
  }
}

export function arenaSeed() {
  const seed = import.meta.env.MODE === 'profile' ? window.__pirateProfileSeed : undefined;
  if (seed !== undefined) return seed >>> 0;
  return import.meta.env.MODE === 'e2e' && window.__pirateSetup
    ? window.__pirateSetup.seed >>> 0 : crypto.getRandomValues(new Uint32Array(1))[0]!;
}

export function snapshot(simulation: NavigationSimulation, paused: boolean) {
  return structuredClone({ config: simulation.config, islands: simulation.islands,
    ship: simulation.ship, enemies: simulation.targets, projectiles: simulation.projectiles, effects: simulation.effects,
    cooldowns: simulation.cooldowns, elapsed: simulation.elapsedSeconds,
    score: simulation.score, endedReason: simulation.endedReason, paused });
}

export function attachTestSupport(simulation: NavigationSimulation, paused: () => boolean, frame: (seconds: number) => void) {
  if (import.meta.env.MODE !== 'e2e' || !window.__pirateSetup) return () => {};
  const bridge = {
    snapshot: () => snapshot(simulation, paused()),
    advance: (seconds: number) => {
      if (!window.__pirateSetup?.manualTime || !Number.isFinite(seconds) || seconds < 0 || seconds > 180) throw new Error('Invalid manual time advance');
      // Exercise the same update/render path with the normal maximum frame step.
      for (let remaining = seconds; remaining > 1e-9; remaining -= 0.05) frame(Math.min(remaining, 0.05));
    },
  };
  window.__pirateTest = bridge;
  return () => { if (window.__pirateTest === bridge) delete window.__pirateTest; };
}
