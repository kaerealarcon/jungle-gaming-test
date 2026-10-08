import axios from 'axios';
import { networkReady, recoverNetwork } from './network';
import type { Page, RankingEntry, RegisteredMatch, RegisterMatchRequest } from './contracts';
import { isMatchResult } from '../player/result';

export function isRecordsPage(value: unknown): value is Page<RegisteredMatch> {
  if (!value || typeof value !== 'object') return false;
  const page = value as Partial<Page<RegisteredMatch>>;
  return Array.isArray(page.items) && page.items.every(item => isMatchResult(item) && typeof (item as RegisteredMatch).playerId === 'string')
    && Number.isInteger(page.page) && Number(page.page) > 0
    && Number.isInteger(page.totalPages) && Number(page.totalPages) > 0
    && Number.isInteger(page.total) && Number(page.total) >= 0
    && Number.isInteger(page.pageSize) && Number(page.pageSize) > 0;
}

function parsePage<T extends RegisteredMatch>(value: unknown): Page<T> {
  if (!isRecordsPage(value)) throw new Error('The captain’s log returned an invalid response. Refresh this page and try again.');
  return value as Page<T>;
}

const http = axios.create({ baseURL: `${import.meta.env.BASE_URL}api`, timeout: 4000 });
async function ready() {
  if (!await networkReady()) throw new Error('The mock API could not start. Refresh this page to try again.');
}

async function readPage<T extends RegisteredMatch>(url: string, params: Record<string, string | number>, signal?: AbortSignal): Promise<Page<T>> {
  await ready();
  let data: unknown = (await http.get<unknown>(url, { params, signal })).data;
  // A stale/uncontrolled worker can let Vite's HTML fallback through as HTTP 200.
  // Re-enable interception once before surfacing a recoverable error.
  if (!isRecordsPage(data) && await recoverNetwork()) data = (await http.get<unknown>(url, { params, signal })).data;
  return parsePage<T>(data);
}
export const recordsApi = {
  async ranking(configuration: string, page: number, signal?: AbortSignal) {
    const result = await readPage<RankingEntry>('/ranking', { configuration, page }, signal);
    if (!result.items.every(item => Number.isInteger(item.rank) && item.rank > 0)) throw new Error('Invalid ranking positions.');
    return result;
  },
  async history(playerId: string, page: number, signal?: AbortSignal) {
    return readPage<RegisteredMatch>('/history', { playerId, page }, signal);
  },
  async register(request: RegisterMatchRequest) {
    await ready();
    const data: unknown = (await http.post<unknown>('/matches', request, { headers: { 'Idempotency-Key': request.match.id } })).data;
    if (!isMatchResult(data) || data.id !== request.match.id || (data as RegisteredMatch).playerId !== request.playerId) throw new Error('Invalid registration response. Your match is kept for retry.');
    return data as RegisteredMatch;
  },
};

export function canRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && !(axios.isAxiosError(error) && error.response && error.response.status < 500);
}
export function registrationError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'Request timed out. Your match is kept for retry.';
    if (error.response?.status && error.response.status < 500) return 'The request was rejected. Your match is kept on this device.';
  }
  return 'Unable to reach the captain’s log. Your match is kept for retry.';
}
