# Cursor hooks (этот репозиторий)

Хук лежит в `hooks/tts_after_response.py`.

**Не правь `hooks.json` здесь вручную с абсолютными путями** — Cursor читает user-level конфиг:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install_cursor_hook.ps1
```

Скрипт допишет `afterAgentResponse` и `stop` в `%USERPROFILE%\.cursor\hooks.json`, вызывая `run_hook.cmd` из корня репозитория.
