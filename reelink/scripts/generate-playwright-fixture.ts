import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { logger } from "../src/utils/logger.js";

const log = logger("generate-playwright-fixture");
const recordingsDir = join(process.cwd(), "demo-recordings");
mkdirSync(recordingsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: recordingsDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();

await page.setContent(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #101114; color: white; }
    main { width: 100vw; height: 100vh; display: grid; place-items: center; overflow: hidden; }
    .shell { position: relative; width: 920px; height: 420px; border: 1px solid #31343b; border-radius: 28px; background: #17191f; box-shadow: 0 30px 90px rgba(0,0,0,.45); overflow: hidden; }
    .hero, .blog { position: absolute; inset: 0; padding: 56px; transition: transform 420ms ease, opacity 240ms ease; }
    .hero { transform: translateX(0); opacity: 1; }
    .blog { transform: translateX(64px); opacity: 0; }
    .shell[data-route="blog"] .hero { transform: translateX(-28px); opacity: .55; }
    .shell[data-route="blog"] .blog { transform: translateX(0); opacity: 1; }
    h1 { margin: 0; font-size: 80px; letter-spacing: -0.08em; line-height: .9; }
    p { width: 520px; color: #b8beca; font-size: 22px; line-height: 1.45; }
    button { position: absolute; right: 48px; bottom: 44px; border: 0; border-radius: 999px; padding: 16px 24px; font-size: 18px; background: #8df6c7; color: #07110d; }
    .glitch { position: absolute; left: 58px; top: 56px; color: #ff6b6b; mix-blend-mode: screen; opacity: 0; }
    .shell[data-route="blog"] .glitch { animation: flicker 620ms ease both; }
    @keyframes flicker {
      0%, 28% { opacity: 0; transform: translate(0, 0); }
      32% { opacity: .9; transform: translate(18px, 6px); }
      55% { opacity: .65; transform: translate(-10px, -3px); }
      100% { opacity: 0; transform: translate(0, 0); }
    }
  </style>
</head>
<body>
  <main>
    <section class="shell" id="shell" data-route="home">
      <div class="hero"><h1>Harsha<br/>Vardhan</h1><p>Portfolio shell with a deliberate view-transition overlap bug.</p></div>
      <div class="glitch"><h1>Harsha<br/>Vardhan</h1></div>
      <div class="blog"><h1>Blog<br/>Index</h1><p>The old title briefly overlaps the new page title during navigation.</p></div>
      <button id="nav">Go to blog</button>
    </section>
  </main>
  <script>
    const shell = document.getElementById('shell');
    const nav = document.getElementById('nav');
    setTimeout(() => nav.click(), 900);
    setTimeout(() => { shell.dataset.route = 'home'; }, 3600);
    setTimeout(() => nav.click(), 5700);
    nav.addEventListener('click', () => {
      shell.dataset.route = 'blog';
    });
  </script>
</body>
</html>
`);

await page.waitForTimeout(8200);
await context.close();
await browser.close();

const video = await page.video()?.path();
if (!video || !existsSync(video)) {
  throw new Error("Playwright did not produce a video artifact");
}

log.info({ video }, "generated Playwright raw-video fixture");
console.log(video);
