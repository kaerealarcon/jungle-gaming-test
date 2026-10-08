import { isMatchResult, type MatchResult } from '../player/result';
import type { RegisterMatchRequest } from './contracts';
import { loadCaptainName } from '../player/name';

export type RegistrationStatus = 'waiting-name' | 'pending' | 'sending' | 'failed' | 'confirmed';
export interface OutboxEntry { request: RegisterMatchRequest; status: RegistrationStatus; error?: string }
export interface RecordsState { playerId: string; entries: OutboxEntry[]; storageError: boolean }
const storageKey = 'pirate-battle.outbox.v1';
const identityKey = 'pirate-battle.player.v1';
const listeners = new Set<() => void>();
let state: RecordsState | undefined;

export function getRecordsState(): RecordsState {
  if (state) return state;
  let playerId: string = crypto.randomUUID();
  let entries: OutboxEntry[] = [];
  let storageError = false;
  try {
    playerId = localStorage.getItem(identityKey) || playerId;
    localStorage.setItem(identityKey, playerId);
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(stored)) entries = stored.filter((entry): entry is OutboxEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const value = entry as Partial<OutboxEntry>;
      return value.request?.playerId === playerId && isMatchResult(value.request.match) && ['waiting-name', 'pending', 'sending', 'failed', 'confirmed'].includes(value.status ?? '');
    }).map(entry => entry.status === 'waiting-name' ? {
      ...entry, request: { ...entry.request, match: { ...entry.request.match, captainName: loadCaptainName() } }, status: 'pending',
    } : { ...entry, status: entry.status === 'sending' ? 'pending' : entry.status });
  } catch { storageError = true; }
  state = { playerId, entries, storageError };
  return state;
}

function publish(entries: OutboxEntry[]) {
  const current = getRecordsState();
  let storageError = false;
  try { localStorage.setItem(storageKey, JSON.stringify(entries)); } catch { storageError = true; }
  state = { ...current, entries, storageError };
  listeners.forEach(listener => listener());
}

export function subscribeRecords(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

export function queueMatch(match: MatchResult): void {
  if (!isMatchResult(match)) return;
  const current = getRecordsState();
  const existing = current.entries.find(entry => entry.request.match.id === match.id);
  // Once dispatched, an idempotency key always retains the original payload.
  if (existing && existing.status !== 'waiting-name') return;
  const namedMatch = { ...structuredClone(match), captainName: loadCaptainName() };
  const next: OutboxEntry = { request: { playerId: current.playerId, match: namedMatch }, status: 'pending' };
  publish([...current.entries.filter(entry => entry.request.match.id !== match.id), next]);
}

export function updateRegistration(id: string, status: RegistrationStatus, error?: string): void {
  publish(getRecordsState().entries.map(entry => entry.request.match.id === id ? { ...entry, status, error } : entry));
}

export function retryRegistration(id: string): void { updateRegistration(id, 'pending'); }

export function resetDemoRecords(): void {
  localStorage.removeItem('pirate-battle.last-result.v1');
  localStorage.setItem(storageKey, '[]');
  state = { ...getRecordsState(), entries: [], storageError: false };
  listeners.forEach(listener => listener());
}

export function resetOutboxForTests(): void { state = undefined; }
