@echo off
cd /d "%~dp0"
REM pythonw — без чёрного окна терминала
set "PY=%~dp0.venv\Scripts\pythonw.exe"
if not exist "%PY%" set "PY=%~dp0.venv\Scripts\python.exe"
if not exist "%PY%" set "PY=%LocalAppData%\Programs\Python\Python313\pythonw.exe"
if not exist "%PY%" set "PY=%LocalAppData%\Programs\Python\Python312\pythonw.exe"
if not exist "%PY%" set "PY=pythonw"
start "" /B "%PY%" "%~dp0chatgpt_tts_http.py"
