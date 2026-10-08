import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getScenario, scenarioNames, setScenario, type Scenario } from './scenarios';
import { resetDatabase } from './database';
import { useRegistration } from '../records/RecordsProvider';
import { resetDemoRecords } from '../records/store';

// Opt-in diagnostics keep implementation controls out of normal player flows.
export function MockControls() {
  const [enabled] = useState(() => new URLSearchParams(location.search).get('mocks') === '1');
  const [scenario, select] = useState(getScenario);
  const [message, setMessage] = useState('');
  const client = useQueryClient();
  const { entries, retry } = useRegistration();
  if (!enabled) return null;
  return <details className="mock-controls">
    <summary>Network demo</summary>
    <label htmlFor="network-scenario">Scenario</label>
    <select id="network-scenario" value={scenario} onChange={event => {
      const next = event.target.value as Scenario;
      setScenario(next); select(next);
      void client.cancelQueries({ queryKey: ['records'] }).then(() => client.invalidateQueries({ queryKey: ['records'] }));
    }}>{scenarioNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
    <button onClick={() => entries.filter(entry => entry.status === 'failed').forEach(entry => retry(entry.request.match.id))}>Retry pending matches</button>
    <button disabled={entries.some(entry => entry.status === 'sending' || entry.status === 'pending')} onClick={() => {
      try { resetDatabase(); resetDemoRecords(); setScenario('success'); location.reload(); } catch { setMessage('Unable to restore mock data: storage is unavailable.'); }
    }}>Reset demo data</button>
    <small>Reset removes local match records and pending submissions. Game options are preserved.</small>
    <p role="status">{message}</p>
  </details>;
}
