(() => {
  const BAR = "data-cursor-tts-bar";

  function assistantRoots() {
    const nodes = [...document.querySelectorAll('[data-message-author-role="assistant"]')];
    const pool = nodes.length
      ? nodes
      : [...document.querySelectorAll('[data-turn="assistant"]')];
    return pool.filter((el) => {
      if (el.closest('[data-message-author-role="user"]')) return false;
      if (el.getAttribute("data-message-author-role") === "user") return false;
      if (el.getAttribute("data-turn") === "user") return false;
      return !pool.some((other) => other !== el && el.contains(other));
    });
  }

  function answerText(root) {
    const scope =
      root.querySelector(".markdown, .prose, [class*='markdown']") || root;
    const clone = scope.cloneNode(true);
    clone.querySelectorAll(`[${BAR}], button, textarea, input, svg`).forEach((node) => {
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
      "padding:4px 8px",
      "border-radius:8px",
      "border:1px solid currentColor",
      "background:transparent",
      "color:inherit",
      "cursor:pointer",
    ].join(";");
    return button;
  }

  function attach(root) {
    if (root.querySelector(`:scope > [${BAR}]`)) return;
    const bar = document.createElement("div");
    bar.setAttribute(BAR, "1");
    bar.style.cssText = "display:flex;gap:8px;margin:8px 0 4px;align-items:center;";
    const speak = makeButton("🔊 Озвучить");
    const stop = makeButton("⏹ Стоп");
    speak.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = answerText(root);
      if (text.length < 2) {
        speak.title = "В ответе нет текста";
        return;
      }
      speak.disabled = true;
      chrome.runtime.sendMessage({ type: "speak", text }, (reply) => {
        speak.disabled = false;
        const failed = chrome.runtime.lastError || !reply || reply.ok === false;
        speak.title = failed ? "Мост Cursor-TTS не ответил" : "";
      });
    });
    stop.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chrome.runtime.sendMessage({ type: "stop" }, () => {
        stop.title = chrome.runtime.lastError ? "Мост Cursor-TTS не ответил" : "";
      });
    });
    bar.append(speak, stop);
    root.append(bar);
  }

  function scan() {
    assistantRoots().forEach(attach);
  }

  let pending = 0;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      scan();
    }, 200);
  });

  scan();
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
