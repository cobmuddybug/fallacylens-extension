// Turn a failed check into a short message the card can show, with what to do about it.
import { JevError } from "./jev.js";

export function describeError(err) {
  if (!(err instanceof JevError)) return { kind: "other", message: `Something went wrong: ${err?.message ?? err}` };
  if (err.type === "max_tokens") return { kind: "dense", message: "Part of this selection is too dense for Jev to read at once. Try selecting less." };
  if (err.type === "network") return { kind: "network", message: "Couldn't reach OpenRouter. Check your connection and try again." };
  if (err.type === "format") return { kind: "format", message: "Jev's response format changed. Update Fallacy Lens to keep checking." };
  if (err.status === 401 || err.status === 403) return { kind: "key", message: "OpenRouter rejected your key. Update it in settings." };
  if (err.status === 402) return { kind: "credit", message: "Your OpenRouter account is out of credit. Top up at openrouter.ai, then try again." };
  if (err.status === 429) return { kind: "rate", message: "OpenRouter is rate-limiting requests. Wait a minute, then try again." };
  return { kind: "other", message: err.message };
}
