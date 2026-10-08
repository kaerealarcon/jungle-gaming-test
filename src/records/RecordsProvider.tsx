import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import { recordsApi, canRetry, registrationError } from './api';
import { getRecordsState, subscribeRecords, queueMatch, retryRegistration, updateRegistration } from './store';
import { loadMatchResult, type MatchResult } from '../player/result';
import type { RegisterMatchRequest } from './contracts';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, gcTime: 300000, retry: canRetry, retryDelay: 500, refetchOnWindowFocus: true }, mutations: { retry: canRetry, retryDelay: 500 } } });
interface RegistrationActions { submit: (match: MatchResult) => void; retry: (id: string) => void }
const RegistrationContext = createContext<RegistrationActions | null>(null);

function RegistrationManager({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeRecords, getRecordsState);
  const queryClient = useQueryClient();
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    // Recover a saved receipt independently of the initial screen.
    const result = loadMatchResult();
    if (result) queueMatch(result);
  }, []);
  const mutation = useMutation({
    mutationKey: ['register-match'],
    mutationFn: (request: RegisterMatchRequest) => recordsApi.register(request),
    onSuccess: async (_, request) => {
      // Cancel stale reads first so a delayed pre-registration snapshot cannot replace fresh data.
      await queryClient.cancelQueries({ queryKey: ['records'] });
      updateRegistration(request.match.id, 'confirmed');
      await queryClient.invalidateQueries({ queryKey: ['records'] });
    },
    onError: (error, request) => updateRegistration(request.match.id, 'failed', registrationError(error)),
  });
  const dispatch = mutation.mutateAsync;
  useEffect(() => {
    for (const entry of state.entries) {
      const id = entry.request.match.id;
      if (entry.status !== 'pending' || inFlight.current.has(id)) continue;
      inFlight.current.add(id);
      updateRegistration(id, 'sending');
      void dispatch(entry.request).catch(() => { /* Mutation callbacks preserve failed entries. */ }).finally(() => inFlight.current.delete(id));
    }
  }, [state, dispatch]);
  useEffect(() => {
    let active = true;
    const confirmed = getRecordsState().entries.filter(entry => entry.status === 'confirmed');
    async function reconcile() {
      if (!confirmed.length) return;
      try {
        const fetchPage = (page: number) => queryClient.fetchQuery({ queryKey: ['records', 'history', state.playerId, page], queryFn: ({ signal }) => recordsApi.history(state.playerId, page, signal), staleTime: 0 });
        const first = await fetchPage(1);
        const ids = new Set(first.items.map(item => item.id));
        for (let page = 2; page <= first.totalPages; page++) {
          if (!active) return;
          (await fetchPage(page)).items.forEach(item => ids.add(item.id));
        }
        if (!active) return;
        // Older builds could acknowledge an HTML fallback as a successful POST.
        // Replay only absent confirmations, retaining the original idempotency key.
        for (const entry of confirmed) {
          if (!ids.has(entry.request.match.id) && getRecordsState().entries.find(current => current.request.match.id === entry.request.match.id)?.status === 'confirmed') retryRegistration(entry.request.match.id);
        }
      } catch { /* Unavailable history does not discard durable receipts or block play. */ }
    }
    void reconcile();
    return () => { active = false; };
  }, [queryClient, state.playerId, state.entries]);
  useEffect(() => {
    const reconnect = () => getRecordsState().entries.filter(entry => entry.status === 'failed').forEach(entry => retryRegistration(entry.request.match.id));
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, []);
  const submit = useCallback((match: MatchResult) => queueMatch(match), []);
  const retry = useCallback((id: string) => retryRegistration(id), []);
  return <RegistrationContext.Provider value={{ submit, retry }}>{children}</RegistrationContext.Provider>;
}

export function RecordsProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}><RegistrationManager>{children}</RegistrationManager></QueryClientProvider>;
}
export function useRegistration() {
  const actions = useContext(RegistrationContext);
  if (!actions) throw new Error('RecordsProvider is missing.');
  const state = useSyncExternalStore(subscribeRecords, getRecordsState);
  return { ...state, ...actions };
}
