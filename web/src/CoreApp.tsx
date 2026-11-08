import { useState } from 'react';
import { ArrowLeft, Eye, WifiOff } from 'lucide-react';
import LiveDemo from './components/LiveDemo';
import SecretAudio from './components/SecretAudio';
import { withSecret } from './lib/secret';

export default function CoreApp() {
  const [alarmOn, setAlarmOn] = useState(false);
  return (
    <main id="top" className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#030303] text-[#f5f5f5]">
      <div aria-hidden="true" className={`alarm-flash ${alarmOn ? 'on' : ''}`} />

      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 bg-black/60 px-2 backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-300 sm:gap-3 sm:text-xs">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#8b5cf6] via-[#06b6d4] to-[#10b981] p-[1px] sm:h-7 sm:w-7">
            <span className="grid h-full w-full place-items-center rounded-full bg-[#050505]"><Eye size={13} /></span>
          </span>
          <span className="font-display truncate text-base normal-case tracking-normal text-white sm:text-lg">SAHRA Core</span>
          <span className="hidden text-neutral-600 md:inline">/</span>
          <span className="hidden truncate text-neutral-400 md:inline">Full-screen on-device drowsiness engine</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.22em] text-emerald-300 sm:inline-flex"><WifiOff size={11} /> Local only</span>
          <a href={withSecret('index.html')} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-200 transition-colors hover:border-white/25 hover:text-white"><ArrowLeft size={12} /> Main page</a>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <LiveDemo onAlarm={setAlarmOn} fullscreen />
      </div>
      <SecretAudio />
    </main>
  );
}
