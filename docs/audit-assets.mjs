import fs from 'node:fs';
import path from 'node:path';

const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name).replaceAll('\\', '/')]);
const sources = walk('src').filter(file => /\.(tsx?|css)$/.test(file)).map(file => ({ file, text: fs.readFileSync(file, 'utf8') }));
const ui = JSON.parse(fs.readFileSync('assets/spritesheet/ui_sheet.json', 'utf8')).frames;
const recommendations = {
  icon_home: 'Replace text-only Main Menu controls with home icon + round button; keep accessible label.',
  icon_close: 'Pause close explicitly resumes gameplay; Options has no Close control.',
  icon_pause: 'Replace text-only HUD Pause with round icon button.',
  icon_play: 'Reserved alternative; accepted menu and result buttons use text only.',
  icon_restart: 'Loading retry icon; result Play Again remains a text action.',
  icon_settings: 'Reserved alternative; Options remains a text action.',
  icon_plus: 'Explicit session/spawn increment controls; native number spinners are hidden.',
  icon_minus: 'Explicit session/spawn decrement controls; native number spinners are hidden.',
  counter_panel: 'Replace the large menu-panel HUD frame with a dedicated compact counter panel.',
  health_frame: 'Replace the player health bar drawn with Graphics; use atlas content metadata.',
  enemy_health_frame: 'Replace enemy / training health bar Graphics; use atlas content metadata.',
  health_fill_green: 'Player health at healthy levels; crop fill rather than squeezing the full sprite.',
  health_fill_amber: 'Player health at intermediate levels.',
  health_fill_red: 'Player health at low levels.',
  enemy_health_fill_green: 'Reserved alternative; enemy health is always red.',
  enemy_health_fill_red: 'Enemy health at low levels.',
  button_primary_disabled: 'Use for unavailable primary actions; do not imply enabled actions.',
  button_primary_hover: 'Crossfade a hover layer while preserving smooth brightness/motion.',
  button_primary_pressed: 'Add pressed sprite without resetting background-size/repeat.',
  button_secondary_pressed: 'Use secondary pressed state, preserving sprite dimensions.',
};

function purpose(file) {
  const name = path.basename(file, path.extname(file));
  if (file.includes('/ui/')) return recommendations[name] ?? (name.startsWith('icon_') ? 'Existing visual language for controls or HUD; reuse in the corresponding action.' : 'Menu/control sprite; reuse with its matching interaction state and atlas layout metadata.');
  if (file.includes('/tiles/')) return 'Numbered terrain/scenery tile. See TILES.md for individual classification and proposed placement.';
  if (file.includes('/effects/')) return name.startsWith('explosion') ? 'Destruction animation variation; 1/2/3 can be animated or varied after visually verifying the sequence.' : 'Low-health fire / short muzzle flare; alternate 1/2 for flame variation.';
  if (file.includes('/ships/')) return name.startsWith('dinghy') ? 'Small/large boats with progressively damaged variants; use as scenery or a distinct ship class.' : 'Complete colored ship with intact/damaged/gray variants; see ASSETS.md for family mapping.';
  if (file.includes('/ship_parts/')) return name.startsWith('sail') || name.startsWith('hull') ? 'Modular ship part with visual variants; compose ship damage states instead of tint-only damage.' : name.startsWith('crew') ? 'Optional visible crew or decorative castaway, no gameplay implied.' : name.startsWith('wood') ? 'Wood fragments for destruction / floating debris.' : name.startsWith('flag') ? 'Faction/player color cue on a modular ship.' : name === 'cannon_ball' ? 'Projectile sprite.' : name.startsWith('cannon') ? 'Ship cannon or land outpost decoration.' : 'Modular mast / crow nest detail.';
  if (file.includes('/sounds/')) return 'Connected sound catalog; AUDIO.md maps current gameplay and UI events.';
  if (file.includes('/spritesheet/')) return /\.json$/.test(file) ? 'UI atlas frame definitions plus logical alignment/content metadata.' : /\.xml$/.test(file) ? 'Ship/effect atlas coordinates; requires XML conversion before loading as a Pixi spritesheet.' : 'Packed texture alternative to individual PNGs; select one resolution.';
  if (file.includes('/tilesheet/')) return name === 'tilesheets' ? 'Documents 64px tiles and zero margins.' : 'Packed tile texture; used by coordinate crops in Arena.';
  if (file.includes('/vector/')) return /\.svg$/.test(file) ? 'Editable vector source for tile/ship artwork; optional export workflow.' : 'Legacy Flash source; archival only, not browser runtime.';
  if (name === 'logo_jungle_gaming') return 'Existing brand logo for menu/footer.';
  if (name === 'ui_scene_background') return 'Existing menu background; not arena artwork.';
  return 'Visual reference sheet/screen, not a UI sprite. Consult for composition; do not use a screenshot as a live interface.';
}

const assets = walk('assets').sort().map(file => {
  const name = path.basename(file, path.extname(file));
  const references = sources.filter(source => source.text.includes(file) || (file.startsWith('assets/png/retina/') && source.text.includes(file.replace('assets/png/retina/', '').replace('.png', ''))) || (file.endsWith('.wav') && source.text.includes(`'${name}'`))).map(source => source.file);
  const bytes = fs.readFileSync(file);
  const dimensions = file.endsWith('.png') ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : undefined;
  const frame = file.includes('/ui/') ? ui[name] : undefined;
  return { path: file, bytes: bytes.length, dimensions, variant: file.includes('/retina/') || file.includes('_retina') ? '2x' : file.includes('/default/') ? '1x' : 'source', references, usage: references.length ? (file.endsWith('.wav') ? 'Catalogued; event status in AUDIO.md' : file.includes('/tilesheet/') ? 'Atlas used; not every tile placed' : 'Referenced directly') : file.includes('/default/') ? '1x alternative; not directly referenced' : 'Not directly referenced', proposedUse: purpose(file), uiMetadata: frame?.ui, logicalBorders: frame?.borders };
});

fs.writeFileSync('docs/asset-inventory.json', JSON.stringify(assets, null, 2) + '\n');
fs.writeFileSync('docs/ASSET_INVENTORY.md', '# Complete file inventory\n\nGenerated with `node docs/audit-assets.mjs`. Every supplied asset is included. Direct references do not prove visual correctness or that every frame inside an atlas is placed. WAV catalog references do not mean the corresponding event is connected; see AUDIO.md.\n\n| Path | Size | Status | Proposed use |\n| --- | --- | --- | --- |\n' + assets.map(asset => `| [${asset.path}](../${asset.path}) | ${asset.dimensions ? `${asset.dimensions.width}×${asset.dimensions.height}` : `${asset.bytes} bytes`} | ${asset.usage} | ${asset.proposedUse} |`).join('\n') + '\n');
const counts = {};
for (const asset of assets) { const group = asset.path.split('/')[1]; counts[group] = (counts[group] ?? 0) + 1; }
console.log(JSON.stringify({ totalFiles: assets.length, groups: counts, uniqueRetinaSprites: assets.filter(asset => asset.path.startsWith('assets/png/retina/')).length }, null, 2));
