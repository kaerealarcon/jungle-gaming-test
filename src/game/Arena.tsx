import { useEffect, useRef, useState } from 'react';
import { arenaSeed, attachTestSupport } from './testSupport';
import { attachPerformanceSupport } from './profileSupport';
import { Application, Assets, Container, Graphics, Rectangle, RenderTexture, Sprite, Texture, TilingSprite } from 'pixi.js';
import shipUrl from '../../assets/png/retina/ships/ship_1.png';
import tilesUrl from '../../assets/tilesheet/tiles_sheet.png';
import ballUrl from '../../assets/png/retina/ship_parts/cannon_ball.png';
import explosionUrl from '../../assets/png/retina/effects/explosion_1.png';
import fireUrl from '../../assets/png/retina/effects/fire_1.png';
import targetUrl from '../../assets/png/retina/ships/ship_5.png';
import titleUrl from '../../assets/png/retina/ui/menu/title_pirate_battle.png';
import heartUrl from '../../assets/png/retina/ui/hud/icon_heart.png';
import scoreUrl from '../../assets/png/retina/ui/hud/icon_score.png';
import timeUrl from '../../assets/png/retina/ui/hud/icon_time.png';
import hudHealthFrame from '../../assets/png/retina/ui/hud/health_frame.png';
import hudHealthGreen from '../../assets/png/retina/ui/hud/health_fill_green.png';
import hudHealthAmber from '../../assets/png/retina/ui/hud/health_fill_amber.png';
import hudHealthRed from '../../assets/png/retina/ui/hud/health_fill_red.png';
import forwardIcon from '../../assets/png/retina/ui/controls/icon_forward.png';
import leftIcon from '../../assets/png/retina/ui/controls/icon_turn_left.png';
import rightIcon from '../../assets/png/retina/ui/controls/icon_turn_right.png';
import frontIcon from '../../assets/png/retina/ui/controls/icon_fire_front.png';
import portIcon from '../../assets/png/retina/ui/controls/icon_fire_left.png';
import starboardIcon from '../../assets/png/retina/ui/controls/icon_fire_right.png';
import type { GameConfig, PlayerOptions } from './config';
import { Options } from '../options/Options';
import { WakeTrail } from './WakeTrail';
import type { SoundManager } from '../audio/SoundManager';
import { NavigationInput } from './input';
import { NavigationSimulation, type GameAction, type Enemy } from './simulation';
import { AssetIcon } from '../ui/AssetIcon';
import { HealthBar } from './HealthBar';
import { combatVisuals, visualAsset } from './visualAssets';
import { loadCaptainName } from '../player/name';
import { saveMatchResult, type MatchResult } from '../player/result';
import { ResultContent } from '../player/ResultContent';
import { queueMatch } from '../records/store';

export function Arena({ config, onBack, audio, options, onSaveOptions, onNewMatch }: { config: GameConfig; onBack: () => void; audio: SoundManager; options: PlayerOptions; onSaveOptions: (options: PlayerOptions) => boolean; onNewMatch: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const context = useRef<HTMLElement>(null);
  const input = useRef(new NavigationInput());
  const paused = useRef(false);
  const [isPaused, setPaused] = useState(false);
  const [pauseOptions, setPauseOptions] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [layoutSeed, setLayoutSeed] = useState(arenaSeed);
  const [score, setScore] = useState(0);
  const [hull, setHull] = useState(config.player.health);
  const [enemyCount, setEnemyCount] = useState(2);
  const [isDead, setDead] = useState(false);
  const [remaining, setRemaining] = useState(config.sessionSeconds);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [resultSaved, setResultSaved] = useState(false);
  const completeDialog = useRef<HTMLDialogElement>(null);
  const pauseDialog = useRef<HTMLDialogElement>(null);
  const icons: Record<GameAction, string> = { forward: forwardIcon, left: leftIcon, right: rightIcon, fireFront: frontIcon, fireLeft: portIcon, fireRight: starboardIcon };

  useEffect(() => {
    if (isDead) {
      pauseDialog.current?.close();
      completeDialog.current?.showModal();
      completeDialog.current?.querySelector<HTMLElement>('#mission-title')?.focus();
    }
    else completeDialog.current?.close();
  }, [isDead]);

  useEffect(() => {
    if (status === 'ready' && isPaused && !isDead) pauseDialog.current?.showModal();
    else pauseDialog.current?.close();
  }, [status, isPaused, isDead]);

  function restart() {
    onNewMatch();
    setPauseOptions(false);
    setLayoutSeed(arenaSeed());
    input.current.clear();
    paused.current = false;
    setPaused(false);
    setScore(0);
    setHull(config.player.health);
    setEnemyCount(2);
    setDead(false);
    setResult(null);
    setRemaining(options.sessionSeconds);
    setStatus('loading');
    setProgress(0);
    setAttempt(value => value + 1);
  }

  function pause() { if (!paused.current) { audio.stop(); audio.play('game_pause'); } paused.current = true; input.current.clear(); setPaused(true); }
  function resume() { audio.unlock(); audio.play('game_resume'); input.current.clear(); paused.current = false; setPauseOptions(false); setPaused(false); context.current?.focus(); }

  useEffect(() => {
    const element = host.current;
    const section = context.current;
    if (!element || !section) return;
    let disposed = false;
    let detachTest = () => {};
    let detachProfile = () => {};
    let app: Application | undefined;
    let observer: ResizeObserver | undefined;
    let grassSurface: RenderTexture | undefined;
    const ownedTextures = new Set<Texture>();
    const releaseTextures = () => { for (const texture of ownedTextures) texture.destroy(false); ownedTextures.clear(); };
    let unbind: (() => void) | undefined;
    const controls = input.current;
    paused.current = false;
    const simulation = new NavigationSimulation({ ...config, spawn: { ...config.spawn, seed: layoutSeed } });
    const blur = () => { audio.stop(); paused.current = true; controls.clear(); if (!disposed) setPaused(true); };
    const visibility = () => { if (document.hidden) blur(); };
    const escape = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { event.preventDefault(); if (!paused.current) { audio.stop(); audio.play('game_pause'); } paused.current = true; controls.clear(); setPaused(true); }
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    section.addEventListener('keydown', escape);

    async function start() {
      try {
        const textures = await Assets.load<Texture>([shipUrl, tilesUrl, ballUrl, explosionUrl, fireUrl, targetUrl, ...combatVisuals], value => { if (!disposed) setProgress(Math.round(value * 100)); });
        if (disposed) return;
        app = new Application();
        await app.init({ width: config.arena.width, height: config.arena.height, background: '#258ba3', resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, antialias: true, preference: 'webgl' });
        if (disposed) { app.destroy(true, { children: true }); app = undefined; return; }
        const scene = new Container();
        app.stage.addChild(scene);
        const atlas = textures[tilesUrl];
        const shipTexture = textures[shipUrl];
        if (!atlas || !shipTexture) throw new Error('Missing arena textures.');
        const crop = (frame: Rectangle) => {
          const texture = new Texture({ source: atlas.source, frame });
          ownedTextures.add(texture);
          return texture;
        };
        const waterTexture = crop(new Rectangle(512, 256, 64, 64));
        const tileTextures = new Map<number, Texture>();
        const tile = (id: number) => {
          if (!tileTextures.has(id)) tileTextures.set(id, crop(new Rectangle((id - 1) % 16 * 64, Math.floor((id - 1) / 16) * 64, 64, 64)));
          return tileTextures.get(id)!;
        };
        const sandTexture = crop(new Rectangle(192, 256, 64, 64));
        const land = new TilingSprite({ texture: sandTexture, width: 1, height: 1 });
        app.stage.addChildAt(land, 0);
        // Mirrored quadrants match the tile edges instead of repeating a visible grid.
        const patch = new Container();
        for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
          const piece = new Sprite(tile(23));
          piece.position.set(column === 1 ? 128 : 0, row === 1 ? 128 : 0);
          piece.scale.set(column === 1 ? -1 : 1, row === 1 ? -1 : 1);
          patch.addChild(piece);
        }
        const grassTexture = RenderTexture.create({ width: 128, height: 128 });
        grassSurface = grassTexture;
        app.renderer.render({ container: patch, target: grassTexture });
        patch.destroy({ children: true });
        const greenery = new Container();
        const grass = new TilingSprite({ texture: grassTexture, width: 1, height: 1 });
        const decorations = new Container();
        const grassMask = new Graphics();
        greenery.addChild(grass, decorations);
        greenery.mask = grassMask;
        app.stage.addChildAt(greenery, 1);
        app.stage.addChild(grassMask);
        const decorationTextures = [
          crop(new Rectangle(384, 256, 64, 64)),
          crop(new Rectangle(320, 256, 64, 64)),
          crop(new Rectangle(64, 192, 64, 64)),
        ];
        // Water ends at the actual simulation boundary; the surrounding world is land.
        const ocean = new TilingSprite({ texture: waterTexture, width: config.arena.width, height: config.arena.height });
        scene.addChild(ocean);
        const wake = new WakeTrail();
        scene.addChild(wake);
        for (const [index, island] of simulation.islands.entries()) {
          const view = new Container();
          const layout = [[6, 7, 8, 9], [22, 23, 24, 25], [38, 39, 40, 41], [54, 55, 56, 57]];
          layout.forEach((row, y) => row.forEach((id, x) => {
            const sprite = new Sprite(tile(id)); sprite.position.set(x * 64, y * 64); view.addChild(sprite);
          }));
          const props = index === 0 ? [{ id: 71, x: 105, y: 94, size: 62 }, { id: 66, x: 159, y: 154, size: 46 }, { id: 87, x: 78, y: 169, size: 38 }]
            : index === 1 ? [{ id: 71, x: 111, y: 104, size: 72 }, { id: 70, x: 158, y: 133, size: 46 }, { id: 66, x: 96, y: 165, size: 44 }, { id: 67, x: 153, y: 177, size: 30 }, { id: 88, x: 164, y: 85, size: 32 }]
              : [{ id: 70, x: 164, y: 75, size: 48 }, { id: 65, x: 96, y: 85, size: 34 }];
          for (const prop of props) {
            const sprite = new Sprite(tile(prop.id)); sprite.anchor.set(0.5); sprite.position.set(prop.x, prop.y); sprite.width = prop.size; sprite.height = prop.size; view.addChild(sprite);
          }
          if (index === 2) {
            const prop = new Sprite(textures[visualAsset('ships/dinghy_large_2')]);
            prop.anchor.set(0.5); prop.position.set(210, 158); prop.width = 28; prop.height = 52; prop.rotation = -0.35; view.addChild(prop);
          }
          view.position.set(island.x, island.y); view.scale.set(island.width / 256, island.height / 256); scene.addChild(view);
        }
        const ship = new Sprite(shipTexture);
        ship.anchor.set(0.5);
        ship.width = 40; ship.height = 68;
        scene.addChild(ship);
        const health = new HealthBar(textures, false);
        scene.addChild(health);
        const playerFire = new Sprite(textures[fireUrl]); playerFire.anchor.set(0.5); playerFire.width = 26; playerFire.height = 32; playerFire.visible = false; scene.addChild(playerFire);
        function createEnemyView(target: Enemy) {
          const view = new Container();
          const sprite = new Sprite(textures[targetUrl]);
          sprite.anchor.set(0.5); sprite.width = 40; sprite.height = 68; sprite.rotation = Math.PI;
          const bar = new HealthBar(textures, true, 54);
          const fire = new Sprite(textures[fireUrl]);
          fire.anchor.set(0.5); fire.width = 26; fire.height = 32; fire.visible = false;
          view.addChild(sprite, fire, bar); view.position.set(target.x, target.y); scene.addChild(view);
          return { target, view, sprite, bar, fire };
        }
        const targetViews = new Map<number, ReturnType<typeof createEnemyView>>();
        const projectileViews = new Map<number, Sprite>();
        const effectViews = new Map<number, Sprite>();
        const debrisViews = new Map<number, Sprite[]>();
        const splashViews = new Map<number, Graphics>();
        let previousScore = 0;
        let previousHull = config.player.health;
        let previousCount = -1;
        let previousRemaining = config.sessionSeconds;
        let deathReported = false;
        let visualTime = 0;
        function resize() {
          if (!app || disposed) return;
          const width = element!.clientWidth;
          const height = element!.clientHeight;
          const landscapeTouch = matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 500px)').matches;
          const top = section!.querySelector('.arena-chrome')!.getBoundingClientRect().bottom - element!.getBoundingClientRect().top + (landscapeTouch ? 24 : 12);
          // In a short touch landscape the two control groups sit beside the map,
          // so they need not reserve an empty row across the entire playing field.
          const bottom = landscapeTouch ? height - 24 : section!.querySelector('.arena-bottom')!.getBoundingClientRect().top - element!.getBoundingClientRect().top - 12;
          const availableHeight = Math.max(1, bottom - top);
          const shoreSize = 8;
          const portrait = height > width;
          const viewWidth = portrait ? config.arena.height : config.arena.width;
          const viewHeight = portrait ? config.arena.width : config.arena.height;
          const outerWidth = viewWidth + shoreSize * 2;
          const outerHeight = viewHeight + shoreSize * 2;
          let availableWidth = width - 24;
          if (landscapeTouch) {
            const host = element!.getBoundingClientRect();
            const steering = section!.querySelector('.steering-controls')!.getBoundingClientRect();
            const cannons = section!.querySelector('.cannon-controls')!.getBoundingClientRect();
            // Keep both shores clear of touch targets, including device safe areas.
            const sideInset = Math.max(steering.right - host.left, host.right - cannons.left) + 12;
            availableWidth = Math.max(1, width - sideInset * 2 - 36);
          }
          const scale = Math.min(availableWidth / outerWidth, availableHeight / outerHeight);
          app.renderer.resize(width, height);
          scene.scale.set(scale);
          scene.pivot.set(config.arena.width / 2, config.arena.height / 2);
          scene.rotation = portrait ? Math.PI / 2 : 0;
          scene.position.set(width / 2, top + availableHeight / 2);
          land.width = width; land.height = height; land.tileScale.set(Math.max(scale, 0.75));
          grass.width = width; grass.height = height;
          grass.tileScale.set(Math.max(scale, 0.8));
          const beach = Math.max(18, 40 * scale);
          const mapWidth = viewWidth * scale;
          const mapHeight = viewHeight * scale;
          section!.style.setProperty('--play-area-width', `${mapWidth + beach * 2}px`);
          const mapX = scene.x - mapWidth / 2;
          const mapY = scene.y - mapHeight / 2;
          // Grass surrounds the beach, never the navigable water.
          grassMask.clear().rect(0, 0, width, height).fill(0xffffff)
            .roundRect(mapX - beach, mapY - beach, mapWidth + beach * 2, mapHeight + beach * 2, beach).cut();
          for (const child of decorations.removeChildren()) child.destroy();
          for (let row = 0; row * 130 < height; row++) {
            for (let column = 0; column * 150 < width; column++) {
              const seed = row * 17 + column * 31;
              const x = column * 150 + 30 + seed % 53;
              const y = row * 130 + 35 + seed % 41;
              if (x > mapX - beach - 40 && x < mapX + mapWidth + beach + 40 && y > mapY - beach - 40 && y < mapY + mapHeight + beach + 40) continue;
              const sprite = new Sprite(decorationTextures[seed % decorationTextures.length]);
              sprite.anchor.set(0.5);
              sprite.position.set(x, y);
              const size = 36 + seed % 20;
              sprite.width = size; sprite.height = size;
              sprite.rotation = (seed % 5 - 2) * 0.15;
              decorations.addChild(sprite);
            }
          }
        }
        resize();
        observer = new ResizeObserver(resize);
        observer.observe(element!);
        observer.observe(section!.querySelector('.arena-chrome')!);
        observer.observe(section!.querySelector('.arena-bottom')!);
        element!.appendChild(app.canvas);
        app.canvas.setAttribute('aria-hidden', 'true');
        unbind = controls.bind(section!, () => !paused.current);
        const profiler = attachPerformanceSupport(simulation, () => paused.current, audio.profileResources.bind(audio));
        detachProfile = profiler.dispose;
        const frame = (deltaSeconds: number) => {
          const profileStart = import.meta.env.MODE === 'profile' ? performance.now() : 0;
          if (!paused.current) {
            const dt = Math.min(deltaSeconds, 0.1); simulation.update(dt, controls.active); visualTime += dt;
            wake.updateTrail([
              ...(!simulation.dead ? [{ id: -1, ...simulation.ship }] : []),
              ...simulation.targets.filter(enemy => enemy.health > 0).map(enemy => ({ id: enemy.id, x: enemy.x, y: enemy.y, angle: enemy.angle })),
            ], dt);
          }
          for (const sound of simulation.sounds.splice(0)) audio.play(sound, sound === 'score_point' || sound === 'ship_sinking' ? 0.25 : 0.5, sound === 'ship_sinking' ? 0.25 : 0);
          audio.loop('ocean_ambience_loop', !paused.current, 0.18);
          audio.loop('ship_sailing_loop', !paused.current && simulation.ship.speed > 1, 0.15);
          ship.position.set(simulation.ship.x, simulation.ship.y);
          ship.rotation = simulation.ship.angle + Math.PI;
          const playerRatio = simulation.ship.health / config.player.health;
          ship.texture = playerRatio <= 0.33 ? textures[visualAsset('ships/ship_13')]! : playerRatio <= 0.66 ? textures[visualAsset('ships/ship_7')]! : textures[shipUrl]!;
          ship.tint = simulation.ship.hitSeconds > 0 ? 0xff8877 : 0xffffff;
          ship.visible = !simulation.dead;
          playerFire.position.copyFrom(ship.position);
          playerFire.visible = !simulation.dead && playerRatio <= 0.5;
          playerFire.texture = Math.floor(visualTime * 8) % 2 ? textures[visualAsset('effects/fire_2')]! : textures[fireUrl]!;
          health.visible = !simulation.dead;
          health.updateHealth(playerRatio);
          health.rotation = -scene.rotation;
          health.position.set(simulation.ship.x - Math.sin(scene.rotation) * 48, simulation.ship.y - Math.cos(scene.rotation) * 48);
          const livingIds = new Set(simulation.targets.filter(target => target.health > 0).map(target => target.id));
          for (const [id, rendered] of targetViews) if (!livingIds.has(id)) { rendered.view.destroy({ children: true }); targetViews.delete(id); }
          for (const target of simulation.targets) if (target.health > 0 && !targetViews.has(target.id)) targetViews.set(target.id, createEnemyView(target));
          for (const { target, view, sprite, bar, fire } of targetViews.values()) {
            view.position.set(target.x, target.y);
            view.alpha = target.grace > 0 ? 0.55 : 1;
            sprite.rotation = target.angle + Math.PI;
            bar.rotation = -scene.rotation;
            bar.position.set(-Math.sin(scene.rotation) * 48, -Math.cos(scene.rotation) * 48);
            view.visible = target.health > 0;
            const ratio = target.health / target.maxHealth;
            sprite.texture = target.kind === 'chaser'
              ? textures[visualAsset(ratio <= 0.33 ? 'ships/ship_16' : ratio <= 0.66 ? 'ships/ship_10' : 'ships/ship_4')]!
              : ratio <= 0.33 ? textures[visualAsset('ships/ship_17')]! : ratio <= 0.66 ? textures[visualAsset('ships/ship_11')]! : textures[targetUrl]!;
            sprite.tint = target.hitSeconds > 0 ? 0xff8877 : 0xffffff;
            fire.texture = Math.floor(visualTime * 8) % 2 ? textures[visualAsset('effects/fire_2')]! : textures[fireUrl]!;
            fire.visible = ratio > 0 && ratio <= 0.5;
            bar.updateHealth(ratio);
          }
          const projectileIds = new Set(simulation.projectiles.map(projectile => projectile.id));
          for (const [id, view] of projectileViews) if (!projectileIds.has(id)) { view.destroy(); projectileViews.delete(id); }
          for (const projectile of simulation.projectiles) {
            let view = projectileViews.get(projectile.id);
            if (!view) {
              view = new Sprite(textures[ballUrl]); view.anchor.set(0.5); view.width = projectile.radius * 2; view.height = projectile.radius * 2;
              scene.addChild(view); projectileViews.set(projectile.id, view);
            }
            view.position.set(projectile.x, projectile.y);
          }
          const effectIds = new Set(simulation.effects.map(effect => effect.id));
          for (const [id, view] of effectViews) if (!effectIds.has(id)) { view.destroy(); effectViews.delete(id); }
          for (const [id, pieces] of debrisViews) if (!effectIds.has(id)) { pieces.forEach(piece => piece.destroy()); debrisViews.delete(id); }
          for (const [id, view] of splashViews) if (!effectIds.has(id)) { view.destroy(); splashViews.delete(id); }
          for (const effect of simulation.effects) {
            if (effect.kind === 'splash') {
              let splash = splashViews.get(effect.id);
              if (!splash) { splash = new Graphics(); scene.addChild(splash); splashViews.set(effect.id, splash); }
              const fraction = effect.remaining / effect.duration;
              splash.clear().ellipse(0, 0, 6 + (1 - fraction) * 18, 3 + (1 - fraction) * 8).stroke({ color: 0xe8ffff, width: 2, alpha: fraction });
              for (let drop = 0; drop < 5; drop++) { const angle = drop * Math.PI * 2 / 5; const distance = (1 - fraction) * 22; splash.circle(Math.cos(angle) * distance, Math.sin(angle) * distance - Math.sin((1 - fraction) * Math.PI) * 12, 2).fill({ color: 0xb8efff, alpha: fraction }); }
              splash.position.set(effect.x, effect.y);
              continue;
            }
            let view = effectViews.get(effect.id);
            if (!view) {
              view = new Sprite(textures[effect.kind === 'shot' ? fireUrl : explosionUrl]); view.anchor.set(0.5);
              scene.addChild(view); effectViews.set(effect.id, view);
              if (effect.kind === 'explosion') {
                const pieces = [1, 2, 3, 4].map(number => {
                  const piece = new Sprite(textures[visualAsset(`ship_parts/wood_${number}`)]); piece.anchor.set(0.5); piece.width = 14; piece.height = 8; scene.addChild(piece); return piece;
                });
                debrisViews.set(effect.id, pieces);
              }
            }
            const fraction = effect.remaining / effect.duration;
            if (effect.kind !== 'shot') view.texture = textures[visualAsset(`effects/explosion_${Math.min(3, 1 + Math.floor((1 - fraction) * 3))}`)]!;
            const size = (effect.kind === 'explosion' ? 90 : 28) * (1.3 - fraction * 0.3);
            view.position.set(effect.x, effect.y); view.width = size; view.height = size; view.alpha = fraction;
            debrisViews.get(effect.id)?.forEach((piece, index) => {
              const angle = index * Math.PI / 2 + effect.id;
              const distance = (1 - fraction) * 55;
              piece.position.set(effect.x + Math.cos(angle) * distance, effect.y + Math.sin(angle) * distance);
              piece.rotation = angle + (1 - fraction) * 2; piece.alpha = fraction;
            });
          }
          if (simulation.score !== previousScore) {
            previousScore = simulation.score;
            setScore(previousScore);
          }
          if (simulation.ship.health !== previousHull) { previousHull = simulation.ship.health; setHull(previousHull); }
          const secondsLeft = Math.ceil(simulation.remainingSeconds);
          if (secondsLeft !== previousRemaining) { previousRemaining = secondsLeft; setRemaining(secondsLeft); }
          if (livingIds.size !== previousCount) { previousCount = livingIds.size; setEnemyCount(previousCount); }
          if (simulation.endedReason && !deathReported) {
            deathReported = true; paused.current = true; controls.clear();
            audio.loop('ocean_ambience_loop', false, 0); audio.loop('ship_sailing_loop', false, 0); setDead(true);
            const completed: MatchResult = { id: crypto.randomUUID(), completedAt: new Date().toISOString(), score: simulation.score, durationSeconds: simulation.elapsedSeconds, reason: simulation.endedReason, config: structuredClone(simulation.config), captainName: loadCaptainName() };
            setResultSaved(saveMatchResult(completed)); queueMatch(completed); setResult(completed);
          }
          if (import.meta.env.MODE === 'profile') profiler.record(performance.now() - profileStart);
        };
        detachTest = attachTestSupport(simulation, () => paused.current, frame);
        app.ticker.add(ticker => frame(import.meta.env.MODE === 'e2e' && window.__pirateSetup?.manualTime ? 0 : ticker.deltaMS / 1000));
        setStatus('ready');
        audio.play('game_start');
        section!.focus();
      } catch {
        if (!disposed) setStatus('error');
        observer?.disconnect();
        unbind?.();
        if (app?.renderer) { app.destroy(true, { children: true }); app = undefined; }
        grassSurface?.destroy(true); grassSurface = undefined;
        releaseTextures();
      }
    }
    void start();
    return () => {
      disposed = true;
      detachTest();
      detachProfile();
      audio.stop();
      unbind?.();
      observer?.disconnect();
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      section.removeEventListener('keydown', escape);
      controls.clear();
      section.style.removeProperty('--play-area-width');
      if (app?.renderer) { app.destroy(true, { children: true }); app = undefined; }
      grassSurface?.destroy(true); grassSurface = undefined;
      releaseTextures();
    };
  }, [config, attempt, audio, layoutSeed]);

  function steering(action: GameAction, label: string) {
    return <button className={`steering-button asset-button action-${action}`} disabled={status !== 'ready' || isPaused || isDead} aria-label={label}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); input.current.set(`pointer-${event.pointerId}`, action, true); }}
      onPointerUp={event => input.current.set(`pointer-${event.pointerId}`, action, false)}
      onPointerCancel={event => input.current.set(`pointer-${event.pointerId}`, action, false)}
      onLostPointerCapture={event => input.current.set(`pointer-${event.pointerId}`, action, false)}
      onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); input.current.set(`button-${action}`, action, true); } }}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') input.current.set(`button-${action}`, action, false); }}
      onBlur={() => input.current.set(`button-${action}`, action, false)}><img className="control-icon" src={icons[action]} alt="" /><span className="control-label">{label}</span></button>;
  }

  return <main className="arena-screen" ref={context} tabIndex={-1} aria-label="Combat practice">
    <div className="arena-chrome">
    <header className="arena-header"><div><h1><img className="arena-title" src={titleUrl} alt="Pirate Battle" /></h1><p>Green: Chaser · Blue: Shooter</p></div><div className="arena-top-actions"><button className="asset-button round-button" data-sound="back" aria-label="Main Menu" title="Main Menu" onClick={onBack}><AssetIcon name="home" /></button></div></header>
    <div className="arena-hud">
      <div className="hud-vitals">
        <img className="hud-heart" src={heartUrl} alt="" />
        <div className="hud-health-bar" role="meter" aria-label="Hull health" aria-valuemin={0} aria-valuemax={config.player.health} aria-valuenow={hull}>
          <img className="hud-health-frame" src={hudHealthFrame} alt="" />
          <img className="hud-health-fill" src={hull <= config.player.health * 0.25 ? hudHealthRed : hull <= config.player.health * 0.5 ? hudHealthAmber : hudHealthGreen} alt="" style={{ clipPath: `inset(0 ${100 - (30 + 196 * hull / config.player.health) / 256 * 100}% 0 0)` }} />
          <span>{hull} / {config.player.health}</span>
        </div>
      </div>
      <div className="hud-metrics">
        <span className="hud-counter" role="status"><img src={scoreUrl} alt="" />{score}<span className="sr-only"> points; {enemyCount} active enemies</span></span>
        <span className="hud-counter"><img src={timeUrl} alt="" />{Math.floor(remaining / 60).toString().padStart(2, '0')}:{(remaining % 60).toString().padStart(2, '0')}<span className="sr-only"> remaining</span></span>
        <button className="asset-button round-button" aria-label="Pause" title="Pause" onClick={pause} disabled={status !== 'ready' || isPaused || isDead}><AssetIcon name="pause" /></button>
      </div>
    </div>
    </div>
    <div className="arena-viewport">
      <div ref={host} className="canvas-host" />
      {status === 'loading' && <div className="arena-overlay" role="status"><div className="loading-panel"><h2>Preparing your voyage…</h2><progress value={progress} max={100} aria-label="Loading arena assets" /><p>{progress}%</p></div></div>}
      {status === 'error' && <div className="arena-overlay" role="alert"><div className="loading-panel"><h2>Unable to load the arena</h2><p>Check your connection and WebGL support, then try again.</p><button className="asset-button primary" onClick={() => { setStatus('loading'); setProgress(0); setPaused(false); setAttempt(value => value + 1); }}><AssetIcon name="restart" />Try Again</button></div></div>}
    </div>
    <div className="arena-bottom">
      <div className="arena-control-deck">
        <div className="steering-controls" aria-label="Steering controls">{steering('left', '↶ Left')}{steering('forward', '↑ Sail')}{steering('right', 'Right ↷')}</div>
        <div className="steering-controls cannon-controls" aria-label="Cannon controls">{steering('fireLeft', 'Q · Port')}{steering('fireFront', 'Space · Front')}{steering('fireRight', 'E · Starboard')}</div>
      </div>
      <div className="keyboard-legend" aria-label="Keyboard controls">
        <span><kbd>W / ↑</kbd> Sail</span>
        <span><kbd>A / ←</kbd><kbd>D / →</kbd> Turn</span>
        <span><kbd>Space</kbd> Front cannon</span>
        <span><kbd>Q</kbd><kbd>E</kbd> Port / Starboard</span>
        <span><kbd>Esc</kbd> Pause</span>
      </div>
    </div>
    <dialog className="mission-dialog pause-dialog" ref={pauseDialog} aria-labelledby={pauseOptions ? 'options-title' : 'pause-title'} onCancel={event => event.preventDefault()}>
      {pauseOptions ? <Options options={options} returnLabel="Back" onSave={next => {
        if (!onSaveOptions(next)) return false;
        setPauseOptions(false); return true;
      }} /> : <>
      <button className="asset-button round-button dialog-close" aria-label="Close pause and resume game" title="Resume" data-sound="close" onClick={resume}><AssetIcon name="close" /></button>
      <h2 id="pause-title">Paused</h2>
      <p>Ready when you are.</p>
      <div className="menu-actions">
        <button className="asset-button primary" data-sound="close" onClick={resume}>Resume</button>
        <button className="asset-button primary" data-sound="open" onClick={() => setPauseOptions(true)}>Options</button>
        <button className="asset-button primary" data-sound="back" onClick={onBack}>Main Menu</button>
      </div>
      </>}
    </dialog>
    <dialog className="mission-dialog" ref={completeDialog} aria-labelledby="mission-title" aria-describedby="mission-reason" onCancel={event => event.preventDefault()}>
      {result && <ResultContent key={result.id} result={result} saved={resultSaved} onRestart={restart} onBack={onBack} />}
    </dialog>
    <p className="sr-only" role="status">{status === 'ready' ? (isPaused ? 'Paused' : 'Sailing — islands and arena edges block your ship.') : ''}</p>
  </main>;
}
