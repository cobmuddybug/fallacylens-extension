// Fallacy Lens service worker: the right-click menu, injecting the card, and the card's connection.
// The only code that reads the OpenRouter key; the card receives scores, never the key.
import { runCheck } from "./check.js";

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

async function check(info, tab) {
  const fallback = info.selectionText || "";
  if (tab?.id >= 0) {
    const target = { tabId: tab.id, frameIds: [info.frameId ?? 0] };
    try {
      await chrome.scripting.executeScript({ target, func: t => { globalThis.__fallacyLensFallback = t; }, args: [fallback] });
      await chrome.scripting.executeScript({ target, files: ["src/card.js"] });
      return;
    } catch {
      // chrome:// pages, the Web Store, the PDF viewer, some frames: show the card in a popup instead.
    }
  }
  const token = crypto.randomUUID();
  await chrome.storage.session.set({ [`popup:${token}`]: fallback });
  await chrome.windows.create({ url: chrome.runtime.getURL(`src/popup-card.html#${token}`), type: "popup", width: 380, height: 520 });
}

// The e2e tests call this directly, because a headless browser can't click a context menu.
globalThis.fallacyLensCheck = check;

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
  const ctrl = new AbortController();
  port.onDisconnect.addListener(() => ctrl.abort());
  const post = msg => { try { port.postMessage(msg); } catch { /* the card was closed */ } };
  port.onMessage.addListener(async msg => {
    if (msg?.type === "options") return chrome.runtime.openOptionsPage();
    if (msg?.type !== "check") return;
    let text = typeof msg.text === "string" ? msg.text : "";
    if (typeof msg.token === "string") {
      const k = `popup:${msg.token}`;
      text = (await chrome.storage.session.get(k))[k] ?? "";
      await chrome.storage.session.remove(k);
    }
    const { key = "", threshold = 50 } = await chrome.storage.local.get(["key", "threshold"]);
    await runCheck(text, { key, threshold, fetch: (...a) => fetch(...a), signal: ctrl.signal, post });
  });
});
