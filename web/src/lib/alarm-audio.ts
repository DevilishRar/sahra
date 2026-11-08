import { loadCustomAlarmBlob } from './alarm-store';

export const BUILT_IN_AUDIO: Record<string, string> = {
  'nfpa-fire-alarm': 'nfpa-fire-alarm.ogg',
  motorsirene: 'motorsirene-feuerwehralarm.ogg',
};

export const DEFAULT_ALARM = 'nfpa-fire-alarm';
export const BUILT_IN_ALARM_IDS = Object.keys(BUILT_IN_AUDIO);


export class AlarmAudio {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private inflight = new Map<string, Promise<AudioBuffer | null>>();
  private active: { source: AudioBufferSourceNode; gain: GainNode; id: string } | null = null;
  private generation = 0;
  private onLog: (line: string) => void;

  constructor(onLog: (line: string) => void) {
    this.onLog = onLog;
  }

  get isPlaying(): boolean {
    return this.active !== null;
  }

  get currentAlarmId(): string | null {
    return this.active?.id ?? null;
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) throw new Error('Web Audio API is not available in this browser');
    this.ctx = new AC();
    this.bus = this.ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(this.ctx.destination);
    return this.ctx;
  }

  private label(id: string): string {
    if (id === 'nfpa-fire-alarm') return 'NFPA fire alarm (instant)';
    if (id === 'motorsirene') return 'SAHRA Motorsirene (gradual)';
    return 'custom alarm';
  }

  private async fetchBytes(id: string): Promise<ArrayBuffer> {
    if (id.startsWith('custom-')) {
      const blob = await loadCustomAlarmBlob(id);
      if (!blob) throw new Error('custom alarm missing from local storage — re-add it');
      return blob.arrayBuffer();
    }
    const file = BUILT_IN_AUDIO[id] || BUILT_IN_AUDIO[DEFAULT_ALARM];
    const src = (window as any).__SAHRA_URLS__?.[file] || `${import.meta.env.BASE_URL}audio/${file}`;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`built-in alarm fetch failed (HTTP ${res.status})`);
    return res.arrayBuffer();
  }

  private async loadBuffer(id: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    let pending = this.inflight.get(id);
    if (!pending) {
      pending = (async () => {
        const bytes = await this.fetchBytes(id);
        const ctx = this.ensureContext();
        return ctx.decodeAudioData(bytes);
      })();
      this.inflight.set(id, pending);
    }
    try {
      const buffer = await pending;
      if (!buffer) return null;
      this.buffers.set(id, buffer);
      this.onLog(`alarm source ready: ${this.label(id)}`);
      return buffer;
    } catch (err: any) {
      this.onLog(`alarm source failed (${this.label(id)}): ${err?.message || err}`);
      return null;
    } finally {
      this.inflight.delete(id);
    }
  }

  
  async preload(id: string = DEFAULT_ALARM): Promise<boolean> {
    try {
      const buffer = await this.loadBuffer(id);
      return !!buffer;
    } catch (err: any) {
      this.onLog(`alarm preload failed: ${err?.message || err}`);
      return false;
    }
  }

  
  warmup() {
    void this.preload(DEFAULT_ALARM);
    void this.preload('motorsirene');
  }

  
  stop() {
    this.generation += 1;
    const active = this.active;
    this.active = null;
    if (!active) return;
    try { active.source.onended = null; active.source.stop(0); } catch {  }
    try { active.gain.disconnect(); } catch {  }
    try { active.source.disconnect(); } catch {  }
    this.onLog('alarm off');
  }

  
  async play(id: string): Promise<boolean> {
    try {
      const ctx = this.ensureContext();

      if (this.active?.id === id) {
        if (ctx.state !== 'running') {
          try { await ctx.resume(); } catch {  }
        }
        return true;
      }

      this.stop();
      const myGeneration = this.generation;

      const buffer = await this.loadBuffer(id);
      let effectiveId = id;

      if (!buffer) {
        if (id === DEFAULT_ALARM) return false;
        this.onLog(`falling back to ${DEFAULT_ALARM}`);
        const fallback = await this.loadBuffer(DEFAULT_ALARM);
        if (!fallback) return false;
        if (this.generation !== myGeneration) return false;
        effectiveId = DEFAULT_ALARM;
        this.startBuffer(effectiveId, fallback, ctx);
        return true;
      }

      if (this.generation !== myGeneration) return false; 

      if (ctx.state !== 'running') {
        try { await ctx.resume(); } catch {  }
        if (this.generation !== myGeneration) return false;
      }

      this.startBuffer(effectiveId, buffer, ctx);
      return true;
    } catch (err: any) {
      this.onLog(`alarm audio failed: ${err?.message || err}`);
      return false;
    }
  }

  private startBuffer(id: string, buffer: AudioBuffer, ctx: AudioContext) {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(this.bus!);
    source.onended = () => {
      if (this.active?.source === source) this.active = null;
    };
    try {
      source.start(0);
    } catch (err: any) {
      this.onLog(`alarm start failed: ${err?.message || err}`);
      try { gain.disconnect(); } catch {  }
      return;
    }
    this.active = { source, gain, id };
    this.onLog(`alarm on — ${this.label(id)}`);
  }

  
  clearCache() {
    this.buffers.clear();
  }
}
