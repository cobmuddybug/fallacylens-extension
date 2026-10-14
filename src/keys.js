// Checking and displaying an OpenRouter key, for the options page.
import { KEYCHECK_URL } from "./config.js";

export function validateKey(key) {
  if (!key) return "Paste an OpenRouter API key (it starts with sk-or-).";
  if (/\s/.test(key)) return "That key contains spaces or line breaks. Paste just the key.";
  return "";
}

export function keyHint(key) {
  if (!key) return "";
  return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : "…";
}

export async function checkKey(key, fetchFn) {
  let res;
  try {
    res = await fetchFn(KEYCHECK_URL, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    throw new Error("Couldn't reach OpenRouter. Check your connection and try again.");
  }
  if (res.status === 200) return;
  if (res.status === 401 || res.status === 403) throw new Error("OpenRouter rejected that key. Check you copied all of it.");
  throw new Error(`OpenRouter returned an error (${res.status}). Try again in a minute.`);
}
