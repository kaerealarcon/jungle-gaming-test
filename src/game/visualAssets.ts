const files = import.meta.glob([
  '../../assets/png/retina/ships/ship_{4,7,10,13,11,16,17}.png',
  '../../assets/png/retina/effects/{fire_2,explosion_1,explosion_2,explosion_3}.png',
  '../../assets/png/retina/ship_parts/wood_*.png',
  '../../assets/png/retina/ship_parts/cannon.png',
  '../../assets/png/retina/ships/dinghy_large_2.png',
  '../../assets/png/retina/ui/hud/*health*.png',
], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function visualAsset(relativePath: string): string {
  const url = files[`../../assets/png/retina/${relativePath}.png`];
  if (!url) throw new Error(`Missing visual asset: ${relativePath}`);
  return url;
}
export const combatVisuals = [
  'ships/ship_7', 'ships/ship_13', 'ships/ship_11', 'ships/ship_17',
  'ships/ship_4', 'ships/ship_10', 'ships/ship_16',
  'ship_parts/cannon', 'ships/dinghy_large_2',
  'effects/fire_2', 'effects/explosion_1', 'effects/explosion_2', 'effects/explosion_3',
  'ship_parts/wood_1', 'ship_parts/wood_2', 'ship_parts/wood_3', 'ship_parts/wood_4',
  'ui/hud/health_frame', 'ui/hud/health_fill_green', 'ui/hud/health_fill_amber', 'ui/hud/health_fill_red',
  'ui/hud/enemy_health_frame', 'ui/hud/enemy_health_fill_green', 'ui/hud/enemy_health_fill_red',
].map(visualAsset);
