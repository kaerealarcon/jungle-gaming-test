export interface PlayerOptions {
  sessionSeconds: number;
  spawnSeconds: number;
}

export const optionLimits = {
  sessionSeconds: { min: 60, max: 180 },
  spawnSeconds: { min: 1, max: 30 },
} as const;

export const defaultOptions: Readonly<PlayerOptions> = {
  sessionSeconds: 120,
  spawnSeconds: 5,
};

export function isValidOptions(value: unknown): value is PlayerOptions {
  if (typeof value !== "object" || value === null) return false;
  const options = value as Partial<PlayerOptions>;
  return Object.entries(optionLimits).every(([key, limits]) => {
    const number = options[key as keyof PlayerOptions];
    return (
      typeof number === "number" &&
      Number.isInteger(number) &&
      number >= limits.min &&
      number <= limits.max
    );
  });
}

interface ShipConfig {
  health: number;
  speed: number;
  rotationSpeed: number;
  radius: number;
}

interface WeaponConfig {
  damage: number;
  speed: number;
  lifetimeSeconds: number;
  range: number;
  cooldownSeconds: number;
  projectileRadius: number;
  muzzleDistance: number;
}

export interface GameConfig {
  sessionSeconds: number;
  arena: { width: number; height: number };
  terrain: { edgeMargin: number; islandGap: number; playerClearance: number; attempts: number };
  spawn: {
    intervalSeconds: number;
    chaserProbability: number;
    minPlayerDistance: number;
    seed: number;
    attempts: number;
    clearance: number;
    graceSeconds: number;
  };
  player: ShipConfig & { coastSeconds: number; accelerationSeconds: number };
  chaser: ShipConfig & { impactDamage: number };
  shooter: ShipConfig & { attackRange: number };
  weapons: {
    front: WeaponConfig;
    broadside: WeaponConfig;
    enemy: WeaponConfig;
  };
  combat: {
    broadsideSpacing: number;
    impactSeconds: number;
    explosionSeconds: number;
    trainingHealth: number;
  };
  ai: {
    pathRefreshSeconds: number;
    waypointDistance: number;
    aimTolerance: number;
    stoppingRangeRatio: number;
  };
}

const balance: Omit<GameConfig, "sessionSeconds" | "spawn"> = {
  arena: { width: 1280, height: 800 },
  terrain: { edgeMargin: 80, islandGap: 100, playerClearance: 110, attempts: 500 },
  player: {
    health: 100,
    speed: 180,
    rotationSpeed: 2.4,
    radius: 34,
    coastSeconds: 0.65,
    accelerationSeconds: 0.4,
  },
  chaser: {
    health: 40,
    speed: 110,
    rotationSpeed: 1.8,
    radius: 34,
    impactDamage: 25,
  },
  shooter: {
    health: 60,
    speed: 85,
    rotationSpeed: 1.5,
    radius: 34,
    attackRange: 350,
  },
  weapons: {
    front: {
      damage: 20,
      speed: 420,
      lifetimeSeconds: 1.5,
      range: 630,
      cooldownSeconds: 0.4,
      projectileRadius: 5,
      muzzleDistance: 38,
    },
    broadside: {
      damage: 15,
      speed: 360,
      lifetimeSeconds: 1.3,
      range: 468,
      cooldownSeconds: 1,
      projectileRadius: 5,
      muzzleDistance: 28,
    },
    enemy: {
      damage: 10,
      speed: 260,
      lifetimeSeconds: 2,
      range: 520,
      cooldownSeconds: 1.5,
      projectileRadius: 5,
      muzzleDistance: 38,
    },
  },
  combat: {
    broadsideSpacing: 18,
    impactSeconds: 0.2,
    explosionSeconds: 0.55,
    trainingHealth: 60,
  },
  ai: {
    pathRefreshSeconds: 0.5,
    waypointDistance: 18,
    aimTolerance: 0.18,
    stoppingRangeRatio: 0.75,
  },
};

// Each match receives an independent copy; later option changes cannot affect it.
export function createGameConfig(options: PlayerOptions): GameConfig {
  if (!isValidOptions(options)) throw new Error("Invalid game options.");
  return {
    ...structuredClone(balance),
    sessionSeconds: options.sessionSeconds,
    spawn: {
      intervalSeconds: options.spawnSeconds,
      chaserProbability: 0.5,
      minPlayerDistance: 260,
      seed: 7331,
      attempts: 60,
      clearance: 24,
      graceSeconds: 0.8,
    },
  };
}
