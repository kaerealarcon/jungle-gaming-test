import { useEffect } from 'react';
import type { MatchResult } from './result';
import { useRegistration } from '../records/RecordsProvider';

export function ResultContent({ result, saved, onRestart, onBack }: { result: MatchResult; saved: boolean; onRestart: () => void; onBack: () => void }) {
  const { entries, submit, retry, storageError } = useRegistration();
  const registration = entries.find(entry => entry.request.match.id === result.id);
  useEffect(() => { document.getElementById('mission-title')?.focus(); }, [result.id]);
  useEffect(() => { submit(result); }, [result, submit]);
  const seconds = Math.floor(result.durationSeconds);
  return <>
    <h2 id="mission-title" tabIndex={-1}>{result.reason === 'time' ? 'Time Up' : 'Ship Lost'}</h2>
    <p id="mission-reason">{result.reason === 'time' ? 'The session time has ended. Your voyage is complete.' : 'Your hull reached zero health. Your voyage has ended.'}</p>
    <p className="mission-score" aria-label={`Score: ${result.score}`}>{result.score}</p>
    <p className="result-meta">Points · {Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')} · {result.reason === 'time' ? 'Time Up' : 'Ship Lost'}</p>
    {!saved && <p className="field-error" role="alert">Unable to save the local result. Your registration will still be attempted.</p>}
    <div className="registration-status" role="status">
      {registration?.status === 'confirmed' ? 'Match registered in Ranking and Match History.' : registration?.status === 'failed' ? registration.error : 'Registering your match… You can start another voyage.'}
      {registration?.status === 'failed' && <button className="asset-button secondary" onClick={() => retry(result.id)}>Try Again</button>}
      {storageError && <p className="field-error">Storage is unavailable. Pending matches may not survive a refresh.</p>}
    </div>
    <div className="menu-actions">
      <button className="asset-button primary" data-sound="close" onClick={onRestart}>Play Again</button>
      <button className="asset-button primary" data-sound="back" onClick={onBack}>Main Menu</button>
    </div>
  </>;
}
