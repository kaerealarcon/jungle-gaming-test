# Supplied assets and current usage

All 520 supplied files are preserved: 234 unique sprites at default/retina resolutions (468 PNGs), 27 WAVs, eight atlas files, three tile-sheet files, four vector sources and ten top-level branding/background/reference files. Alternative resolutions, factions and modular parts remain available.

- [Per-file inventory](ASSET_INVENTORY.md) and [structured metadata](asset-inventory.json)
- [UI](ui-catalog.png), [ships](ships-catalog.png), [parts](ship_parts-catalog.png), [effects](effects-catalog.png), [tiles](tile-catalog.png)
- [Tile mapping](TILES.md) and [audio events](../AUDIO.md)

The app uses individual retina sprites and numbered tile-sheet crops. References include the dynamic visual catalog; they do not imply every atlas tile is placed or prove visual correctness. Supplied sample PNGs guide composition rather than replacing interactive screens.

## Interface and gameplay

The title uses title_pirate_battle. Screens use wooden panels/buttons. Main-menu/result actions are text-only. Arena Home/Pause and pause Close use round icons. Options has plus/minus controls, hidden native spinners and a single validating save-and-return action. There is no Options Close or Sound On control.

HUD uses heart, player-health frame/fill and score/time counters; desktop adds a wooden panel whose width follows the play area. Player health changes green/amber/red; enemy health stays red. Bars counter-rotate in portrait. Round touch controls retain normal/hover/pressed art and simultaneous input; short landscape reserves their space beside the shore.

Player uses ship_1/7/13, Chasers ship_4/10/16 and Shooters ship_5/11/17 damage stages. Both fire sprites, three explosions and wood fragments are connected. Impacts tint ships; water misses produce dynamic splashes; wakes follow displacement and fade when ships stop.

Three random islands use compatible coast/grass crops, sparse plants/stones and a shore dinghy. Mirrored grass surrounds the map; water stays inside the play area. Sand/prop tiles 81?86 remain catalogued without being forced into the accepted island design.

## Regeneration and metadata

UI metadata uses logical 1x units. counter_panel is 160x56; player-health frame is 256x48 with fill x=30, y=15, width=196, height=20. Crop fills from the left instead of compressing the frame. See supplied UI JSON and HealthBar.ts.

Run node docs/audit-assets.mjs for inventories. On Windows, powershell -NoProfile -ExecutionPolicy Bypass -File docs/build-contact-sheets.ps1 regenerates contact sheets. These scripts reproduce delivered documentation.
