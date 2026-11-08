import { useEffect, useRef, useState, type ReactNode } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  ArrowRight,
  Bus,
  ChevronRight,
  Copy,
  Cpu,
  EyeOff,
  FileText,
  Gauge,
  GraduationCap,
  Landmark,
  Lock,
  MoonStar,
  Radio,
  Truck,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import LiveDemo from './components/LiveDemo';
import SecretAudio from './components/SecretAudio';
import { withSecret } from './lib/secret';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const CURRENT_YEAR = new Date().getFullYear();

const NAV = [
  ['Core', 'core.html'],
  ['Product', '#product'],
  ['How it works', '#how'],
  ['Privacy', '#privacy'],
  ['Use cases', '#use-cases'],
  ['FAQ', '#faq'],
] as const;

const TICKER: Array<[string, string]> = [
  ['UPLOAD', '0 BYTES'],
  ['INFERENCE', '100% LOCAL'],
  ['MODEL', '<11 MB VENDORED'],
  ['ACCOUNT', 'NONE'],
  ['REPORT', 'PLAIN .TXT'],
  ['TELEMETRY', 'NONE'],
  ['CAMERA', 'ON-DEVICE'],
];

const FEATURES: Array<{ icon: LucideIcon; title: string; body: string; tone: 'violet' | 'cyan' | 'emerald' }> = [
  { icon: EyeOff, title: 'No frames uploaded', body: 'FaceMesh runs in the browser. Video is processed in memory and discarded; SAHRA keeps only local stats if you save a trip.', tone: 'violet' },
  { icon: Gauge, title: 'Auto-calibration', body: 'It learns your open-eye baseline on this device, finishes early when the signal is steady, and falls back to device-average when it isn’t.', tone: 'cyan' },
  { icon: MoonStar, title: 'Ethnicity-agnostic', body: 'Detection uses eye-contour geometry normalized by inter-eye distance — no skin tone, ethnicity, age or “eye type” picker.', tone: 'violet' },
  { icon: WifiOff, title: 'Works offline', body: 'No account, API key, analytics or CDN at runtime. Open the local build with Wi-Fi off and the demo still runs.', tone: 'emerald' },
  { icon: Radio, title: 'Voice + siren alarm', body: 'SpeechSynthesis and Web Audio fire locally when microsleep is detected. No cloud call, no push service, no silent failure by design.', tone: 'cyan' },
  { icon: FileText, title: 'Local trip report', body: 'Duration, alarms, warnings, PERCLOS, blinks and events export as a plain-text file from the same device that watched the road.', tone: 'violet' },
] as const;

const USE_CASES = [
  { icon: Landmark, title: 'Police patrol', body: 'Night watch, highway stops, standby — fatigue is caught before the wheel moves.' },
  { icon: GraduationCap, title: 'Madrasa & school', body: 'A private, non-recording guard for drivers on memorisation trips and school runs.' },
  { icon: Truck, title: 'Depots & transport', body: 'Port trucks, warehouse vehicles, ambulances — logs stay on the machine and export when needed.' },
  { icon: Bus, title: 'Public transport', body: 'Bus and minibus drivers get a local alert before drowsiness becomes a route problem.' },
] as const;

const FAQ = [
  ['Does video leave this device?', 'No. Frames are decoded, measured and discarded in memory. SAHRA does not upload video, does not record audio, and does not send telemetry.'],
  ['Does it need the internet?', 'No. The model, WASM, JavaScript and styles are vendored locally. After the page loads, it runs with networking disabled.'],
  ['Is it a medical device?', 'No. SAHRA assists a driver or operator; it never drives and it is not a diagnosis. Treat it as a warning system, not a guarantee.'],
  ['Why did the eye overlay sit below my eyes before?', 'Video and canvas used different mirror transforms and display heights. The overlay now shares the same aspect-ratio box and draws landmarks in the same pixel space.'],
  ['What should the stand machine show?', 'Use localhost for the laptop demo. For phones/iPads, serve HTTPS or use a tunnel; plain LAN HTTP gets blocked by browser camera permissions.'],
] as const;


function Logo({ large = false }: { large?: boolean }) {
  return (
    <a href="#top" className="inline-flex items-center gap-3" aria-label="SAHRA — home">
      <span className="grid place-items-center rounded-full bg-gradient-to-br from-[#8b5cf6] via-[#06b6d4] to-[#10b981] p-[3px]">
        <span className="grid place-items-center rounded-full bg-[#050505]" style={{ width: large ? 42 : 30, height: large ? 42 : 30 }}>
          <EyeOff size={large ? 20 : 15} className="text-white" />
        </span>
      </span>
      <span className={large ? 'font-display text-4xl text-white' : 'font-display text-xl text-white'}>SAHRA</span>
    </a>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.35em] text-neutral-500">{children}</p>;
}

function FeatureCard({ icon: Icon, title, body, tone }: (typeof FEATURES)[number]) {
  const toneClass =
    tone === 'violet'
      ? 'bg-[#8b5cf6]/12 text-[#a78bfa] ring-[#8b5cf6]/30'
      : tone === 'cyan'
        ? 'bg-[#06b6d4]/12 text-[#22d3ee] ring-[#06b6d4]/30'
        : 'bg-[#10b981]/12 text-[#34d399] ring-[#10b981]/30';
  return (
    <article className="group rounded-3xl border border-white/5 bg-white/[0.02] p-7 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-3 hover:border-[#8b5cf6]/40 hover:bg-white/[0.035] hover:shadow-[0_0_30px_-12px_rgba(139,92,246,0.45)]">
      <div className={`grid h-12 w-12 place-items-center rounded-2xl ring-1 ${toneClass}`}>
        <Icon size={22} className="transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:rotate-6 group-hover:scale-110" />
      </div>
      <h3 className="font-display mt-6 text-2xl text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-neutral-400">{body}</p>
    </article>
  );
}

function CodeWindow() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText('cd drowsiness-guard\npython server.py 8080\nhttp://localhost:8080');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#080808]/80 shadow-[0_0_60px_-30px_rgba(6,182,212,0.35)] backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400/50" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/50" />
          <span className="h-3 w-3 rounded-full bg-green-400/50" />
        </div>
        <div className="font-mono text-xs text-neutral-500">run-local.sh</div>
        <button onClick={copy} className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-white/5 hover:text-white" aria-label="Copy local run commands">
          <Copy size={15} />
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-6">
        {copied ? <code className="text-emerald-300">Copied local run commands.</code> : (
          <code>
            <span className="text-neutral-500"># run SAHRA on this machine — no install beyond Python</span>{'\n'}
            <span className="text-violet-300">cd</span>{' '}<span className="text-emerald-300">drowsiness-guard</span>{'\n'}
            <span className="text-violet-300">python</span>{' '}<span className="text-emerald-300">server.py 8080</span>{'\n'}
            <span className="text-neutral-500"># open the local build in the stand browser</span>{'\n'}
            <span className="text-cyan-300">{'http://localhost:8080'}</span>{'\n'}
            <span className="text-neutral-500"># phone/iPad camera? use HTTPS or a tunnel — browsers block plain HTTP camera access</span>
          </code>
        )}
      </pre>
    </div>
  );
}

export default function App() {
  const root = useRef<HTMLElement | null>(null);
  const [alarmOn, setAlarmOn] = useState(false);

  useEffect(() => {
    if (reduceMotion()) return;
    const lenis = new Lenis({ autoRaf: false, anchors: true, duration: 1.05 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  useGSAP(() => {
    if (reduceMotion()) return;
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 24 }, {
        opacity: 1,
        y: 0,
        duration: 0.62,
        ease: 'power3.out',
        immediateRender: false,
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      });
    });
    ScrollTrigger.refresh();
  }, { scope: root });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  }, []);

  return (
    <main ref={root} id="top" className="relative min-h-screen overflow-x-clip bg-[#030303] text-[#f5f5f5]">
      <div aria-hidden="true" className={`alarm-flash ${alarmOn ? 'on' : ''}`} />

      {}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="orb left-[12%] top-[-10%] h-[520px] w-[520px] bg-[#8b5cf6]/25" />
        <div className="orb right-[8%] top-[18%] h-[360px] w-[360px] bg-[#06b6d4]/14" style={{ animationDelay: '-5s' }} />
        <div className="orb bottom-[28%] left-1/2 h-[460px] w-[460px] -translate-x-1/2 bg-[#8b5cf6]/16" style={{ animationDelay: '-9s' }} />
      </div>

      {}
      <header className="fixed left-1/2 top-5 z-40 w-[96vw] max-w-6xl -translate-x-1/2">
        <nav className="glass-pill flex items-center justify-between gap-4 px-4 py-2 sm:px-5">
          <Logo />
          <div className="hidden items-center gap-4 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400 lg:flex">
            {NAV.map(([label, href]) => (
              <a key={label} href={withSecret(href)} className="transition-colors hover:text-white">{label}</a>
            ))}
          </div>
          <a href="#demo" className="whitespace-nowrap rounded-full bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-black transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105 active:scale-95">Run demo</a>
        </nav>
      </header>

      {}
      <section id="product" className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-4 pb-24 pt-32 text-center sm:px-6">
        <div className="badge-pill reveal" style={{ animationDelay: '0ms' }}>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
          Offline · In-memory · No upload
        </div>
        <h1 className="font-display reveal mt-8 text-6xl leading-[0.9] text-white sm:text-8xl lg:text-9xl" style={{ animationDelay: '120ms' }}>
          The eye never<br />
          <span className="shimmer-text">sleeps.</span>
        </h1>
        <p className="reveal mt-7 max-w-2xl text-lg leading-7 text-neutral-400" style={{ animationDelay: '260ms' }}>
          SAHRA watches eye openness on this device and raises a local alarm before a microsleep becomes a crash.<br />
          No server. No upload. Free to run locally.
        </p>
        <div className="reveal mt-10 flex flex-col items-center gap-4 sm:flex-row" style={{ animationDelay: '420ms' }}>
          <a href="#demo" className="shiny-border transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105 active:scale-95">
            <span className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-white">Start private demo <ArrowRight size={16} /></span>
          </a>
          <a href={withSecret('core.html')} className="sahra-btn inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-violet-100 transition-colors hover:border-violet-300/70 hover:bg-violet-500/20"><Cpu size={16} /> Sahra Core</a>
          <a href="#how" className="text-sm font-semibold text-neutral-400 underline decoration-white/10 underline-offset-8 transition-colors hover:text-white">How it works</a>
        </div>

        {}
        <div id="demo" className="reveal mt-14 w-full max-w-5xl scroll-mt-28 text-left" style={{ animationDelay: '620ms' }}>
          <LiveDemo onAlarm={setAlarmOn} />
        </div>
      </section>

      {}
      <div className="relative border-y border-white/5 bg-black/40 py-4 backdrop-blur-md" aria-hidden="true">
        <div className="ticker">
          <div className="ticker-track">
            {[...TICKER, ...TICKER].map(([label, value], i) => (
              <div key={i} className="flex items-baseline gap-3 whitespace-nowrap">
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-600">{label}</span>
                <span className="font-mono text-sm font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {}
      <section className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6" data-reveal>
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>What SAHRA actually does</SectionLabel>
          <h2 className="font-display mt-4 text-5xl leading-[0.95] text-white sm:text-7xl">Premium safety,<br /><span className="shimmer-text">zero cloud.</span></h2>
          <p className="mt-5 text-neutral-400">Every claim on this page is implemented locally in the build — no marketing filler, no fake integrations, no invented compliance badges.</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
        </div>
      </section>

      {}
      <section id="how" className="relative mx-auto grid max-w-7xl scroll-mt-28 gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center" data-reveal>
        <div>
          <SectionLabel>How it works</SectionLabel>
          <h2 className="font-display mt-4 text-5xl leading-[0.95] text-white sm:text-6xl">Camera in.<br />Alarm out.<br /><span className="text-neutral-500">Nothing uploaded.</span></h2>
          <ol className="mt-8 space-y-4">
            {[
              'Face the camera. Frames stay in memory.',
              'FaceMesh maps eye contours locally.',
              'EAR + PERCLOS track openness over a rolling minute.',
              'Voice, siren and red flash fire inside this device.',
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-4 text-neutral-300">
                <span className="font-mono text-xs text-[#22d3ee]">0{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <CodeWindow />
      </section>

      {}
      <section id="privacy" className="relative mx-auto max-w-7xl scroll-mt-28 px-4 pb-24 sm:px-6" data-reveal>
        <div className="grid gap-6 rounded-3xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl md:grid-cols-3 lg:p-10">
          {[
            ['No video leaves', 'Frames are decoded, measured and discarded in this browser tab.'],
            ['No audio leaves', 'Voice alarms use the device speaker and local speechSynthesis.'],
            ['No account required', 'SAHRA stores trip reports on the same device only.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/5 bg-black/30 p-6">
              <Lock size={20} className="text-[#22d3ee]" />
              <h3 className="font-display mt-4 text-2xl text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {}
      <section id="use-cases" className="relative mx-auto max-w-7xl scroll-mt-28 px-4 pb-24 sm:px-6" data-reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel>Built for real watches</SectionLabel>
            <h2 className="font-display mt-3 text-5xl leading-[0.95] text-white sm:text-6xl">For people who<br />sit awake so<br />others can sleep.</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-neutral-400">Best for night shifts, long routes, school transport and any job where one heavy eyelid can become an emergency.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => {
            const Icon = u.icon;
            return (
              <article key={u.title} className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 transition-colors hover:border-white/10">
                <Icon size={24} className="text-[#a78bfa]" />
                <h3 className="mt-5 font-semibold text-white">{u.title}</h3>
                <p className="mt-2 text-sm leading-6 text-neutral-400">{u.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      {}
      <section id="faq" className="relative mx-auto max-w-5xl scroll-mt-28 px-4 pb-24 sm:px-6" data-reveal>
        <SectionLabel>Plain answers</SectionLabel>
        <h2 className="font-display mt-3 text-5xl text-white sm:text-6xl">No fine print theatre.</h2>
        <div className="mt-10 divide-y divide-white/5 overflow-hidden rounded-3xl border border-white/5">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group bg-white/[0.02] p-6 open:bg-white/[0.035]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-lg font-semibold text-white">{q}<ChevronRight className="shrink-0 text-[#06b6d4] transition-transform group-open:rotate-90" size={20} /></summary>
              <p className="mt-4 max-w-3xl leading-7 text-neutral-400">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {}
      <section className="relative mx-auto max-w-7xl px-4 pb-16 sm:px-6" data-reveal>
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#050505] px-6 py-16 text-center">
          <div className="absolute left-1/2 top-0 h-full w-2/3 -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.34),transparent_62%)]" aria-hidden="true" />
          <p className="relative font-mono text-[10px] uppercase tracking-[0.35em] text-neutral-500">SAHRA — offline drowsiness guard</p>
          <h2 className="font-display relative mx-auto mt-5 max-w-4xl text-6xl leading-[0.9] text-white sm:text-8xl">Start the<br /><span className="shimmer-text">private demo.</span></h2>
          <a href="#demo" className="shiny-border relative mt-10 inline-flex transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-105 active:scale-95">
            <span className="inline-flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-white">Run on this device <ArrowRight size={16} /></span>
          </a>
        </div>
      </section>

      {}
      <footer className="relative border-t border-white/5 bg-[#050505] px-4 py-12 text-sm text-neutral-400 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo large />
            <p className="mt-5 max-w-xs leading-6 text-neutral-500">A free, private, on-device drowsiness guard. Assists the driver — it never drives.</p>
          </div>
          {[
            ['Product', [['Live demo', '#demo'], ['How it works', '#how'], ['Privacy', '#privacy'], ['FAQ', '#faq']]],
            ['Use cases', [['Police patrol', '#use-cases'], ['Madrasa & school', '#use-cases'], ['Depots & fleets', '#use-cases'], ['Transport', '#use-cases']]],
            ['Build', [['Local server', '#how'], ['Offline model', '#how'], ['Export report', '#demo'], ['Camera needs', '#faq']]],
          ].map(([heading, links]) => (
            <div key={heading as string}>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-600">{heading as string}</h3>
              <ul className="mt-4 space-y-2">
                {(links as Array<[string, string]>).map(([label, href]) => <li key={label}><a className="transition-colors hover:text-white" href={href}>{label}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-12 flex max-w-7xl flex-col justify-between gap-3 border-t border-white/5 pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-600 sm:flex-row">
          <span>© {CURRENT_YEAR} SAHRA — Offline Drowsiness Guard</span>
          <span className="inline-flex items-center gap-3">
            <span>Local only · no cloud · no telemetry</span>
            <a href="https://github.com/DevilishRar/sahra" target="_blank" rel="noreferrer noopener" aria-label="SAHRA on GitHub" className="text-neutral-600 transition-colors hover:text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.7 5.5.7 11.8c0 5 3.3 9.3 7.9 10.8.6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.4-1.3-1.8-1.3-1.8-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.3.9.1-.7.4-1.2.7-1.5-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.4 6.6 18.4 7 19.4 7.3c.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6a11.3 11.3 0 0 0 7.9-10.8C23.3 5.5 18.3.5 12 .5Z"/></svg>
            </a>
          </span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> assists the driver</span>
        </div>
      </footer>
      <SecretAudio />
    </main>
  );
}
