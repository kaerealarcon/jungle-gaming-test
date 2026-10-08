# Audio coverage

All 27 WAVs participate in the current game. Audio is enabled by default and unlocks after a pointer/keyboard gesture. There is no sound toggle or persisted mute setting. Audio failures do not block gameplay.

| Files | Connected event |
| --- | --- |
| ui_click, ui_hover | Button activation and rate-limited mouse hover |
| ui_open, ui_back, ui_close | Open screens, save/return, resume/close pause and Play Again |
| game_start, game_pause, game_resume | Arena ready, pause and explicit resume |
| game_complete, game_over | Time expiry and zero player health |
| cannon_fire_1/2/3 | Frontal shots with round-robin variants |
| cannon_broadside | One sound per triple broadside |
| ship_wood_hit_1/2 | Projectile damages player/enemy hull |
| ship_explosion_1/2, ship_sinking | Destruction/Chaser impact, sinking delayed 250 ms |
| score_point | One point per enemy destroyed by player |
| ship_collision | First moving terrain/bounds contact or Chaser impact |
| cannonball_water_hit_1/2 | Terrain/bounds blocking or projectile range/lifetime expiry |
| ocean_ambience_loop, ship_sailing_loop | Active ambience; moving player including coasting |
| health_low, time_warning | First 25% health crossing; once at ten active seconds remaining |

SoundManager caches decoded buffers, uses master gain 0.65 and caps transient voices at 12. Arena teardown stops gameplay sources/loops while navigation sounds finish; app teardown closes the context. Generation guards prevent delayed loads restarting old audio. Pause freezes alerts with active time; restart resets variants and warnings.

Review navigation, batteries, hits, collisions, destruction/sinking, low health, time warning and both endings. The [performance report](docs/PERFORMANCE.md) measured zero live sources/loops after exit and 27 cache entries retained intentionally.
