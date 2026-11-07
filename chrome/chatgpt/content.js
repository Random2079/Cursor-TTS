(() => {
  const BAR = "data-cursor-tts-bar";
  const FAB = "data-cursor-tts-fab";

  function assistantRoots() {
    const selectors = [
      '[data-message-author-role="assistant"]',
      '[data-turn="assistant"]',
      'article[data-testid^="conversation-turn"]',
      'div[data-message-id]',
    ];
    const found = [];
    for (const sel of selectors) {
      found.push(...document.querySelectorAll(sel));
    }
    const pool = [...new Set(found)].filter((el) => {
      if (el.closest('[data-message-author-role="user"]')) return false;
      if (el.getAttribute("data-message-author-role") === "user") return false;
      if (el.getAttribute("data-turn") === "user") return false;
      const text = (el.innerText || "").trim();
      if (text.length < 8) return false;
      return !found.some((other) => other !== el && el.contains(other));
    });
    // Только ответы ассистента: если у узла нет role, берём последние крупные блоки без user.
    if (pool.length) return pool;
    return [...document.querySelectorAll("article, [data-message-id]")].filter((el) => {
      if (el.closest('[data-message-author-role="user"]')) return false;
      return (el.innerText || "").trim().length >= 40;
    });
  }

  function lastAssistantText() {
    const roots = assistantRoots();
    if (!roots.length) {
      // запас: весь основной столбец чата без composer
      const main =
        document.querySelector("main") ||
        document.querySelector('[role="main"]') ||
        document.body;
      const clone = main.cloneNode(true);
      clone
        .querySelectorAll(
          `form, textarea, input, [${FAB}], [${BAR}], nav, button, svg`
        )
        .forEach((node) => node.remove());
      return (clone.innerText || "").replace(/\u00a0/g, " ").trim();
    }
    return answerText(roots[roots.length - 1]);
  }

  function answerText(root) {
    const scope =
      root.querySelector(
        ".markdown, .prose, [class*='markdown'], [data-message-author-role='assistant']"
      ) || root;
    const clone = scope.cloneNode(true);
    clone
      .querySelectorAll(`[${BAR}], [${FAB}], button, textarea, input, svg, nav`)
      .forEach((node) => {
        node.remove();
      });
    return (clone.innerText || "").replace(/\u00a0/g, " ").trim();
  }

  function makeButton(label) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = [
      "font:13px/1.2 sans-serif",
      "padding:6px 10px",
      "border-radius:8px",
      "border:1px solid currentColor",
      "background:transparent",
      "color:inherit",
      "cursor:pointer",
    ].join(";");
    return button;
  }

  function speakText(text, onDone) {
    if (!text || text.length < 2) {
      if (onDone) onDone(false, "empty");
      return;
    }
    chrome.runtime.sendMessage({ type: "speak", text }, (reply) => {
      const failed = chrome.runtime.lastError || !reply || reply.ok === false;
      if (onDone) onDone(!failed, failed ? "bridge" : "ok");
    });
  }

  function stopSpeak(onDone) {
    chrome.runtime.sendMessage({ type: "stop" }, () => {
      if (onDone) onDone(!chrome.runtime.lastError);
    });
  }

  function attach(root) {
    if (root.querySelector(`[${BAR}]`)) return;
    const bar = document.createElement("div");
    bar.setAttribute(BAR, "1");
    bar.style.cssText =
      "display:flex;gap:8px;margin:8px 0 4px;align-items:center;flex-wrap:wrap;";
    const speak = makeButton("Озвучить");
    const stop = makeButton("Стоп");
    speak.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = answerText(root);
      speak.disabled = true;
      speakText(text, (ok, why) => {
        speak.disabled = false;
        speak.title = ok
          ? ""
          : why === "empty"
            ? "В ответе нет текста"
            : "Мост Cursor-TTS не ответил — галка Chrome в панели?";
      });
    });
    stop.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      stopSpeak((ok) => {
        stop.title = ok ? "" : "Мост Cursor-TTS не ответил";
      });
    });
    bar.append(speak, stop);
    root.append(bar);
  }

  function ensureFab() {
    if (document.querySelector(`[${FAB}]`)) return;
    const fab = document.createElement("div");
    fab.setAttribute(FAB, "1");
    fab.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:96px",
      "z-index:2147483646",
      "display:flex",
      "gap:8px",
      "padding:8px",
      "border-radius:12px",
      "background:rgba(20,20,20,0.88)",
      "color:#fff",
      "box-shadow:0 4px 16px rgba(0,0,0,0.35)",
      "font:13px/1.2 sans-serif",
    ].join(";");
    const speak = makeButton("TTS Озвучить");
    const stop = makeButton("Стоп");
    speak.style.borderColor = "#fff";
    stop.style.borderColor = "#fff";
    speak.style.color = "#fff";
    stop.style.color = "#fff";
    speak.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      speak.disabled = true;
      const text = lastAssistantText();
      speakText(text, (ok, why) => {
        speak.disabled = false;
        speak.title = ok
          ? `символов: ${text.length}`
          : why === "empty"
            ? "Не нашёл текст ответа"
            : "Мост Cursor-TTS не ответил — галка Chrome в панели?";
      });
    });
    stop.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      stopSpeak((ok) => {
        stop.title = ok ? "" : "Мост Cursor-TTS не ответил";
      });
    });
    fab.append(speak, stop);
    document.documentElement.append(fab);
  }

  function scan() {
    ensureFab();
    assistantRoots().forEach(attach);
  }

  let pending = 0;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      scan();
    }, 250);
  });

  scan();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
