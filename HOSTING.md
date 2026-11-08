# SahraGuard HOSTING — WAN + self-host guide

## Option 1 — Go public NOW from your PC (tournament demo)
Double-click **`run-public.bat`**. It starts the server + a Cloudflare quick
tunnel and prints a link like `https://ab12cd34.trycloudflare.com`.
- Send that link to judges / open it on your Android.
- It's HTTPS, so the phone camera works (plain `http://192.168.x.x` blocks it).
- Your PC must stay on with the window open. Link changes every restart.
- Tested working (see proof below).

## Option 2 — Anyone hosts their own (2 steps, Python only, no installs)
1. Unzip `sahraguard-selfhost.zip` anywhere.
2. Run `python server.py 8080` → open `http://localhost:8080`.
   For their own public link they run `run-public.bat` (needs `tools\cloudflared.exe`, included).

## Option 4 — Vercel + GitHub (PC stays OFF, best for low-traffic testing)
Yes, this works — the whole app is already static-capable: FaceMesh, EAR/
PERCLOS, alarm, voice all run 100% in the browser. The only server bits were
trip-save and report-export, and those now **fall back automatically**:
no API → saves to the device (localStorage) + builds the report in-page.
Nothing was removed — same code hits the Python API when hosted with it.
1. Push this folder to GitHub (vercel.json + .gitignore included).
   Root Directory on Vercel = `drowsiness-guard` if the repo contains more.
2. Vercel → Add New Project → Import → Deploy. No build command, no env vars.
   `outputDirectory: public` is already set in vercel.json.
3. You get `https://your-app.vercel.app` (HTTPS → phone camera works).
Limits to know: trips save per-device, not shared (no central database on
static hosting). For shared/judge-visible trip history use Option 1 or 3.
Model files (~11MB) are under Vercel's 100MB free limit — fine.

## Option 3 — Permanent cloud link with backend (PC can be off)
Build and run the included Dockerfile anywhere (Render / Fly.io / VPS):
```
docker build -t sahraguard .
docker run -p 8080:8080 sahraguard
```
Then map your domain. Sessions persist in `sessions/` (mount a volume).

## Stable link (not random trycloudflare)
Free Cloudflare account → Zero Trust → Tunnels → create named tunnel →
route your hostname → run `cloudflared tunnel run <name>`. Same PC.

## Proof (ran 2026-09-15)
- Local: all 13 URLs 200, `/api/plan` OK, EAR unit test OK.
- WAN: public trycloudflare URL served homepage **200** (then tunnel shut down).
- NOTE: after the link appears, wait ~60–90s before sharing (Cloudflare route
  needs a minute to propagate — first loads may 502, then it works).
- NOTE: `run-public.bat` forces `--protocol http2` because some networks
  (like ours) block QUIC/UDP.

## Safety notes
- The site stores trip reports on whoever hosts it — their disk, their data.
- Camera video NEVER leaves the device: FaceMesh runs in the browser,
  only anonymous stats (alarms, PERCLOS) are saved. Say this to judges.
