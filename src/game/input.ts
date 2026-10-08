import type { GameAction } from './simulation';

const keys: Record<string, GameAction> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  Space: 'fireFront', KeyQ: 'fireLeft', KeyE: 'fireRight',
};

export class NavigationInput {
  private sources = new Map<string, GameAction>();
  readonly active = new Set<GameAction>();
  set(source: string, action: GameAction, pressed: boolean) {
    if (pressed) this.sources.set(source, action);
    else this.sources.delete(source);
    this.active.clear();
    for (const value of this.sources.values()) this.active.add(value);
  }
  clear() { this.sources.clear(); this.active.clear(); }
  bind(target: HTMLElement, enabled: () => boolean) {
    const down = (event: KeyboardEvent) => {
      const action = keys[event.code];
      if (!action || !enabled()) return;
      if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      this.set(event.code, action, true);
    };
    const up = (event: KeyboardEvent) => {
      const action = keys[event.code];
      if (action) this.set(event.code, action, false);
    };
    target.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { target.removeEventListener('keydown', down); window.removeEventListener('keyup', up); this.clear(); };
  }
}
