@echo off
REM SahraGuard GO PUBLIC - server + Cloudflare quick tunnel (free HTTPS for phone camera)
cd /d "%~dp0"
start "SahraGuard server" /min python server.py 8080
timeout /t 3 >nul
echo.
echo === Your PUBLIC link will appear below (https://xxxx.trycloudflare.com) ===
echo === Send it to judges / open it on your Android. Keep this window open. ===
echo.
tools\cloudflared.exe tunnel --protocol http2 --url http://localhost:8080
