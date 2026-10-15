# Cursor TTS

Локальная озвучка текста на **Windows**: панель PyQt, фоновый демон, очередь, пауза на слоге, хоткеи AutoHotkey, движки Tera / Edge / Silero / Qwen / OpenAI.

Два режима:

| Режим | Кому | Cursor нужен? |
|-------|------|---------------|
| **Обычный текст** | озвучить файл, выделение, тест из панели | **нет** |
| **Авто Agent** | ответы Cursor Agent после хука | да |

> Отдельный репозиторий для витрины. Раньше лежало внутри [Portfolio](https://github.com/Random2079/Portfolio) — здесь только TTS.

---

## Демо

**Видео (~24 с):** Cursor Agent отвечает → текст озвучивается → панель показывает «играет», можно выделить фрагмент и прослушать отдельно (Silero).

[Скачать / открыть demo_151324.mp4](docs/demo_151324.mp4)

| Agent + ответ | Панель «играет» | Выделение → озвучка |
|:---:|:---:|:---:|
| ![Старт](docs/screenshots/demo_151324_start.png) | ![Середина](docs/screenshots/demo_151324_mid.png) | ![Конец](docs/screenshots/demo_151324_end.png) |

---

## A. Без Cursor — просто озвучка

Хук Cursor **не нужен**. Достаточно клона, Python и панели (или CLI).

### 1. Зависимости

```powershell
git clone https://github.com/Random2079/Cursor-TTS.git
cd Cursor-TTS
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Панель

`Start_TTS_Panel.vbs` / `Start_TTS_Panel.bat` — поднимает демон и прогрев.

В панели выбери движок (для быстрого старта — **Edge**: онлайн, без ключа) и нажми тест / озвучь текст.

### 3. Из командной строки

Текст в UTF-8 файл:

```powershell
Set-Content -Encoding utf8 say.txt "Привет. Это проверка озвучки без Cursor."
python speak_edge.py say.txt
```

Если демон не запущен — клиент поднимет его сам.

| Команда | Действие |
|---------|----------|
| `python speak_edge.py say.txt` | озвучить файл |
| `python speak_edge.py --stop` | стоп + очистить очередь |
| `python speak_edge.py --pause-toggle` | пауза / продолжить |
| `python speak_edge.py --warmup` | прогрев движка |

Движок и голос задаются в `tts_config.json` или в панели (не через `--voice` в CLI).

### 4. Хоткеи (опционально)

Нужен [AutoHotkey](https://www.autohotkey.com/). Панель обычно поднимает `hotkey_tts.ahk`.

| Комбинация | Действие |
|------------|----------|
| `Ctrl+Shift+S` | озвучить выделение (любое окно) |
| `Ctrl+Shift+P` | пауза / продолжить |
| `Ctrl+Shift+X` | стоп: речь + очередь |
| `Ctrl+Shift+T` | авто ON/OFF (имеет смысл с хуком Cursor) |

---

## B. С Cursor — авто-озвучка ответов агента

Сначала сделай **раздел A** (зависимости + панель). Потом один раз поставь user-hook:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install_cursor_hook.ps1
```

Перезапусти Cursor. Держи открытой панель TTS. Авто работает во всех workspace’ах.

Если перенёс папку клона — запусти install ещё раз (обновит `tts_root.txt`).

| Что | Само? | Что сделать |
|-----|-------|-------------|
| Зависимости Python | нет | `pip install -r requirements.txt` |
| Панель / демон / ручная озвучка | почти | раздел A |
| Авто после ответа агента | **нет** | `scripts\install_cursor_hook.ps1` + перезапуск Cursor |
| Хоткеи | нет | AutoHotkey + панель |
| Модели (Tera/Silero/Qwen) | нет | скачиваются/ставятся под выбранный движок |

Почему хук отдельно: Cursor не подхватывает project-hooks из клона «навсегда для всех чатов». Project-хуки в каждом репо легко ломают парсер (`loop_limit: 0`). В репо `hooks.json` **пустой**; канон — один user-hook в `%USERPROFILE%\.cursor\`.

---

## Архитектура

```
  [опционально] Cursor user hook (~/.cursor/hooks/…)
        │
        ▼
  speak_edge.py  ──►  tts_daemon.py  ──►  Tera / Edge / Silero / Qwen / OpenAI
        ▲                      │
   TTS_Panel.py          очередь + warmup
   hotkey_tts.ahk
```

Без Cursor цепочка та же, только вход — панель / CLI / хоткей, а не хук.

| Компонент | Файл |
|-----------|------|
| Клиент | `speak_edge.py` |
| Демон | `tts_daemon.py` |
| Панель | `TTS_Panel.py` |
| Текст | `text_prep.py` |
| Хоткеи | `hotkey_tts.ahk` |
| Хук (шаблон) | `.cursor/hooks/tts_after_response.py` |
| Хук (живой, после install) | `%USERPROFILE%\.cursor\hooks\tts_after_response.py` |

Статус и очередь: [`MAP.md`](MAP.md).  
Контракты Stop / warmup / Авто: [`docs/TZ.md`](docs/TZ.md).

## Движки

| Engine | Роль | Cold start |
|--------|------|------------|
| **tera** | дефолт, качество | 30–90 с |
| **edge** | онлайн, без ключа — удобный старт без Cursor | ~1–7 с |
| **local** | Silero офлайн | после warmup быстро |
| **qwen** | GPU, лучшее качество | долго |
| **openai** | облако | ключ + VPN |

## Настройки

`tts_config.json` — движок, голос, громкость, пауза между кусками.  
OpenAI: `.env` (`OPENAI_API_KEY=...`).

## Отладка

| Что | Где |
|-----|-----|
| Озвучка | `tts_debug.log` |
| Демон | `python speak_edge.py --restart-daemon --warmup` |
| Хук Cursor | `%TEMP%\cursor_tts_hook.log` |

В логе хука: `Hook invoked (user-global)` → `TTS auto queued`.  
Если `hook stop ignored (status=completed)` — норма, речь не рвётся.

## Тесты

```powershell
python -m unittest test_tts_playback.py test_text_prep.py -v
```

---

Pet-project; форкай с пониманием, что модели и ключи — на тебе.
