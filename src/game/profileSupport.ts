import type { NavigationSimulation } from './simulation';
import { snapshot } from './testSupport';
import { Assets, type Texture } from 'pixi.js';
import tilesUrl from '../../assets/tilesheet/tiles_sheet.png';

interface Counts { ships: number; projectiles: number; effects: number }
interface Sample extends Counts { elapsed: number }
interface Measurement {
  config: NavigationSimulation['config'];
  intervals: number[];
  updateTimes: number[];
  samples: Sample[];
  elapsed: number;
  reason: string | null;
  peaks: Counts;
}
declare global {
  interface Window {
    __pirateProfileSeed?: number;
    __pirateProfile?: {
      state: () => ReturnType<typeof snapshot> | null;
      measurements: () => Measurement[];
      resources: () => { activeScenes: number; retainedSimulations: number; atlasResizeListeners: number; audioBuffers: number; audioSources: number; audioLoops: number };
    };
  }
}

const completed: Measurement[] = [];
const simulations: WeakRef<NavigationSimulation>[] = [];
const retainedSimulations = () => simulations.filter(reference => reference.deref() !== undefined).length;
const atlasResizeListeners = () => Assets.get<Texture>(tilesUrl)?.source.listenerCount('resize') ?? 0;
function publishCompleted(audio: () => { audioBuffers: number; audioSources: number; audioLoops: number }) {
  window.__pirateProfile = { state: () => null, measurements: () => structuredClone(completed), resources: () => ({ activeScenes: 0, retainedSimulations: retainedSimulations(), atlasResizeListeners: atlasResizeListeners(), ...audio() }) };
}
export function attachPerformanceSupport(simulation: NavigationSimulation, paused: () => boolean,
  audio: () => { audioBuffers: number; audioSources: number; audioLoops: number }) {
  if (import.meta.env.MODE !== 'profile') return { record: () => {}, dispose: () => {} };
  simulations.push(new WeakRef(simulation));
  const measurement: Measurement = { config: structuredClone(simulation.config), intervals: [], updateTimes: [], samples: [], elapsed: 0, reason: null, peaks: { ships: 0, projectiles: 0, effects: 0 } };
  let active = true;
  let previousTime: number | undefined;
  let sampleAt = -1;
  window.__pirateProfile = {
    state: () => active ? snapshot(simulation, paused()) : null,
    measurements: () => structuredClone([...completed, ...(active ? [measurement] : [])]),
    resources: () => ({ activeScenes: active ? 1 : 0, retainedSimulations: retainedSimulations(), atlasResizeListeners: atlasResizeListeners(), ...audio() }),
  };
  return {
    record: (updateTime: number) => {
      const now = performance.now();
      if (!paused()) {
        if (previousTime !== undefined) measurement.intervals.push(now - previousTime);
        measurement.updateTimes.push(updateTime);
        previousTime = now;
        const elapsed = simulation.elapsedSeconds;
        const counts = { ships: Number(!simulation.dead) + simulation.targets.filter(target => target.health > 0).length,
          projectiles: simulation.projectiles.length, effects: simulation.effects.length };
        for (const key of ['ships', 'projectiles', 'effects'] as const) measurement.peaks[key] = Math.max(measurement.peaks[key], counts[key]);
        if (Math.floor(elapsed) !== sampleAt) {
          sampleAt = Math.floor(elapsed);
          measurement.samples.push({ elapsed, ...counts });
        }
      } else previousTime = undefined;
      measurement.elapsed = simulation.elapsedSeconds;
      measurement.reason = simulation.endedReason;
    },
    dispose: () => {
      active = false;
      completed.push(measurement);
      // Replace the observer closures so archived numbers retain no scene/simulation.
      publishCompleted(audio);
    },
  };
}
