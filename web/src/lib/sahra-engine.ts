import type { MutableRefObject } from 'react';
import { AlarmAudio, DEFAULT_ALARM } from './alarm-audio';

export type SahraStatus = 'idle' | 'awake' | 'drowsy' | 'alarm' | 'calibrating' | 'camera-denied' | 'no-model' | 'no-face';
export type Sensitivity = 0 | 1 | 2;

export interface SahraSnapshot {
  running: boolean;
  status: SahraStatus;
  ear: number;
  perclos: number;
  blinks: number;
  warnings: number;
  alarms: number;
  threshold: number;
  calibrated: boolean;
  calibrating: boolean;
  calibrationProgress: number;
  fps: number;
  tripSeconds: number;
  eyeOverlay: 'open' | 'closed' | 'unknown';
  voice: boolean;
}

export interface SahraEvents {
  onSnapshot: (s: SahraSnapshot) => void;
  onLog: (line: string) => void;
  onAlarm: (on: boolean) => void;
}

const L_EYE = [33, 160, 158, 133, 153, 144];
const R_EYE = [362, 385, 387, 263, 373, 380];
const SENS = [
  { p: 0.32, microsleep: 2.0, label: 'relaxed' },
  { p: 0.25, microsleep: 1.5, label: 'normal' },
  { p: 0.18, microsleep: 1.0, label: 'strict' },
] as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);
const earOf = (lm: any[], idx: number[]) => {
  const p = (i: number) => lm[i];
  const v1 = dist(p(idx[1]), p(idx[5]));
  const v2 = dist(p(idx[2]), p(idx[4]));
  const h = 2 * dist(p(idx[0]), p(idx[3])) + 1e-6;
  return (v1 + v2) / h;
};
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const mad = (xs: number[], med: number) => median(xs.map((x) => Math.abs(x - med)));

export class SahraEngine {
  private fm: any = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private raf = 0;
  private tick: number | null = null;
  private alarm = new AlarmAudio((line) => this.log(line));
  private alarmId: string = (() => {
    if (typeof localStorage === 'undefined') return DEFAULT_ALARM;
    const saved = localStorage.getItem('sahra_alarm_id');
    
    if (!saved || saved === 'motorsirene') {
      try { localStorage.setItem('sahra_alarm_id', DEFAULT_ALARM); } catch {  }
      return DEFAULT_ALARM;
    }
    return saved;
  })();
  private lastVoiceAt = 0;
  private lastFrameAt = 0;
  private fpsCount = 0;
  private snapshotEvery = 0;
  private faceLostSince = 0;
  private faceLostLogged = false;
  private busy = false;
  private lastFacemeshLog = 0;
  private earSmooth = 0;
  private closeFrames = 0;
  private openFrames = 0;
  private lastDistanceLog = 0;

  private S = {
    running: false,
    status: 'idle' as SahraStatus,
    ear: 0,
    perclos: 0,
    blinks: 0,
    warnings: 0,
    alarms: 0,
    sens: 1 as Sensitivity,
    thr: 0.21,
    calibrated: false,
    calibrating: false,
    calibrationProgress: 0,
    closed: false,
    closedSince: 0,
    hist: [] as { t: number; c: number }[],
    openSamples: [] as number[],
    calStartedAt: 0,
    t0: 0,
    voice: true,
    alarmOn: false,
    fps: 0,
    tripSeconds: 0,
    events: [] as string[],
  };

  private events: SahraEvents;

  constructor(events: SahraEvents) {
    this.events = events;
  }

  snapshot(): SahraSnapshot {
    return {
      running: this.S.running,
      status: this.S.status,
      ear: this.S.ear,
      perclos: this.S.perclos,
      blinks: this.S.blinks,
      warnings: this.S.warnings,
      alarms: this.S.alarms,
      threshold: this.S.thr,
      calibrated: this.S.calibrated,
      calibrating: this.S.calibrating,
      calibrationProgress: this.S.calibrationProgress,
      fps: this.S.fps,
      tripSeconds: this.S.tripSeconds,
      eyeOverlay: this.S.status === 'idle' ? 'unknown' : this.S.closed ? 'closed' : 'open',
      voice: this.S.voice,
    };
  }

  setVideoCanvas(videoRef: MutableRefObject<HTMLVideoElement | null>, canvasRef: MutableRefObject<HTMLCanvasElement | null>) {
    this.video = videoRef.current;
    this.canvas = canvasRef.current;
    this.ctx = this.canvas?.getContext('2d') ?? null;
  }

  setSensitivity(sens: Sensitivity) {
    this.S.sens = sens;
    this.log(`sensitivity ${SENS[sens].label}`);
    this.pushSnapshot();
  }

  toggleVoice() {
    this.S.voice = !this.S.voice;
    this.log(this.S.voice ? 'voice on' : 'voice off');
    this.pushSnapshot();
    return this.S.voice;
  }

  getAlarmId() {
    return this.alarmId;
  }

  setAlarmId(id: string) {
    this.alarmId = id;
    try { localStorage.setItem('sahra_alarm_id', id); } catch {  }
    this.log(`alarm sound: ${id === 'nfpa-fire-alarm' ? 'NFPA fire alarm (instant)' : id === 'motorsirene' ? 'SAHRA Motorsirene (gradual)' : id.startsWith('artist-') ? 'artist track' : 'custom alarm'}`);
    void this.alarm.preload(id);
    this.pushSnapshot();
  }

  async previewAlarm() {
    const ok = await this.alarm.play(this.alarmId);
    if (!ok) return;
    window.setTimeout(() => {
      if (!this.S.alarmOn) this.alarm.stop();
      this.pushSnapshot();
    }, 1600);
  }

  async start() {
    if (!this.video || !this.canvas) return;
    if (this.S.running) return;
    if (!window.FaceMesh) {
      this.S.status = 'no-model';
      this.log('face model missing — keep /vendor/mp beside the page');
      this.pushSnapshot();
      return;
    }
    if (!this.fm) {
      const FaceMesh = window.FaceMesh;
      this.fm = new FaceMesh({ locateFile: (file: string) => (window as any).__SAHRA_URLS__?.[file] || `${import.meta.env.BASE_URL}vendor/mp/${file}` });
      this.fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.35, minTrackingConfidence: 0.5 });
      this.fm.onResults((r: any) => {
        const lm = r?.multiFaceLandmarks?.[0];
        if (lm) this.onFace(lm);
        else this.onFaceLost();
      });
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = stream;
      await this.video.play();
      await this.waitForVideoSize();
      this.log(`camera frames ${this.video.videoWidth}×${this.video.videoHeight}`);
    } catch (err: any) {
      this.S.status = 'camera-denied';
      this.log(`camera blocked: ${err?.message || err}`);
      this.pushSnapshot();
      return;
    }
    this.resetTripStats();
    this.alarm.warmup();
    this.S.running = true;
    this.S.status = 'awake';
    this.S.t0 = Date.now();
    this.log('trip started — local model watching eyes');
    this.beginAutoCalibration();
    this.tick = window.setInterval(() => {
      this.S.tripSeconds = Math.round((Date.now() - this.S.t0) / 1000);
      this.pushSnapshot();
    }, 500);
    this.loop();
  }

  stop() {
    this.S.running = false;
    if (this.tick) window.clearInterval(this.tick);
    this.tick = null;
    cancelAnimationFrame(this.raf);
    this.alarm.stop();
    this.events.onAlarm(false);
    if (this.video?.srcObject) {
      (this.video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      this.video.srcObject = null;
    }
    this.S.status = 'idle';
    this.S.calibrating = false;
    this.S.alarmOn = false;
    this.log('trip stopped');
    this.pushSnapshot();
  }

  calibrateNow() {
    if (!this.S.running) {
      this.log('start the trip first');
      return;
    }
    this.beginAutoCalibration(true);
  }

  simulateMicrosleep() {
    this.S.alarms += 1;
    this.S.status = 'alarm';
    this.S.alarmOn = true;
    void this.alarm.play(this.alarmId);
    this.events.onAlarm(true);
    this.log('SIMULATION microsleep 1.6s');
    this.speak('Wake up. Wake up.');
    this.pushSnapshot();
    window.setTimeout(() => {
      if (this.S.status === 'alarm') {
        this.S.status = 'awake';
        this.S.alarmOn = false;
        this.alarm.stop();
        this.events.onAlarm(false);
        this.log('simulation cleared');
        this.pushSnapshot();
      }
    }, 2200);
  }

  report() {
    const duration_s = this.S.t0 ? Math.round((Date.now() - this.S.t0) / 1000) : 0;
    const perclos = this.S.hist.length ? this.S.hist.reduce((a, x) => a + x.c, 0) / this.S.hist.length : 0;
    const sensitivity = SENS[this.S.sens].label;
    return {
      product: 'SAHRA — Offline Drowsiness Guard',
      duration_s,
      alarms: this.S.alarms,
      warnings: this.S.warnings,
      perclos: +perclos.toFixed(3),
      blinks: this.S.blinks,
      threshold: +this.S.thr.toFixed(3),
      calibrated: this.S.calibrated,
      sensitivity,
      events: this.S.events.slice(-80),
      at: new Date().toISOString(),
    };
  }

  saveTrip() {
    const r = this.report();
    const trips = JSON.parse(localStorage.getItem('sahra_trips') || '[]');
    trips.unshift({ id: `sahra_${Date.now()}`, ...r });
    localStorage.setItem('sahra_trips', JSON.stringify(trips.slice(0, 30)));
    this.log('trip saved on this device');
    return r;
  }

  exportTrip() {
    const r = this.report();
    const lines = [
      'SAHRA — Trip Report',
      `When: ${r.at}`,
      `Duration: ${r.duration_s}s`,
      `Alarms: ${r.alarms}  Warnings: ${r.warnings}`,
      `PERCLOS: ${r.perclos}  Blinks: ${r.blinks}`,
      `Threshold: ${r.threshold}  Calibrated: ${r.calibrated ? 'yes' : 'device-average'}  Sensitivity: ${r.sensitivity}`,
      '',
      'Events:',
      ...r.events.map((e) => ` - ${e}`),
    ].join('\n');
    return lines;
  }

  private resetTripStats() {
    this.S.hist = [];
    this.S.blinks = 0;
    this.S.warnings = 0;
    this.S.alarms = 0;
    this.S.events = [];
    this.S.ear = 0;
    this.S.perclos = 0;
    this.S.closed = false;
    this.S.alarmOn = false;
    this.S.tripSeconds = 0;
    this.S.fps = 0;
    this.fpsCount = 0;
    this.lastFrameAt = 0;
    this.earSmooth = 0;
    this.closeFrames = 0;
    this.openFrames = 0;
  }

  private async waitForVideoSize() {
    for (let i = 0; i < 60; i++) {
      if (this.video && this.video.videoWidth > 0 && this.video.videoHeight > 0) return;
      await new Promise((r) => window.setTimeout(r, 50));
    }
  }

  private loop = () => {
    if (!this.S.running) return;
    const video = this.video;
    if (video && video.readyState >= 2 && this.fm && !this.busy) {
      const now = performance.now();
      this.busy = true;
      this.fm.send({ image: video })
        .catch((err: any) => this.logFacemeshOnce(`facemesh send error: ${err?.message || err}`))
        .finally(() => { this.busy = false; });
      this.fpsCount += 1;
      if (!this.lastFrameAt) this.lastFrameAt = now;
      if (now - this.lastFrameAt >= 1000) {
        this.S.fps = this.fpsCount;
        this.fpsCount = 0;
        this.lastFrameAt = now;
        this.pushSnapshot();
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private logFacemeshOnce(message: string) {
    const now = performance.now();
    if (now - this.lastFacemeshLog < 4000) return;
    this.lastFacemeshLog = now;
    this.log(message);
  }

  private logDistanceOnce(lm: any[]) {
    const now = performance.now();
    if (now - this.lastDistanceLog < 6000) return;
    const eyeWidth = dist(lm[33], lm[263]);
    const faceWidth = Math.max(...lm.map((p) => p.x)) - Math.min(...lm.map((p) => p.x));
    if (eyeWidth < 0.055) {
      this.lastDistanceLog = now;
      this.log(`face small (${Math.round(eyeWidth * 100)}% eye span) — move closer or raise screen light`);
    } else if (faceWidth > 0.92) {
      this.lastDistanceLog = now;
      this.log('face fills frame — step back slightly for full upper-face tracking');
    }
  }

  private beginAutoCalibration(manual = false) {
    this.S.calibrating = true;
    this.S.openSamples = [];
    this.S.calStartedAt = performance.now();
    this.S.calibrationProgress = 0;
    this.S.status = 'calibrating';
    this.log(manual ? 'calibrating — hold a steady open gaze' : 'auto-calibrating — keep eyes open');
    this.speak('Keep your eyes open. Hold still.');
    this.pushSnapshot();
  }

  private finishCalibration() {
    const xs = this.S.openSamples;
    this.S.calibrating = false;
    this.S.calibrationProgress = 1;
    if (xs.length >= 20) {
      const med = median(xs);
      const spread = 1.4826 * mad(xs, med);
      const thr = clamp(Math.min(med * 0.72, med - 2.2 * spread), 0.13, 0.28);
      this.S.thr = thr;
      this.S.calibrated = true;
      this.S.status = 'awake';
      this.log(`calibrated: open-EAR ${med.toFixed(2)} → threshold ${thr.toFixed(2)}`);
      this.speak('Calibration done.');
    } else {
      this.S.thr = 0.21;
      this.S.calibrated = false;
      this.S.status = 'awake';
      this.log('calibration unclear — using device-averaged threshold 0.21; tap calibrate to retry');
      this.speak('Using device average. You can calibrate again anytime.');
    }
    this.pushSnapshot();
  }

  private onFace(lm: any[]) {
    const now = performance.now();
    if (this.faceLostSince) {
      this.faceLostSince = 0;
      this.faceLostLogged = false;
      if (this.S.status === 'no-face') this.S.status = 'awake';
      this.log('face found — tracking resumed');
    }
    const rawEar = (earOf(lm, L_EYE) + earOf(lm, R_EYE)) / 2;
    this.earSmooth = this.earSmooth ? this.earSmooth * 0.62 + rawEar * 0.38 : rawEar;
    this.S.ear = this.earSmooth;
    this.logDistanceOnce(lm);

    if (this.S.calibrating) this.sampleForCalibration(rawEar, now);
    else this.updateDrowsiness(this.earSmooth, now);

    this.drawOverlay(lm, this.S.closed ? 'closed' : 'open');
    this.pushSnapshot();
  }

  private onFaceLost() {
    const now = performance.now();
    if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.S.running) return;
    if (!this.faceLostSince) this.faceLostSince = now;
    if (now - this.faceLostSince > 1500 && this.S.status !== 'no-face') {
      this.S.status = 'no-face';
      if (!this.faceLostLogged) {
        this.faceLostLogged = true;
        this.log('face lost — center your face, raise light or remove glare');
      }
      this.pushSnapshot();
    }
  }

  private sampleForCalibration(ear: number, now: number) {
    if (ear > 0.14) this.S.openSamples.push(ear);
    const elapsed = now - this.S.calStartedAt;
    this.S.calibrationProgress = clamp(elapsed / 5000, 0.02, 0.95);
    const med = median(this.S.openSamples);
    const spread = this.S.openSamples.length > 20 ? 1.4826 * mad(this.S.openSamples, med) : 1;
    const steady = this.S.openSamples.length >= 45 && med > 0.16 && spread < 0.035;
    if (steady || elapsed >= 8000 || (this.S.openSamples.length >= 90 && spread < 0.05)) {
      this.finishCalibration();
    }
  }

  private updateDrowsiness(ear: number, now: number) {
    const thr = this.S.thr;
    const wasClosed = this.S.closed;
    
    if (!this.S.closed) {
      this.closeFrames = ear < thr ? this.closeFrames + 1 : 0;
      this.openFrames = ear > thr * 1.12 ? this.openFrames + 1 : 0;
      if (this.closeFrames >= 2) this.S.closed = true;
    } else {
      this.openFrames = ear > thr * 1.12 ? this.openFrames + 1 : 0;
      this.closeFrames = ear < thr ? this.closeFrames + 1 : 0;
      if (this.openFrames >= 2) this.S.closed = false;
    }
    if (this.S.closed && !wasClosed) this.S.closedSince = now;
    if (!this.S.closed && wasClosed) {
      const dur = (now - this.S.closedSince) / 1000;
      if (dur > 0.08 && dur < 0.6) this.S.blinks += 1;
    }
    this.S.hist.push({ t: now, c: this.S.closed ? 1 : 0 });
    while (this.S.hist.length && now - this.S.hist[0].t > 60000) this.S.hist.shift();
    this.S.perclos = this.S.hist.length ? this.S.hist.reduce((a, x) => a + x.c, 0) / this.S.hist.length : 0;
    const cfg = SENS[this.S.sens];
    const closedDuration = this.S.closed ? (now - this.S.closedSince) / 1000 : 0;
    if (this.S.closed && closedDuration >= cfg.microsleep) {
      if (!this.S.alarmOn) {
        this.S.alarmOn = true;
        this.S.alarms += 1;
        this.S.status = 'alarm';
        this.events.onAlarm(true);
        this.log(`ALARM microsleep ${closedDuration.toFixed(1)}s (EAR ${ear.toFixed(2)})`);
        this.speak('Wake up. Wake up.');
      }
      void this.alarm.play(this.alarmId);
      return;
    }
    if (this.S.alarmOn) {
      this.S.alarmOn = false;
      this.alarm.stop();
      this.events.onAlarm(false);
      this.log('driver alert again');
    }
    if (this.S.perclos >= cfg.p) {
      if (this.S.status !== 'drowsy') {
        this.S.warnings += 1;
        this.log(`WARNING PERCLOS ${this.S.perclos.toFixed(2)}`);
        this.speak('You look drowsy. Take a break soon.');
      }
      this.S.status = 'drowsy';
    } else if (this.S.status !== 'awake') {
      this.S.status = 'awake';
    }
  }

  private drawOverlay(lm: any[], eye: 'open' | 'closed') {
    const canvas = this.canvas;
    const ctx = this.ctx;
    const video = this.video;
    if (!canvas || !ctx || !video) return;
    if (video.videoWidth && canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const stroke = eye === 'closed' ? '#ff5a5a' : '#34d399';
    ctx.lineWidth = Math.max(2, w * 0.003);
    for (const idx of [L_EYE, R_EYE]) {
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      idx.forEach((li, k) => {
        const p = lm[li];
        const x = p.x * w;
        const y = p.y * h;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    
    for (const idx of [L_EYE, R_EYE]) {
      const pts = idx.map((li) => lm[li]);
      const cx = (pts.reduce((a, p) => a + p.x, 0) / pts.length) * w;
      const cy = (pts.reduce((a, p) => a + p.y, 0) / pts.length) * h;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(4, w * 0.006), 0, Math.PI * 2);
      ctx.fill();
    }
    const xs = lm.map((p) => p.x);
    const ys = lm.map((p) => p.y);
    const x0 = Math.min(...xs) * w;
    const x1 = Math.max(...xs) * w;
    const y0 = Math.min(...ys) * h;
    const y1 = Math.max(...ys) * h;
    ctx.strokeStyle = '#38bdf8';
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 28);
    ctx.setLineDash([]);
    ctx.fillStyle = '#7cc4ff';
    ctx.font = `bold ${Math.round(h * 0.032)}px Consolas, monospace`;
    ctx.fillText(`EAR ${this.S.ear.toFixed(2)}`, x0 - 10, Math.max(18, y0 - 22));
  }

  private speak(text: string) {
    if (!this.S.voice) return;
    const now = performance.now();
    if (now - this.lastVoiceAt < 3500) return;
    this.lastVoiceAt = now;
    try {
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.speak(new SpeechSynthesisUtterance(text));
    } catch {
      
    }
  }

  private log(line: string) {
    const stamped = `${new Date().toLocaleTimeString()} ${line}`;
    this.S.events.push(stamped);
    if (this.S.events.length > 200) this.S.events.splice(0, this.S.events.length - 200);
    this.events.onLog(stamped);
  }

  private pushSnapshot() {
    this.snapshotEvery += 1;
    this.events.onSnapshot(this.snapshot());
  }
}
