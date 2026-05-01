import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { chromium, type Page } from "playwright";

import type { BrowserAutomationGateway, BrowserRecordingDriver } from "./lifecycle.js";

const CURATED_CHILD_TOOLS = {
  navigate: ["browser_navigate"],
  click: ["browser_click"],
  mouseClick: ["browser_mouse_click_xy"],
  type: ["browser_type"],
  evaluate: ["browser_evaluate"],
  snapshot: ["browser_snapshot"],
  screenshot: ["browser_take_screenshot", "browser_screenshot"],
} as const;

const PUBLIC_BROWSER_TOOL_NAMES = {
  navigate: "reck_browser_navigate",
  click: "reck_browser_click",
  mouseClick: "reck_browser_click",
  type: "reck_browser_type",
  evaluate: "reck_browser_evaluate",
  snapshot: "reck_browser_snapshot",
  screenshot: "reck_browser_take_screenshot",
} satisfies Record<CuratedTool, string>;

type CuratedTool = keyof typeof CURATED_CHILD_TOOLS;

type PlaywrightMcpChildGateway = BrowserAutomationGateway & {
  mode: "playwright-mcp-child";
};

export const playwrightBrowserRecordingDriver: BrowserRecordingDriver = {
  async open({ videoDir, viewport, videoSize, tracePath, headless }) {
    const requestedPort = await reserveDebugPort();
    const browser = await chromium.launch({ headless: headless ?? false, args: [`--remote-debugging-port=${requestedPort}`] });
    const cdpEndpoint = `http://127.0.0.1:${requestedPort}`;
    const context = await browser.newContext({
      viewport,
      recordVideo: { dir: videoDir, size: videoSize },
    });
    if (tracePath) await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    const child = await createPlaywrightMcpChildGateway(cdpEndpoint, videoDir).catch((error) => createCdpGateway(page, cdpEndpoint, errorMessage(error)));
    return { browser, context, page, cdpEndpoint, automationGateway: child };
  },
};

async function createPlaywrightMcpChildGateway(cdpEndpoint: string, outputDir: string): Promise<PlaywrightMcpChildGateway> {
  const childCommand = playwrightMcpCommand();
  const transport = new StdioClientTransport({
    command: childCommand.command,
    args: [...childCommand.args, "--cdp-endpoint", cdpEndpoint, "--output-dir", outputDir, "--caps", "core,vision"],
    env: childEnv(),
    stderr: "pipe",
  });
  const client = new Client({ name: "reck-playwright-child", version: "0.0.0" });
  await client.connect(transport, { timeout: 30_000 });
  const listed = await client.listTools({}, { timeout: 30_000 });
  const childToolNames = listed.tools.map((tool) => tool.name).sort();
  const toolMap = mapCuratedTools(childToolNames);
  const missing = Object.entries(toolMap)
    .filter(([, childTool]) => !childTool)
    .map(([tool]) => tool);
  const forwardedTools = Object.fromEntries(
    Object.entries(toolMap)
      .filter((entry): entry is [CuratedTool, string] => typeof entry[1] === "string")
      .map(([tool, childTool]) => [PUBLIC_BROWSER_TOOL_NAMES[tool], childTool]),
  );

  return {
    mode: "playwright-mcp-child",
    status: "available",
    child_tools: childToolNames,
    forwarded_tools: forwardedTools,
    reason: missing.length ? `Playwright MCP child did not expose curated tools: ${missing.join(", ")}` : undefined,
    async close() {
      await transport.close();
    },
    async navigate(url) {
      return forwardChildTool(client, toolMap.navigate, { url }, cdpEndpoint, "reck_browser_navigate");
    },
    async click(args) {
      const toolName = typeof args.x === "number" && typeof args.y === "number" ? toolMap.mouseClick : toolMap.click;
      return forwardChildTool(client, toolName, childClickArgs(args), cdpEndpoint, "reck_browser_click");
    },
    async type({ selector, text }) {
      return forwardChildTool(client, toolMap.type, { element: selector, ref: selector, text }, cdpEndpoint, "reck_browser_type");
    },
    async evaluate<T = unknown>(expression: string) {
      return (await forwardChildTool(client, toolMap.evaluate, { function: expression }, cdpEndpoint, "reck_browser_evaluate")) as T;
    },
    async snapshot() {
      return forwardChildTool(client, toolMap.snapshot, {}, cdpEndpoint, "reck_browser_snapshot");
    },
    async screenshot(path) {
      return forwardChildTool(client, toolMap.screenshot, { filename: path, fullPage: true }, cdpEndpoint, "reck_browser_take_screenshot");
    },
  };
}

function createCdpGateway(page: Page, cdpEndpoint: string, childError?: string): BrowserAutomationGateway {
  const reason = childError
    ? `Playwright MCP child unavailable (${childError}); using CDP-backed Playwright adapter attached to Reck-owned Chromium`
    : "Playwright MCP child package is not available; using CDP-backed Playwright adapter attached to Reck-owned Chromium";
  return {
    mode: "cdp-adapter",
    status: "available",
    reason,
    child_tools: [],
    forwarded_tools: {},
    async close() {},
    async navigate(url) {
      await page.goto(url, { waitUntil: "domcontentloaded" }).catch(() => undefined);
      return { action: "navigate", cdp_endpoint: cdpEndpoint };
    },
    async click(args) {
      if (args.selector) {
        await page.locator(args.selector).first().click();
        return { action: `selector:${args.selector}`, cdp_endpoint: cdpEndpoint };
      }
      if (args.text) {
        await page.getByText(args.text, { exact: false }).first().click();
        return { action: `text:${args.text}`, cdp_endpoint: cdpEndpoint };
      }
      if (typeof args.x === "number" && typeof args.y === "number") {
        await page.mouse.click(args.x, args.y);
        return { action: `xy:${args.x},${args.y}`, cdp_endpoint: cdpEndpoint };
      }
      throw new Error("Provide selector, text, or x/y for reck_browser_click");
    },
    async type({ selector, text }) {
      await page.fill(selector, text);
      return { action: `fill:${selector}`, cdp_endpoint: cdpEndpoint };
    },
    async evaluate(expression) {
      return page.evaluate((source) => globalThis.eval(source), expression);
    },
    async snapshot() {
      return { url: page.url(), title: await page.title(), text: await page.locator("body").innerText().catch(() => ""), cdp_endpoint: cdpEndpoint };
    },
    async screenshot(path) {
      await page.screenshot({ path, fullPage: true });
      return { path, cdp_endpoint: cdpEndpoint };
    },
  };
}

function mapCuratedTools(childToolNames: string[]): Record<CuratedTool, string | null> {
  return Object.fromEntries(
    Object.entries(CURATED_CHILD_TOOLS).map(([tool, candidates]) => [
      tool,
      candidates.find((candidate) => childToolNames.includes(candidate)) ?? null,
    ]),
  ) as Record<CuratedTool, string | null>;
}

async function forwardChildTool(
  client: Client,
  childToolName: string | null,
  args: Record<string, unknown>,
  cdpEndpoint: string,
  publicToolName: string,
): Promise<Record<string, unknown>> {
  if (!childToolName) throw new Error("Playwright MCP child did not expose the requested curated tool");
  const result = await client.callTool({ name: childToolName, arguments: args }, undefined, { timeout: 60_000 });
  return {
    action: childToolName,
    cdp_endpoint: cdpEndpoint,
    public_tool: publicToolName,
    child_tool: childToolName,
    child_result: summarizeChildResult(result),
  };
}

function childClickArgs(args: { text?: string; selector?: string; x?: number; y?: number }): Record<string, unknown> {
  if (args.selector) return { target: args.selector, element: args.selector, ref: args.selector };
  if (args.text) return { target: args.text, element: args.text, ref: args.text };
  if (typeof args.x === "number" && typeof args.y === "number") return { x: args.x, y: args.y };
  throw new Error("Provide selector, text, or x/y for reck_browser_click");
}

function summarizeChildResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") return { value: result };
  const record = result as { content?: unknown; structuredContent?: unknown; isError?: unknown };
  return {
    isError: record.isError === true,
    structuredContent: record.structuredContent ?? null,
    content: Array.isArray(record.content) ? record.content.slice(0, 3).map(summarizeContentPart) : [],
  };
}

function summarizeContentPart(part: unknown): unknown {
  if (!part || typeof part !== "object") return part;
  const record = part as Record<string, unknown>;
  if (typeof record.data === "string") {
    return { ...record, data: `[omitted ${record.data.length} base64 chars]` };
  }
  if (typeof record.text === "string") return { ...record, text: record.text.slice(0, 4000) };
  return record;
}

function playwrightMcpCommand(): { command: string; args: string[] } {
  const configured = process.env.RECK_PLAYWRIGHT_MCP_COMMAND ?? process.env.REELINK_PLAYWRIGHT_MCP_COMMAND;
  if (configured) return splitCommand(configured);
  const localCli = join(process.cwd(), "node_modules", ".bin", "playwright-mcp");
  if (existsSync(localCli)) return { command: localCli, args: [] };
  return { command: "npx", args: ["-y", "@playwright/mcp"] };
}

function splitCommand(command: string): { command: string; args: string[] } {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
  const [bin, ...args] = parts;
  if (!bin) throw new Error("RECK_PLAYWRIGHT_MCP_COMMAND was empty");
  return { command: bin, args };
}

function childEnv(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

async function reserveDebugPort(): Promise<number> {
  const { createServer } = await import("node:net");
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => typeof address === "object" && address ? resolve(address.port) : reject(new Error("Could not reserve Chromium debug port")));
    });
    server.on("error", reject);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
