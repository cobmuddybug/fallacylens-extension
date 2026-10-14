import test, { before, after } from "node:test";
import { setup, waitFor, findTarget, selectExpr } from "./harness.mjs";

// Chrome stops an idle MV3 worker after 30 s even while a port is open, which closes the card's port.
let env;
before(async () => { env = await setup(); });
after(async () => { await env?.close(); });

test("Open settings still works after the worker has stopped", async () => {
  await env.setKey("");
  const page = await env.openPage("/page.html?life=1");
  await page.check(await page.eval(selectExpr("fallacy")));
  await waitFor(async () => /Add your OpenRouter key/.test((await page.card())?.text || ""), { what: "no-key prompt" });
  for (const t of (await env.cdp.send("Target.getTargets")).targetInfos.filter(t => t.url.endsWith("/src/options.html"))) {
    await env.cdp.send("Target.closeTarget", { targetId: t.targetId });
  }
  await env.stopWorker();
  await page.eval(`document.querySelector("fallacy-lens-card").shadowRoot.querySelector("button.action").click()`);
  await findTarget(env.cdp, t => t.url.endsWith("/src/options.html"), "options tab after the worker restarted");
});
