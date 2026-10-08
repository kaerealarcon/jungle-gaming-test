import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PlayerOptions } from '../game/config';
import { createGameConfig } from '../game/config';
import { captainDisplayName } from '../player/name';
import { configurationKey } from './contracts';
import { recordsApi, isRecordsPage } from './api';
import { useRegistration } from './RecordsProvider';
import star from '../../assets/png/retina/ui/hud/icon_score.png';
import left from '../../assets/png/retina/ui/controls/icon_turn_left.png';
import right from '../../assets/png/retina/ui/controls/icon_turn_right.png';
import type { OutboxEntry } from './store';

const date = (value: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value ?? '';
  return `${part('day')} ${part('month').slice(0, 3).toUpperCase()} · ${part('hour')}:${part('minute')}`;
};
const duration = (value: number) => `${Math.floor(value / 60).toString().padStart(2, '0')}:${Math.floor(value % 60).toString().padStart(2, '0')}`;

function PendingMatch({ entry }: { entry: OutboxEntry }) {
  const { retry } = useRegistration();
  const match = entry.request.match;
  return <li>
    <span>{date(match.completedAt)} · {match.score} points</span>
    <span>{entry.status === 'failed' ? entry.error : 'Registering…'}</span>
    {entry.status === 'failed' && <button className="asset-button secondary" onClick={() => retry(match.id)}>Try Again</button>}
  </li>;
}

export function RecordsScreen({ initialTab, options, onBack }: { initialTab: 'ranking' | 'history'; options: PlayerOptions; onBack: () => void }) {
  const [tab, setTab] = useState(initialTab);
  const [page, setPage] = useState(1);
  const heading = useRef<HTMLHeadingElement>(null);
  const { playerId, entries, storageError } = useRegistration();
  const key = configurationKey(createGameConfig(options));
  const ranking = useQuery({ queryKey: ['records', 'ranking', key, page], queryFn: ({ signal }) => recordsApi.ranking(key, page, signal), enabled: tab === 'ranking', staleTime: 0, refetchOnMount: 'always' });
  const history = useQuery({ queryKey: ['records', 'history', playerId, page], queryFn: ({ signal }) => recordsApi.history(playerId, page, signal), enabled: tab === 'history', staleTime: 0, refetchOnMount: 'always' });
  const query = tab === 'ranking' ? ranking : history;
  const validData = isRecordsPage(query.data);
  useEffect(() => {
    if (!query.isFetching && query.data && query.data.page !== page) setPage(query.data.page);
  }, [query.isFetching, query.data, page]);
  const pending = entries.filter(entry => entry.status !== 'confirmed');
  useEffect(() => { heading.current?.focus(); }, []);
  function select(next: 'ranking' | 'history') { setTab(next); setPage(1); }
  return <>
    <h2 id="records-title" ref={heading} tabIndex={-1}>{tab === 'history' ? captainDisplayName : 'Captain’s Log'}</h2>
    <div className="log-tabs" role="tablist" aria-label="Captain’s log" onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'ranking' : event.key === 'End' ? 'history' : tab === 'ranking' ? 'history' : 'ranking'; select(next); document.getElementById(`tab-${next}`)?.focus(); }
    }}>
      <button id="tab-ranking" className={`asset-button ${tab === 'ranking' ? 'primary' : 'secondary'}`} role="tab" aria-selected={tab === 'ranking'} aria-controls="log-panel" tabIndex={tab === 'ranking' ? 0 : -1} onClick={() => select('ranking')}>Ranking</button>
      <button id="tab-history" className={`asset-button ${tab === 'history' ? 'primary' : 'secondary'}`} role="tab" aria-selected={tab === 'history'} aria-controls="log-panel" tabIndex={tab === 'history' ? 0 : -1} onClick={() => select('history')}>Match History</button>
    </div>
    <p className="log-description">{tab === 'ranking' ? `${options.sessionSeconds} second battles · ${options.spawnSeconds} second spawn interval` : 'Your recent battles'}</p>
    <section id="log-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} aria-busy={query.isFetching}>
      <div className="log-status" role="status">{query.isFetching && !query.isPending ? 'Updating…' : ''}</div>
      {query.isError && validData && <p className="field-error" role="alert">Unable to update. Showing the last loaded battles. <button onClick={() => void query.refetch()}>Retry</button></p>}
      {query.isPending ? <div className="log-empty" role="status">Loading battles…</div> : !validData ? <div className="log-empty" role="alert"><p>Unable to load {tab === 'ranking' ? 'the ranking' : 'your match history'}.</p><button className="asset-button secondary" onClick={() => void query.refetch()}>Try Again</button></div> : query.data?.total === 0 ? <div className="log-empty"><p>{tab === 'ranking' ? 'No battles with this configuration yet.' : 'Your completed battles will appear here.'}</p></div> : <>
        <div className="log-table-wrap"><table className={`log-table log-table-${tab}`}>
          <thead><tr>{(tab === 'ranking' ? ['Rank', 'Captain', 'Points', 'Played'] : ['Date', 'Points', 'Duration', 'Result']).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{tab === 'ranking' ? ranking.data?.items?.map(item => <tr key={item.id} className={item.playerId === playerId ? 'is-you' : ''}>
            <td>{item.rank.toString().padStart(2, '0')}</td><td>{item.rank === 1 && <img className="rank-star" src={star} alt="First place" />}{item.captainName}{item.playerId === playerId && <span className="you-badge">You</span>}</td><td>{item.score}</td><td><time dateTime={item.completedAt}>{date(item.completedAt)}</time></td>
          </tr>) : history.data?.items?.map((item, index) => <tr key={item.id} className={page === 1 && index === 0 ? 'is-you' : ''}>
            <td><time dateTime={item.completedAt}>{date(item.completedAt)}</time></td><td>{item.score}</td><td>{duration(item.durationSeconds)}</td><td className={item.reason === 'time' ? 'result-time' : 'result-death'}>{item.reason === 'time' ? 'Time Up' : 'Defeated'}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
      <nav className="log-pagination" aria-label="Battle pages">
        <button className="asset-button round-button" aria-label="Previous page" disabled={!query.data || query.data.page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}><img src={left} alt="" /></button>
        <span>Page {query.data?.page ?? page} of {query.data?.totalPages ?? 1}</span>
        <button className="asset-button round-button" aria-label="Next page" disabled={!query.data || query.data.page >= query.data.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}><img src={right} alt="" /></button>
      </nav>
    </section>
    {pending.length > 0 && <details className="pending-matches"><summary>{pending.length} {pending.length === 1 ? 'match' : 'matches'} awaiting registration</summary><ul>{pending.map(entry => <PendingMatch key={entry.request.match.id} entry={entry} />)}</ul></details>}
    {storageError && <p className="field-error" role="alert">Storage is unavailable. Pending matches may not survive a refresh.</p>}
    <button className="asset-button primary log-back" data-sound="back" onClick={onBack}>Main Menu</button>
  </>;
}
