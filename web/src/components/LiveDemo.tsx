import { useEffect, useRef, useState } from 'react';
import { Camera, Download, Gauge, Mic, Music2, Power, Save, ShieldCheck, Siren, SlidersHorizontal, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { SahraEngine, type SahraSnapshot, type Sensitivity } from '../lib/sahra-engine';
import { deleteCustomAlarm, listCustomAlarms, saveCustomAlarm, type CustomAlarmMeta } from '../lib/alarm-store';
import { ARTIST_TRACKS, DEFAULT_ALARM } from '../lib/alarm-audio';
import { hasSecret } from '../lib/secret';

const STATUS_META: Record<SahraSnapshot['status'], { label: string; className: string; dot: string }> = {
  idle: { label: 'READY', className: 'text-sahra-muted border-night-line', dot: 'bg-sahra-muted' },
  awake: { label: 'AWAKE', className: 'text-sahra-green border-sahra-green/40', dot: 'bg-sahra-green' },
  drowsy: { label: 'DROWSY', className: 'text-sahra-amber border-sahra-amber/50', dot: 'bg-sahra-amber' },
  alarm: { label: 'WAKE UP', className: 'text-sahra-red border-sahra-red/60', dot: 'bg-sahra-red animate-ping' },
  calibrating: { label: 'CALIBRATING', className: 'text-sahra-sand border-sahra-sand/50', dot: 'bg-sahra-sand' },
  'camera-denied': { label: 'CAMERA DENIED', className: 'text-sahra-muted border-night-line', dot: 'bg-sahra-muted' },
  'no-model': { label: 'MODEL MISSING', className: 'text-sahra-blue border-sahra-blue/50', dot: 'bg-sahra-blue' },
  'no-face': { label: 'NO FACE', className: 'text-sahra-amber border-sahra-amber/50', dot: 'bg-sahra-amber' },
};

const initial: SahraSnapshot = {
  running: false,
  status: 'idle',
  ear: 0,
  perclos: 0,
  blinks: 0,
  warnings: 0,
  alarms: 0,
  threshold: 0.21,
  calibrated: false,
  calibrating: false,
  calibrationProgress: 0,
  fps: 0,
  tripSeconds: 0,
  eyeOverlay: 'unknown',
  voice: true,
};

export default function LiveDemo({ onAlarm, fullscreen = false }: { onAlarm: (on: boolean) => void; fullscreen?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SahraEngine | null>(null);
  const [snap, setSnap] = useState<SahraSnapshot>(initial);
  const [log, setLog] = useState<string[]>([]);
  const [aspect, setAspect] = useState('16 / 9');
  const [alarmId, setAlarmId] = useState(DEFAULT_ALARM);
  const [customAlarms, setCustomAlarms] = useState<CustomAlarmMeta[]>([]);
  const [alarmMsg, setAlarmMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const engine = new SahraEngine({
      onSnapshot: setSnap,
      onLog: (line) => setLog((prev) => [...prev.slice(-40), line]),
      onAlarm,
    });
    engineRef.current = engine;
    engine.setVideoCanvas(videoRef, canvasRef);
    setAlarmId(engine.getAlarmId());
    listCustomAlarms().then(setCustomAlarms).catch(() => setCustomAlarms([]));
    const video = videoRef.current;
    const onMeta = () => {
      if (video?.videoWidth && video?.videoHeight) setAspect(`${video.videoWidth} / ${video.videoHeight}`);
    };
    video?.addEventListener('loadedmetadata', onMeta);
    return () => {
      video?.removeEventListener('loadedmetadata', onMeta);
      engine.stop();
      engineRef.current = null;
    };
  }, [onAlarm]);

  const status = STATUS_META[snap.status];
  const meter = Math.round(Math.min(1, Math.max(snap.perclos / 0.25, snap.status === 'alarm' ? 1 : 0.08)) * 100);

  const startStop = async () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (snap.running) engine.stop();
    else await engine.start();
  };

  const formatBytes = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const changeAlarm = (id: string) => {
    engineRef.current?.setAlarmId(id);
    setAlarmId(id);
  };
  const uploadAlarm = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { setAlarmMsg({ text: 'No file selected — the picker returned nothing.', ok: false }); return; }
    setAlarmMsg({ text: `Saving ${file.name}…`, ok: true });
    try {
      const meta = await saveCustomAlarm(file);
      setCustomAlarms(await listCustomAlarms());
      engineRef.current?.setAlarmId(meta.id);
      setAlarmId(meta.id);
      setAlarmMsg({ text: `Saved: ${meta.name} (${formatBytes(meta.size)}) — selected and ready to test.`, ok: true });
      setLog((prev) => [...prev.slice(-40), `custom alarm saved: ${meta.name}`]);
    } catch (err: any) {
      const message = err?.message || String(err);
      setAlarmMsg({ text: `Upload failed: ${message}. If this keeps up, the browser may be blocking local storage — check private/incognito mode or quota.`, ok: false });
      setLog((prev) => [...prev.slice(-40), `custom alarm failed: ${message}`]);
    } finally {
      if (event.target) event.target.value = '';
    }
  };
  const removeCustomAlarm = async () => {
    if (!alarmId.startsWith('custom-')) return;
    try {
      await deleteCustomAlarm(alarmId);
      setCustomAlarms(await listCustomAlarms());
      engineRef.current?.setAlarmId(DEFAULT_ALARM);
      setAlarmId(DEFAULT_ALARM);
    } catch (err: any) {
      setLog((prev) => [...prev.slice(-40), `delete alarm failed: ${err?.message || err}`]);
    }
  };
  const testAlarm = () => engineRef.current?.previewAlarm();

  const save = () => engineRef.current?.saveTrip();
  const exportTxt = () => {
    const text = engineRef.current?.exportTrip() ?? 'SAHRA — no trip yet';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sahra-trip-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`${fullscreen ? 'flex h-full min-h-0 flex-col overflow-hidden border-0 bg-transparent shadow-none' : 'sahra-card overflow-hidden'}`}>
      {!fullscreen && (
        <div className="flex items-center justify-between border-b border-night-line bg-night-800/70 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-sahra-ink">
            <Camera size={14} className="text-sahra-blue" /> SAHRA CORE — LIVE, ON THIS DEVICE
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-sahra-green">
            <span className="h-2 w-2 rounded-full bg-sahra-green" /> LOCAL ONLY
          </div>
        </div>
      )}

      <div className={fullscreen ? 'grid min-h-0 flex-1 gap-3 overflow-auto p-2 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]' : 'grid gap-4 p-4 lg:grid-cols-[1fr_280px]'}>
        <div className={fullscreen ? 'flex min-h-0 flex-col' : ''}>
          <div className={`relative w-full overflow-hidden rounded-2xl border border-night-line bg-[#05080f] ${fullscreen ? 'min-h-0 flex-1' : ''}`} style={fullscreen ? undefined : { aspectRatio: aspect }}>
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-fill" playsInline muted autoPlay />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-fill" aria-hidden="true" />
            {!snap.running && (
              <div className="absolute inset-0 grid place-items-center overflow-hidden bg-[#05080f]/80 p-3 text-center sm:p-6">
                <div>
                  <ShieldCheck className="mx-auto mb-1 text-sahra-sand sm:mb-3" size={24} />
                  <p className="text-[11px] font-bold text-sahra-ink sm:text-base">Camera stays here.</p>
                  <p className="mx-auto mt-1 hidden max-w-[38ch] text-sm text-sahra-muted md:block">Frames are processed in memory and discarded.</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full border bg-night-950/60 px-3 py-1.5 text-xs font-extrabold tracking-[0.18em] ${status.className}`}>
              <span className={`h-2 w-2 rounded-full ${status.dot}`} /> {status.label}
            </div>
            <div className="font-mono text-[11px] text-sahra-muted">EAR {snap.ear ? snap.ear.toFixed(2) : '--'} · PERCLOS {snap.perclos.toFixed(2)} · {snap.fps || '--'} fps</div>
          </div>
          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-night-700">
            <div className="absolute inset-0 origin-left bg-gradient-to-r from-sahra-green via-sahra-amber to-sahra-red transition-transform duration-300 ease-out will-change-transform" style={{ transform: `scaleX(${meter / 100})` }} />
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <button onClick={startStop} className={`sahra-btn rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-[0.18em] ${snap.running ? 'bg-emerald-400 text-black' : 'bg-white text-black'}`}>
            <span className="inline-flex items-center gap-2">{snap.running ? <Power size={16} /> : <Power size={16} />} {snap.running ? 'STOP TRIP' : 'START TRIP'}</span>
          </button>
          <button onClick={() => engineRef.current?.calibrateNow()} className="sahra-btn rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white hover:border-violet-400/50">
            CALIBRATE · AUTO 5s, EXITS EARLY
          </button>
          {snap.calibrating && (
            <div className="rounded-xl border border-sahra-sand/40 bg-sahra-sand/10 p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-sahra-sand"><span>AUTO-CALIBRATION</span><span>{Math.round(snap.calibrationProgress * 100)}%</span></div>
              <div className="grid grid-cols-5 gap-1">{[0,1,2,3,4].map((i) => <div key={i} className={`h-2 rounded-full ${snap.calibrationProgress > i / 5 ? 'bg-sahra-sand' : 'bg-night-700'}`} />)}</div>
              <p className="mt-2 text-[11px] leading-snug text-sahra-muted">Keep both eyes open and your head still. SAHRA finishes when the open-eye signal is steady.</p>
            </div>
          )}
          <div className="rounded-xl border border-night-line bg-night-950/50 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] text-sahra-muted"><span className="inline-flex items-center gap-1"><SlidersHorizontal size={12}/> Sensitivity</span><span className="font-mono text-sahra-blue">{snap.calibrated ? `yours ${snap.threshold.toFixed(2)}` : `avg ${snap.threshold.toFixed(2)}`}</span></div>
            <input aria-label="Sensitivity" type="range" min={0} max={2} step={1} defaultValue={1} onChange={(e) => engineRef.current?.setSensitivity(Number(e.target.value) as Sensitivity)} className="w-full accent-sahra-sand" />
            <div className="mt-2 grid grid-cols-3 text-center text-[10px] font-bold text-sahra-muted"><span>RELAXED</span><span className="text-sahra-sand">NORMAL</span><span>STRICT</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-sahra-muted">
            <div className="rounded-lg bg-night-800 p-2">TRIP <b className="block text-sahra-ink">{snap.tripSeconds}s</b></div>
            <div className="rounded-lg bg-night-800 p-2">BLINKS <b className="block text-sahra-ink">{snap.blinks}</b></div>
            <div className="rounded-lg bg-night-800 p-2">WARN <b className="block text-sahra-ink">{snap.warnings}</b></div>
            <div className="rounded-lg bg-night-800 p-2">ALARMS <b className="block text-sahra-ink">{snap.alarms}</b></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={save} className="sahra-btn rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white"><span className="inline-flex items-center gap-1"><Save size={12}/> Save</span></button>
            <button onClick={exportTxt} className="sahra-btn rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white"><span className="inline-flex items-center gap-1"><Download size={12}/> Export</span></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => engineRef.current?.toggleVoice()} className="sahra-btn rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white">{snap.voice ? <span className="inline-flex items-center gap-1"><Volume2 size={12}/> Voice on</span> : <span className="inline-flex items-center gap-1"><VolumeX size={12}/> Voice off</span>}</button>
            <button onClick={() => engineRef.current?.simulateMicrosleep()} className="sahra-btn rounded-lg border border-sahra-red/50 bg-sahra-red/15 px-3 py-2 text-[11px] font-bold text-sahra-red"><span className="inline-flex items-center gap-1"><Siren size={12}/> SIM ALARM</span></button>
          </div>
          <div className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-200"><Music2 size={12} /> Alarm sound</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-violet-300/80">saved on device</span>
            </div>
            <select aria-label="Alarm sound" value={alarmId} onChange={(e) => changeAlarm(e.target.value)} className="w-full rounded-lg border border-violet-300/20 bg-black/40 px-3 py-2 text-xs font-semibold text-white outline-none focus:border-violet-300/60">
              <option value="nfpa-fire-alarm">SAHRA NFPA Fire Alarm — instant, full volume</option>
              <option value="motorsirene">SAHRA Motorsirene — gradual siren</option>
              {hasSecret() && ARTIST_TRACKS.map((track) => <option key={track.id} value={track.id}>{track.label} · {formatBytes(track.bytes)}</option>)}
              {customAlarms.map((alarm) => <option key={alarm.id} value={alarm.id}>{alarm.name} · {formatBytes(alarm.size)}</option>)}
            </select>
            <input id="sahra-custom-alarm-file" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.opus,.aac" className="sr-only" onChange={uploadAlarm} />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label htmlFor="sahra-custom-alarm-file" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('sahra-custom-alarm-file')?.click(); } }} className="sahra-btn cursor-pointer rounded-lg border border-violet-300/30 bg-violet-500/15 px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-violet-100 hover:bg-violet-500/25"><span className="inline-flex items-center justify-center gap-1"><Upload size={12}/> Add</span></label>
              <button onClick={testAlarm} className="sahra-btn rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-white"><span className="inline-flex items-center justify-center gap-1"><Siren size={12}/> Test</span></button>
              <button onClick={removeCustomAlarm} disabled={!alarmId.startsWith('custom-')} className="sahra-btn rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400 disabled:cursor-not-allowed disabled:opacity-40"><span className="inline-flex items-center justify-center gap-1"><Trash2 size={12}/> Del</span></button>
            </div>
            {alarmMsg && <p role="status" className={`mt-2 rounded-md px-2 py-1.5 text-[10px] leading-snug [overflow-wrap:anywhere] ${alarmMsg.ok ? 'bg-violet-500/10 text-violet-100' : 'bg-red-500/15 text-red-300'}`}>{alarmMsg.text}</p>}
            <p className="mt-2 text-[10px] leading-snug text-violet-100/70">Custom alarms stay in this browser’s local storage and survive reloads — included in the offline single-file build.</p>
          </div>
          <div className="min-h-0 flex-1 rounded-xl border border-night-line bg-[#050a16] p-2 font-mono text-[10px] leading-relaxed text-sahra-muted [overflow-wrap:anywhere]">
            <div className="mb-1 flex items-center justify-between text-[9px] tracking-widest text-sahra-blue"><span>EVENT LOG</span><Mic size={10}/></div>
            <div className="max-h-36 overflow-y-auto [overflow-wrap:anywhere]">{log.length ? log.slice(-8).map((l, i) => <div key={i}>{l}</div>) : <div>Waiting for trip start…</div>}</div>
          </div>
          <p className="text-[10px] leading-snug text-sahra-muted"><Gauge size={10} className="inline"/> Assists the driver. Never drives. Camera needs localhost or HTTPS on phones.</p>
        </aside>
      </div>
    </div>
  );
}
