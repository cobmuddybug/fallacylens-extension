// Fallacy Lens service worker: the right-click menu, injecting the card, and the card's connection.
// The only code that reads the OpenRouter key; the card receives scores, never the key.
import { runCheck } from "./check.js";
import * as keyStore from "./keystore.js";
import { MAX_CHARS } from "./config.js";

const MENU_ID = "fallacylens-check";
const PORT_NAME = "fallacylens-card";

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: "Check for fallacies", contexts: ["selection"] });
  });
  if (reason === "install") chrome.runtime.openOptionsPage();
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) check(info, tab);
});

const NARROW_FRAME = 356; // a card needs 340 px plus gutters

/** In a frame too small for the card, read the selection there and show the card on the top page. */
async function chooseFrame(tabId, frameId, fallback) {
  if (!frameId) return { frameId: 0, fallback };
  const [probe] = await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: () => {
      let a = document.activeElement;
      while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
      const field = a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT") && a.selectionEnd > a.selectionStart;
      return { width: innerWidth, text: field ? a.value.slice(a.selectionStart, a.selectionEnd) : getSelection()?.toString() ?? "" };
    },
  });
  const { width, text } = probe?.result ?? {};
  return width < NARROW_FRAME ? { frameId: 0, fallback: text?.trim() ? text : fallback } : { frameId, fallback };
}

async function check(info, tab) {
  let fallback = info.selectionText || "";
  if (tab?.id >= 0) {
    try {
      const where = await chooseFrame(tab.id, info.frameId ?? 0, fallback);
      fallback = where.fallback;
      const target = { tabId: tab.id, frameIds: [where.frameId] };
      await chrome.scripting.executeScript({ target, func: t => { globalThis.__fallacyLensFallback = t; }, args: [fallback] });
      await chrome.scripting.executeScript({ target, files: ["src/card.js"] });
      return;
    } catch {
      // chrome:// pages, the Web Store, the PDF viewer, some frames: show the card in a popup instead.
    }
  }
  const token = crypto.randomUUID();
  try {
    // One character over the limit is enough for the card to say the selection is too long.
    await chrome.storage.session.set({ [`popup:${token}`]: fallback.slice(0, MAX_CHARS + 1) });
    await chrome.windows.create({ url: chrome.runtime.getURL(`src/popup-card.html#${token}`), type: "popup", width: 380, height: 520 });
  } catch (e) {
    console.warn("Fallacy Lens: could not open the popup card", e);
  }
}

// The e2e tests call this directly, because a headless browser can't click a context menu.
globalThis.fallacyLensCheck = check;
globalThis.fallacyLensKeyStore = keyStore;

// "Open settings" in the card. A one-off message rather than the port, because it wakes a stopped worker.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "options" && sender.id === chrome.runtime.id) chrome.runtime.openOptionsPage();
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
  const ctrl = new AbortController();
  port.onDisconnect.addListener(() => ctrl.abort());
  const post = msg => { try { port.postMessage(msg); } catch { /* the card was closed */ } };
  port.onMessage.addListener(async msg => {
    if (msg?.type === "ping") return post({ type: "pong" }); // the card's heartbeat keeps this worker alive
    if (msg?.type !== "check") return;
    let text = typeof msg.text === "string" ? msg.text : "";
    if (typeof msg.token === "string") {
      const k = `popup:${msg.token}`;
      const stored = (await chrome.storage.session.get(k))[k];
      if (stored === undefined) {
        return post({ type: "error", kind: "expired", message: "This check has expired. Select the text and check again." });
      }
      text = stored;
      await chrome.storage.session.remove(k);
    }
    const key = await keyStore.getKey();
    const { threshold = 50 } = await chrome.storage.local.get("threshold");
    await runCheck(text, { key, threshold, fetch: (...a) => fetch(...a), signal: ctrl.signal, post });
  });
});
