const BRIDGE = "http://127.0.0.1:47392";

function fromChatGPT(sender) {
  const url = (sender && sender.tab && sender.tab.url) || "";
  return url.startsWith("https://chatgpt.com/");
}

async function post(path, body) {
  const response = await fetch(BRIDGE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }
  if (!response.ok) {
    return { ok: false, error: data.error || String(response.status) };
  }
  return data;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!fromChatGPT(sender)) {
    sendResponse({ ok: false, error: "forbidden" });
    return;
  }
  const type = msg && msg.type;
  if (type === "speak") {
    const text = typeof msg.text === "string" ? msg.text : "";
    post("/speak", { text })
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  if (type === "stop") {
    post("/stop", {})
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  sendResponse({ ok: false, error: "unknown" });
});
