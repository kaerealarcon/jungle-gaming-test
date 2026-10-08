import { useEffect, useRef, useState, type FormEvent } from 'react';
import { optionLimits, type PlayerOptions } from '../game/config';
import { AssetIcon } from '../ui/AssetIcon';

interface OptionsProps {
  options: PlayerOptions;
  onSave: (options: PlayerOptions) => boolean;
  returnLabel?: string;
}

export function Options({ options, onSave, returnLabel = 'Main Menu' }: OptionsProps) {
  const [session, setSession] = useState(String(options.sessionSeconds));
  const [spawn, setSpawn] = useState(String(options.spawnSeconds));
  const [errors, setErrors] = useState<Partial<Record<keyof PlayerOptions, string>>>({});
  const [message, setMessage] = useState('');
  const sessionInput = useRef<HTMLInputElement>(null);
  const spawnInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = { sessionSeconds: Number(session), spawnSeconds: Number(spawn) };
    const nextErrors: typeof errors = {};
    for (const key of ['sessionSeconds', 'spawnSeconds'] as const) {
      const { min, max } = optionLimits[key];
      if (!Number.isInteger(values[key]) || values[key] < min || values[key] > max) {
        nextErrors[key] = `Enter a whole number between ${min} and ${max} seconds.`;
      }
    }
    setErrors(nextErrors);
    setMessage('');
    if (nextErrors.sessionSeconds || nextErrors.spawnSeconds) {
      (nextErrors.sessionSeconds ? sessionInput : spawnInput).current?.focus();
      return;
    }
    if (!onSave(values)) setMessage('Unable to save options. Check browser storage permissions and try again.');
  }

  return (
    <section className="options" aria-labelledby="options-title">
      <h2 id="options-title" tabIndex={-1} ref={heading}>Options</h2>
      <form onSubmit={submit} noValidate>
        <div className="option-field">
          <label htmlFor="session">Game session time</label>
          <div className="option-stepper">
          <button type="button" className="asset-button round-button" aria-label="Decrease session time" disabled={Number(session) <= 60} onClick={() => { setSession(String(Math.max(60, Math.min(180, (Number(session) || 120) - 10)))); setMessage(''); }}><AssetIcon name="minus" /></button>
          <input ref={sessionInput} id="session" type="number" inputMode="numeric" min={60} max={180} step={1} required value={session}
            onChange={event => { setSession(event.target.value); setMessage(''); }}
            aria-invalid={Boolean(errors.sessionSeconds)} aria-describedby="session-error" />
          <button type="button" className="asset-button round-button" aria-label="Increase session time" disabled={Number(session) >= 180} onClick={() => { setSession(String(Math.max(60, Math.min(180, (Number(session) || 120) + 10)))); setMessage(''); }}><AssetIcon name="plus" /></button>
          </div>
          <p className="field-error" id="session-error">{errors.sessionSeconds}</p>
        </div>
        <div className="option-field">
          <label htmlFor="spawn">Enemy spawn time</label>
          <div className="option-stepper">
          <button type="button" className="asset-button round-button" aria-label="Decrease spawn time" disabled={Number(spawn) <= 1} onClick={() => { setSpawn(String(Math.max(1, Math.min(30, (Number(spawn) || 5) - 1)))); setMessage(''); }}><AssetIcon name="minus" /></button>
          <input ref={spawnInput} id="spawn" type="number" inputMode="numeric" min={1} max={30} step={1} required value={spawn}
            onChange={event => { setSpawn(event.target.value); setMessage(''); }}
            aria-invalid={Boolean(errors.spawnSeconds)} aria-describedby="spawn-error" />
          <button type="button" className="asset-button round-button" aria-label="Increase spawn time" disabled={Number(spawn) >= 30} onClick={() => { setSpawn(String(Math.max(1, Math.min(30, (Number(spawn) || 5) + 1)))); setMessage(''); }}><AssetIcon name="plus" /></button>
          </div>
          <p className="field-error" id="spawn-error">{errors.spawnSeconds}</p>
        </div>
        <p className="save-status" role="status">{message}</p>
        <div className="menu-actions">
          <button type="submit" className="asset-button primary" data-sound="back">{returnLabel}</button>
        </div>
      </form>
    </section>
  );
}
