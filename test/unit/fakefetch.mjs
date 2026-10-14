// A stand-in for fetch: handler(call, n) returns {status, body, headers} or a Response, or throws.
export function fakeFetch(handler) {
  const calls = [];
  const f = async (url, init = {}) => {
    if (init.signal?.aborted) throw new DOMException("aborted", "AbortError");
    const call = { url, init, body: init.body ? JSON.parse(init.body) : null, headers: init.headers || {} };
    calls.push(call);
    const r = await handler(call, calls.length);
    if (r instanceof Response) return r;
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200, headers: r.headers });
  };
  f.calls = calls;
  return f;
}

/** A 200 response scoring the given fallacies (0..1); unlisted ones get `rest`. */
export function answers(scores = {}, rest = 0.02, cost = 0.0002) {
  return (call) => {
    const out = {};
    for (const id of Object.keys(call.body.questions)) out[id] = { noul: scores[id] ?? rest };
    return { body: { answers: out, usage: { cost } } };
  };
}

export const noSleep = async () => {};
export const record = call => call.body.state.records[0].record;
