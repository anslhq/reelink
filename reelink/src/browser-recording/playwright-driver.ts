import { chromium } from "playwright";

import type { BrowserRecordingDriver } from "./lifecycle.js";

export const playwrightBrowserRecordingDriver: BrowserRecordingDriver = {
  async open({ videoDir, viewport, videoSize, headless }) {
    const browser = await chromium.launch({ headless: headless ?? false });
    const context = await browser.newContext({
      viewport,
      recordVideo: { dir: videoDir, size: videoSize },
    });
    const page = await context.newPage();
    return { browser, context, page };
  },
};
