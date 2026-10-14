// Options page: check and save the OpenRouter key, and the score threshold the card uses.
import { validateKey, keyHint, checkKey } from "./keys.js";
import { getKey, setKey, removeKey } from "./keystore.js";

const $ = id => document.getElementById(id);

function say(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

async function refresh() {
  const key = await getKey();
  const { threshold = 50 } = await chrome.storage.local.get("threshold");
  $("key-form").hidden = Boolean(key);
  $("key-saved").hidden = !key;
  $("hint").textContent = keyHint(key);
  $("threshold").value = String(threshold);
  $("threshold-value").textContent = String(threshold);
}

$("key-form").addEventListener("submit", async e => {
  e.preventDefault();
  const key = $("key").value.trim();
  const problem = validateKey(key);
  if (problem) return say(problem, true);
  say("Checking with OpenRouter…");
  $("save").disabled = true;
  try {
    await checkKey(key, fetch);
    await setKey(key);
    $("key").value = "";
    say("Saved. Select text on any page, right-click, and choose Check for fallacies.");
    await refresh();
  } catch (err) {
    say(err.message, true);
  } finally {
    $("save").disabled = false;
  }
});

$("replace").addEventListener("click", () => {
  $("key-form").hidden = false;
  $("key").focus();
});

$("remove").addEventListener("click", async () => {
  await removeKey();
  say("Key removed.");
  await refresh();
});

$("threshold").addEventListener("input", e => {
  const threshold = Number(e.target.value);
  $("threshold-value").textContent = String(threshold);
  chrome.storage.local.set({ threshold });
});

refresh();
