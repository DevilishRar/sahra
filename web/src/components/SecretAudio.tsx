import { useState } from 'react';
import { Lock, Music2, X } from 'lucide-react';
import { hasSecret } from '../lib/secret';

const TRACKS = [
  { src: 'addiction.mp3', title: 'LONOWN — Asenssia', sub: 'addiction' },
  { src: 'addiction-bass-boosted.mp3', title: 'babyusoshy — LONOWN', sub: 'addiction (bass boosted · sped up)' },
];

const resolve = (file: string) =>
  (window as any).__SAHRA_URLS__?.[file] || `${import.meta.env.BASE_URL}audio-artists/${file}`;

export default function SecretAudio() {
  const [open, setOpen] = useState(true);
  if (!hasSecret()) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 w-[320px] max-w-[calc(100vw-2.5rem)]">
      {open ? (
        <div className="rounded-2xl border border-violet-400/30 bg-[#0b0714]/90 p-4 shadow-[0_0_50px_-18px_rgba(139,92,246,0.6)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-500/20 text-violet-300"><Lock size={13} /></span>
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-violet-300">Unlocked — session</p>
                <p className="truncate text-[11px] font-bold text-white">LONOWN</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Hide session" className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"><X size={14} /></button>
          </div>
          <div className="mt-3 space-y-3">
            {TRACKS.map((track) => (
              <div key={track.src} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-500">{track.title}</p>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug text-white">{track.sub}</p>
                <audio className="mt-2 h-8 w-full" controls preload="none" src={resolve(track.src)} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-violet-200 backdrop-blur-xl transition-colors hover:border-violet-300/60"><Music2 size={13} /> Session</button>
      )}
    </div>
  );
}
