import { useEffect, useRef, useState } from 'react';
import { SoundManager } from './audio/SoundManager';
import { Options } from './options/Options';
import { loadOptions, saveOptions } from './options/storage';
import { createGameConfig, type GameConfig, type PlayerOptions } from './game/config';
import { Arena } from './game/Arena';
import { RecordsScreen } from './records/RecordsScreen';
import { MockControls } from './mocks/MockControls';
import title from '../assets/png/retina/ui/menu/title_pirate_battle.png';
import ship from '../assets/png/retina/ships/ship_2.png';
import logo from '../assets/logo_jungle_gaming.svg';

export function App() {
  const [screen, setScreen] = useState<'menu' | 'options' | 'arena' | 'ranking' | 'history'>('menu');
  const [matchConfig, setMatchConfig] = useState<GameConfig | null>(null);
  const [options, setOptions] = useState(loadOptions);
  const optionsButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const [audio] = useState(() => new SoundManager());
  useEffect(() => () => audio.dispose(), [audio]);

  function storeOptions(nextOptions: PlayerOptions) {
    if (!saveOptions(nextOptions)) return false;
    setOptions({ ...nextOptions });
    return true;
  }

  function persistOptions(nextOptions: PlayerOptions) {
    if (!storeOptions(nextOptions)) return false;
    audio.play('ui_back', 0.35);
    returnFocus.current = true;
    setScreen('menu');
    return true;
  }

  return (
    <div className={`app-shell${screen === 'arena' ? ' is-playing' : ''}`}
      onPointerDownCapture={() => audio.unlock()} onKeyDownCapture={() => audio.unlock()}
      onClickCapture={event => {
        const button = (event.target as HTMLElement).closest('button');
        if (!button || button.disabled || button.classList.contains('steering-button') || button.dataset.sound === 'none') return;
        audio.unlock();
        audio.play(button.dataset.sound === 'open' ? 'ui_open' : button.dataset.sound === 'back' ? 'ui_back' : button.dataset.sound === 'close' ? 'ui_close' : 'ui_click', 0.35);
      }}
      onPointerOver={event => {
        const button = (event.target as HTMLElement).closest('button');
        if (event.pointerType === 'mouse' && button && !button.disabled && !button.classList.contains('steering-button') && !(event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) audio.play('ui_hover', 0.15);
      }}>
      {screen === 'arena' && matchConfig ? <Arena config={matchConfig} audio={audio} options={options} onSaveOptions={storeOptions} onNewMatch={() => setMatchConfig(createGameConfig(options))} onBack={() => { setScreen('menu'); setMatchConfig(null); returnFocus.current = true; }} /> : <>
      <a className="skip-link" href={screen === 'ranking' || screen === 'history' ? '#records-title' : screen === 'menu' ? '#game-title' : '#options-title'}>Skip to content</a>
      <main className={`menu${screen === 'options' ? ' menu-options' : screen === 'ranking' || screen === 'history' ? ' menu-log' : ''}`} aria-labelledby={screen === 'ranking' || screen === 'history' ? 'records-title' : screen === 'options' ? 'options-title' : 'game-title'}>
        <header>
          <h1 id="game-title"><img className="game-title" src={title} alt="Pirate Battle" /></h1>
          <p className="eyebrow">Set sail. Take command.</p>
        </header>
        {screen === 'ranking' || screen === 'history' ? <RecordsScreen initialTab={screen} options={options} onBack={() => { returnFocus.current = true; setScreen('menu'); }} /> : screen === 'options' ? <Options options={options} onSave={persistOptions} /> : <>
        <div className="menu-actions">
          <button className="asset-button primary" onClick={() => { setMatchConfig(createGameConfig(options)); setScreen('arena'); }}>Play</button>
          <button className="asset-button primary" ref={element => {
            optionsButton.current = element;
            if (element && returnFocus.current) {
              element.focus();
              returnFocus.current = false;
            }
          }} data-sound="open" onClick={() => setScreen('options')}>Options</button>
        </div>
        <div className="ship-intro">
          <img src={ship} alt="" width="44" height="76" />
          <p>Navigate the islands. Survive the battle.</p>
        </div>
        <nav className="records" aria-label="Player records">
          <button className="asset-button secondary" data-sound="open" onClick={() => setScreen('ranking')}>Ranking</button>
          <button className="asset-button secondary" data-sound="open" onClick={() => setScreen('history')}>Match History</button>
        </nav>
        </>}
      </main>
      </>}
      {screen !== 'arena' && <footer><img src={logo} alt="Jungle Gaming" /><span>Naval survival · Single player</span></footer>}
      <MockControls />
    </div>
  );
}
