// Injects the payload into a real deezer.com page over the Chrome DevTools Protocol, without Windows:
// same messages, same order, against Chromium started with --remote-debugging-port.
//   npm run build && node test/cdp-inject.mjs [url]
// 1. GET /json/list, keep page targets on deezer.com
// 2. WebSocket -> Page.enable, Page.addScriptToEvaluateOnNewDocument (without Page.enable the
//    script is accepted but NOT run on reload: checked with NO_PAGE_ENABLE=1)
// 3. Runtime.evaluate "Boolean(window.__betterDeezer)" -> inject with Runtime.evaluate if false
// 4. Page.reload -> the payload must be back on its own (new-document script)
import { createRequire } from "node:module";
import { readFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "dist/better-deezer.user.js"), "utf8");
const url = process.argv[2] || "https://www.deezer.com/fr/album/302127";

const freePort = () =>
  new Promise((resolve) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = await freePort();
const proc = spawn(
  chromium.executablePath(),
  [
    "--headless=new",
    "--no-sandbox",
    `--remote-debugging-port=${port}`,
    `--remote-allow-origins=http://127.0.0.1:${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), "bd-cdp-"))}`,
    url
  ],
  { stdio: "ignore" }
);

let ok = true;
const check = (name, cond, detail = "") => {
  ok &&= Boolean(cond);
  console.log(`${cond ? "ok  " : "FAIL"} ${name}${detail ? `  (${detail})` : ""}`);
};

try {
  let targets = [];
  for (let i = 0; i < 40 && !targets.length; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      targets = list.filter((t) => t.type === "page" && /^https:\/\/([a-z0-9-]+\.)*deezer\.com\//.test(t.url));
    } catch {}
  }
  check("DevTools endpoint lists the deezer.com page", targets.length > 0);

  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) pending.get(msg.id)(msg);
  };
  // Raw JSON params, exactly like Invoke-Cdp in launcher.ps1.
  const sourceJson = JSON.stringify(source);
  const cdp = (method, paramsJson = "{}") =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(`{"id":${n},"method":"${method}","params":${paramsJson}}`);
    });
  const injected = async () =>
    (await cdp("Runtime.evaluate", '{"expression":"Boolean(window.__betterDeezer)","returnByValue":true}')).result?.result?.value;

  if (!process.env.NO_PAGE_ENABLE) await cdp("Page.enable");
  const add = await cdp("Page.addScriptToEvaluateOnNewDocument", `{"source":${sourceJson}}`);
  check("addScriptToEvaluateOnNewDocument accepted", add.result?.identifier, JSON.stringify(add.error || ""));

  await sleep(6000);
  if (!(await injected())) {
    const ev = await cdp("Runtime.evaluate", `{"expression":${sourceJson},"allowUnsafeEvalBlockedByCSP":true}`);
    check("Runtime.evaluate of the payload", !ev.result?.exceptionDetails, JSON.stringify(ev.result?.exceptionDetails?.text || ""));
  }
  await sleep(500);
  check("payload running after first injection", await injected());
  const theme = await cdp("Runtime.evaluate", '{"expression":"document.documentElement.dataset.bd + \\"/\\" + document.documentElement.dataset.bdTheme","returnByValue":true}');
  check("html[data-bd=on][data-bd-theme=dark]", theme.result?.result?.value === "on/dark", theme.result?.result?.value);

  await cdp("Page.reload");
  await sleep(8000);
  check("payload back after a reload, by itself (new-document script)", await injected());
  ws.close();
} catch (err) {
  check("no exception", false, err.message);
} finally {
  proc.kill();
}
process.exit(ok ? 0 : 1);
