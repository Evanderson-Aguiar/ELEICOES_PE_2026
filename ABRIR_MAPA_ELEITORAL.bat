@echo off
setlocal

cd /d "%~dp0"

rem Inicia o servidor local em uma janela minimizada.
where py >nul 2>&1
if %errorlevel%==0 (
    start "Mapa Eleitoral PE 2026" /min /d "%~dp0" py -3 -m http.server 8000 --bind 127.0.0.1
) else (
    start "Mapa Eleitoral PE 2026" /min /d "%~dp0" python -m http.server 8000 --bind 127.0.0.1
)

rem Aguarda o servidor iniciar e abre a página no navegador padrão.
timeout /t 3 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html"

endlocal
