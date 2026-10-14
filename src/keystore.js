// The OpenRouter key, kept in the extension's own IndexedDB. chrome.storage.local is readable from
// content scripts, which run inside web pages' renderers; this database is reachable only from the
// extension's origin (the service worker and the options page).

const DB = "fallacylens", STORE = "secrets", ID = "openrouter";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, op) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const setKey = key => run("readwrite", s => s.put(key, ID));

export async function removeKey() {
  await run("readwrite", s => s.delete(ID));
  await chrome.storage.local.remove("key");
}

export async function getKey() {
  const key = await run("readonly", s => s.get(ID));
  if (key) return key;
  // Version 0.1.0 kept the key in chrome.storage.local: move it here.
  const { key: legacy } = await chrome.storage.local.get("key");
  if (!legacy) return "";
  await setKey(legacy);
  await chrome.storage.local.remove("key");
  return legacy;
}
