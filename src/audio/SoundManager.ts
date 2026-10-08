const soundFiles = import.meta.glob('../../assets/sounds/*.wav', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const soundNames = ['cannonball_water_hit_1', 'cannonball_water_hit_2', 'cannon_broadside', 'cannon_fire_1', 'cannon_fire_2', 'cannon_fire_3', 'game_complete', 'game_over', 'game_pause', 'game_resume', 'game_start', 'health_low', 'ocean_ambience_loop', 'score_point', 'ship_collision', 'ship_explosion_1', 'ship_explosion_2', 'ship_sailing_loop', 'ship_sinking', 'ship_wood_hit_1', 'ship_wood_hit_2', 'time_warning', 'ui_back', 'ui_click', 'ui_close', 'ui_hover', 'ui_open'] as const;
export type SoundName = typeof soundNames[number];

export class SoundManager {
  private context?: AudioContext;
  private master?: GainNode;
  private buffers = new Map<SoundName, Promise<AudioBuffer | null>>();
  private sources = new Set<AudioBufferSourceNode>();
  private uiSources = new Set<AudioBufferSourceNode>();
  private loops = new Map<SoundName, { source?: AudioBufferSourceNode }>();
  private generation = 0;
  private hoverTime = 0;


  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = 0.65;
        this.master.connect(this.context.destination);
        // Warm the buffers after a gesture so the first cannon shot is responsive.
        for (const name of soundNames) void this.load(name);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Audio support must never block gameplay. */ }
  }


  private load(name: SoundName) {
    if (!this.buffers.has(name)) {
      const context = this.context;
      const url = soundFiles[`../../assets/sounds/${name}.wav`];
      if (!context || !url) return Promise.resolve(null);
      this.buffers.set(name, fetch(url).then(response => {
        if (!response.ok) throw new Error('Audio unavailable');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).catch(() => null));
    }
    return this.buffers.get(name)!;
  }

  play(name: SoundName, volume = 0.5, delaySeconds = 0) {
    if (!this.context) return;
    if (name === 'ui_hover') {
      if (performance.now() - this.hoverTime < 100) return;
      this.hoverTime = performance.now();
    }
    const generation = this.generation;
    const context = this.context;
    const ui = name.startsWith('ui_');
    void this.load(name).then(buffer => {
      if (!buffer || (!ui && generation !== this.generation) || context !== this.context || this.context?.state !== 'running' || !this.master || this.sources.size + this.uiSources.size >= 12) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer; gain.gain.value = volume;
      source.connect(gain); gain.connect(this.master);
      const sources = ui ? this.uiSources : this.sources;
      sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect(); };
      source.start(this.context.currentTime + delaySeconds);
    }).catch(() => {});
  }

  loop(name: 'ocean_ambience_loop' | 'ship_sailing_loop', enabled: boolean, volume: number) {
    const existing = this.loops.get(name);
    if (!enabled) { existing?.source?.stop(); this.loops.delete(name); return; }
    if (existing || !this.context) return;
    const entry: { source?: AudioBufferSourceNode } = {};
    this.loops.set(name, entry);
    void this.load(name).then(buffer => {
      if (!buffer || this.loops.get(name) !== entry || !this.context || !this.master) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer; source.loop = true; gain.gain.value = volume;
      source.connect(gain); gain.connect(this.master); entry.source = source;
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
    }).catch(() => {});
  }

  stop() {
    this.generation++;
    for (const source of this.sources) source.stop();
    this.sources.clear();
    for (const entry of this.loops.values()) entry.source?.stop();
    this.loops.clear();
  }

  dispose() {
    this.stop();
    for (const source of this.uiSources) source.stop();
    this.uiSources.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined; this.master = undefined; this.buffers.clear();
  }

  profileResources() {
    return { audioBuffers: this.buffers.size, audioSources: this.sources.size + this.uiSources.size, audioLoops: this.loops.size };
  }
}
