import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain" };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404).end("not found"); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

await new Promise((r) => server.listen(4321, "127.0.0.1", r));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: false,
  userAgent: "Mozilla/5.0 (Linux; Android 14; SM-X810) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  locale: "zh-CN",
  timezoneId: "Asia/Shanghai",
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const mq = await page.evaluate(() => ({
  coarse: matchMedia("(pointer: coarse)").matches,
  noHover: matchMedia("(hover: none)").matches,
  sidebar: getComputedStyle(document.querySelector(".app-frame")).getPropertyValue("--sidebar").trim(),
  tools: [...document.querySelectorAll(".apps-panel button span")].map((n) => n.textContent),
  mood: !!document.querySelector(".sidebar-mood"),
  music: !!document.querySelector(".sidebar-music"),
  github: document.body.innerText.includes("GitHub"),
}));
console.log(JSON.stringify(mq, null, 2));
console.log("console issues:", errors.length ? errors : "none");

const shots = [
  ["/", "solaris-tablet-home.png"],
  ["/tools/", "solaris-tablet-tools.png"],
  ["/settings/", "solaris-tablet-settings.png"],
];

for (const [route, file] of shots) {
  await page.goto(`http://127.0.0.1:4321${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  console.log(route, "vertical overflow:", overflow);
  // 截图输出目录：默认项目内 screenshots/，可用 SCREENSHOT_DIR 覆盖。
  const outDir = process.env.SCREENSHOT_DIR || path.join(root, "..", "screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, file) });
}

await browser.close();
server.close();
