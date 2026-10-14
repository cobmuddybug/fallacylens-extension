// Fallacy Lens card. background.js injects this into the page you right-clicked, or popup-card.html
// loads it when a page can't be scripted. It reads the selection, asks the background to check it,
// and shows the result. It never sees the API key: only scores come back over the port.
// A classic script, not a module, because injected content scripts can't be modules.
(() => {
  const SHADOW_MODE = "closed"; // the e2e test build switches this to "open" so tests can read the card
  const WIDTH = 340;
  const GAP = 8;
  const PING_MS = 20_000; // Chrome stops a worker after 30 s without messages, even with a port open
  const popup = location.protocol === "chrome-extension:";

  globalThis.__fallacyLensClose?.(); // one card per tab: a new check replaces the old one

  const CSS = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .card {
      --bg: #ffffff; --fg: #1f2328; --muted: #656d76; --line: #d8dee4; --track: #eef1f4;
      --hi: #c2410c; --mid: #b7791f; --low: #8c959f; --focus: #0969da; --warn: #9a3412; --warn-bg: #fff4ed;
      width: 100%; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, .2); overflow: hidden; text-align: left;
      font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .card { --bg: #1c1f24; --fg: #e6edf3; --muted: #9198a1; --line: #3d444d; --track: #2d333b;
              --hi: #fb8f44; --mid: #e3b341; --low: #6e7681; --focus: #4493f8; --warn: #ffa198; --warn-bg: #3a1d1d; }
    }
    .card:focus { outline: none; }
    .card.popup { border: 0; border-radius: 0; box-shadow: none; min-height: 100vh; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px 6px 14px; border-bottom: 1px solid var(--line); }
    .title { font-weight: 600; }
    button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
    button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
    .close { width: 28px; height: 28px; border-radius: 6px; color: var(--muted); }
    .close:hover { background: var(--track); }
    .main { padding: 10px 14px; max-height: 60vh; overflow-y: auto; }
    .popup .main { max-height: none; }
    .status { display: flex; align-items: center; gap: 10px; color: var(--muted); padding: 6px 0; }
    .spin { flex: none; width: 14px; height: 14px; border: 2px solid var(--track); border-top-color: var(--focus); border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
    ul { list-style: none; margin: 0; padding: 0; }
    .row { display: grid; grid-template-columns: 1fr 80px 28px; align-items: center; gap: 10px; width: 100%; padding: 6px 4px; border-radius: 6px; text-align: left; }
    .row:hover { background: var(--track); }
    .name { font-weight: 500; }
    .bar { height: 6px; background: var(--track); border-radius: 3px; overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--low); border-radius: 3px; }
    .hi .fill { background: var(--hi); }
    .mid .fill { background: var(--mid); }
    .score { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
    .hi .score, .mid .score { color: var(--fg); font-weight: 600; }
    .detail { padding: 0 4px 10px; color: var(--muted); }
    .detail p { margin: 4px 0 0; }
    .group { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .example { font-style: italic; }
    .more { color: var(--muted); padding: 8px 4px 2px; }
    .more:hover { color: var(--fg); }
    .rest { margin-top: 4px; }
    .calm { margin: 6px 0; }
    .warn p { margin: 0; }
    .warn .why { margin-top: 4px; font-size: 12px; }
    .warn { margin: 6px 0; padding: 8px 10px; border-radius: 6px; color: var(--warn); background: var(--warn-bg); }
    .action { margin-top: 6px; padding: 6px 12px; border-radius: 6px; background: var(--focus); color: #fff; font-weight: 600; }
    footer { display: flex; justify-content: space-between; gap: 12px; padding: 8px 14px 10px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11.5px; }
    .cost { white-space: nowrap; }
  `;

  const fmt = n => n.toLocaleString("en-US");
  const level = s => (s >= 75 ? "hi" : s >= 50 ? "mid" : "low");
  const costText = c => (!c ? "" : c < 0.0001 ? "under $0.0001" : `$${c.toFixed(4)}`);

  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }

  /** The focused element, looking inside open shadow roots (e.g. a textarea in a web component). */
  function deepActive() {
    let a = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a;
  }

  function selectedText() {
    const a = deepActive();
    const field = a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && /^(text|search|url|email)$/i.test(a.type)));
    if (field && a.selectionEnd > a.selectionStart) return a.value.slice(a.selectionStart, a.selectionEnd);
    const s = getSelection()?.toString() ?? "";
    return s.trim() ? s : globalThis.__fallacyLensFallback || "";
  }

  /** The selection's box in page coordinates, or the focused field's, or null. */
  function anchorRect() {
    const empty = r => !r || (!r.width && !r.height);
    const sel = getSelection();
    let r = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
    const a = deepActive();
    if (empty(r) && a && a !== document.body && a !== document.documentElement) r = a.getBoundingClientRect();
    if (empty(r)) return null;
    return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left + scrollX };
  }

  /** Where to attach the card: inside an open modal dialog holding the selection (everything outside one
   *  is inert, so clicks wouldn't reach the card), else the document. */
  function parentFor() {
    const sel = getSelection();
    const node = sel?.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : document.activeElement;
    const el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    return el?.closest("dialog:modal") || document.documentElement;
  }

  const text = popup ? "" : selectedText();
  const returnFocus = popup ? null : deepActive();
  const anchor = popup ? null : anchorRect();

  const host = document.createElement("fallacy-lens-card");
  // A manual popover lives in the top layer, so modal dialogs and fullscreen elements can't cover it.
  if (!popup) host.setAttribute("popover", "manual");
  host.style.cssText = popup ? "all: initial; display: block;" : "all: initial; position: absolute; z-index: 2147483647; top: 0; left: 0;";
  const root = host.attachShadow({ mode: SHADOW_MODE });
  try {
    const sheet = new CSSStyleSheet(); // constructable sheets aren't blocked by a page's CSP
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
  } catch {
    root.append(h("style", { text: CSS }));
  }
  const main = h("div", { class: "main", "aria-live": "polite" });
  const foot = h("footer", { hidden: "" });
  const card = h("div", { class: popup ? "card popup" : "card", role: "dialog", "aria-label": "Fallacy Lens", tabindex: "-1" },
    h("header", {}, h("span", { class: "title", text: "Fallacy Lens" }),
      h("button", { class: "close", type: "button", "aria-label": "Close", text: "✕", onclick: () => close() })),
    main, foot);
  root.append(card);
  (popup ? document.body : parentFor()).append(host);
  if (!popup) try { host.showPopover(); } catch { /* no popover support: plain z-index stacking */ }

  function place() {
    if (popup) return;
    const vw = document.documentElement.clientWidth || innerWidth;
    const width = Math.min(WIDTH, vw - 2 * GAP);
    host.style.width = `${width}px`;
    const maxLeft = scrollX + vw - width - GAP;
    const left = Math.max(scrollX + GAP, Math.min(anchor ? anchor.left : maxLeft, maxLeft));
    const height = host.offsetHeight;
    const viewTop = scrollY + GAP, viewBottom = scrollY + innerHeight - height - GAP;
    let top = viewTop;
    if (anchor) {
      const below = anchor.bottom + GAP, above = anchor.top - GAP - height;
      if (below <= viewBottom) top = below;
      else if (above >= viewTop) top = above;
      else top = Math.max(viewTop, Math.min(below, viewBottom)); // e.g. select-all: overlap the text, stay visible
    }
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  function show(...nodes) {
    main.replaceChildren(...nodes);
    place();
  }

  function checking(m) {
    const what = m?.chars ? `Checking ${fmt(m.chars)} characters…` : "Checking…";
    const part = m?.total > 1 ? ` part ${Math.min(m.done + 1, m.total)} of ${m.total}` : "";
    show(h("div", { class: "status" }, h("span", { class: "spin", "aria-hidden": "true" }), h("span", { text: what + part })));
  }

  function row(r) {
    const detail = h("div", { class: "detail", hidden: "" },
      h("p", { class: "group", text: r.group }), h("p", { text: r.definition }), h("p", { class: "example", text: `e.g. “${r.example}”` }));
    const fill = h("span", { class: "fill" });
    fill.style.width = `${r.score}%`;
    const btn = h("button", { class: `row ${level(r.score)}`, type: "button", "aria-expanded": "false" },
      h("span", { class: "name", text: r.name }), h("span", { class: "bar", "aria-hidden": "true" }, fill),
      h("span", { class: "score", text: String(r.score) }));
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      detail.hidden = !open;
      place();
    });
    return h("li", {}, btn, detail);
  }

  function results(m) {
    const shown = m.rows.filter(r => r.score >= m.threshold);
    const rest = m.rows.filter(r => r.score < m.threshold);
    const nodes = [];
    if (m.failed) {
      const why = [...new Set(m.errors || [])];
      nodes.push(h("div", { class: "warn" },
        h("p", { text: `${m.failed} of ${m.total} parts failed, so these may be incomplete.` }),
        why.map(w => h("p", { class: "why", text: w }))));
    }
    if (shown.length) nodes.push(h("ul", { class: "rows" }, shown.map(row)));
    else nodes.push(h("p", { class: "calm", text: `No fallacies scored ${m.threshold} or more.` }));
    if (rest.length) {
      const list = h("ul", { class: "rows rest", hidden: "" }, rest.map(row));
      const label = shown.length ? `${rest.length} ${rest.length === 1 ? "other" : "others"} below ${m.threshold}` : "Show all scores";
      const arrow = h("span", { "aria-hidden": "true", text: "▸" }); // not read aloud; aria-expanded says it
      const more = h("button", { class: "more", type: "button", "aria-expanded": "false" }, arrow, ` ${label}`);
      more.addEventListener("click", () => {
        const open = list.hidden;
        list.hidden = !open;
        more.setAttribute("aria-expanded", String(open));
        arrow.textContent = open ? "▾" : "▸";
        place();
      });
      nodes.push(more, list);
    }
    foot.replaceChildren(
      h("span", { text: "Scores are Jev's estimate that the text commits each fallacy, not a verdict." }),
      h("span", { class: "cost", text: costText(m.cost) }));
    foot.hidden = false;
    show(...nodes);
  }

  function failure(m) {
    const nodes = [h("p", { class: m.kind === "short" || m.kind === "nokey" ? "calm" : "warn", text: m.message })];
    if (m.kind === "nokey" || m.kind === "key") {
      nodes.push(h("button", { class: "action", type: "button", text: "Open settings", onclick: () => chrome.runtime.sendMessage({ type: "options" }) })); // wakes the worker even if the port is gone
    }
    show(...nodes);
  }

  let finished = false;
  const port = chrome.runtime.connect({ name: "fallacylens-card" });
  port.onMessage.addListener(m => {
    /* e2e-log */
    if (m.type === "progress") checking(m);
    else if (m.type === "done") { finished = true; results(m); }
    else if (m.type === "error") { finished = true; failure(m); }
  });
  const heartbeat = setInterval(() => {
    if (finished) return clearInterval(heartbeat);
    try { port.postMessage({ type: "ping" }); } catch { clearInterval(heartbeat); }
  }, PING_MS);
  port.onDisconnect.addListener(() => {
    if (!finished) { finished = true; failure({ kind: "other", message: "Fallacy Lens stopped unexpectedly. Try the check again." }); }
  });

  // Esc closes the card when focus is in it (or nowhere), not when it's meant for one of the page's fields.
  function onKey(e) {
    if (e.key !== "Escape") return;
    const a = document.activeElement;
    if (e.composedPath().includes(host) || !a || a === document.body || a === document.documentElement) close();
  }
  function close() {
    document.removeEventListener("keydown", onKey, true);
    removeEventListener("resize", place);
    finished = true;
    try { port.disconnect(); } catch { /* already gone */ }
    host.remove();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    if (globalThis.__fallacyLensClose === close) globalThis.__fallacyLensClose = undefined;
    if (popup) window.close();
  }
  globalThis.__fallacyLensClose = close;
  document.addEventListener("keydown", onKey, true);
  addEventListener("resize", place);

  checking(popup ? null : { chars: text.trim().length, total: 1, done: 0 });
  port.postMessage(popup ? { type: "check", token: location.hash.slice(1) } : { type: "check", text });
  card.focus({ preventScroll: true });
})();
