import { defaultOptions, isValidOptions, type PlayerOptions } from '../game/config';

const storageKey = 'pirate-battle.options.v1';

export function loadOptions(): PlayerOptions {
  try {
    const raw = localStorage.getItem(storageKey);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (isValidOptions(value)) return { sessionSeconds: value.sessionSeconds, spawnSeconds: value.spawnSeconds };
  } catch {
    // Unavailable storage or malformed saved data must not block the menu.
  }
  return { ...defaultOptions };
}

export function saveOptions(options: PlayerOptions): boolean {
  if (!isValidOptions(options)) return false;
  try {
    localStorage.setItem(storageKey, JSON.stringify(options));
    return true;
  } catch {
    return false;
  }
}
