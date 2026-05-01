import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_INIT_CONFIG = { default_fps_sample: 4, copy_imported_videos: false } as const;

export type FrameworkTargetInspection = {
  framework: "vite-react" | "next-react" | "unknown";
  initialized: boolean;
  missingSource: boolean;
  missingSourceReason: string | null;
  buildCommand: string | null;
  startCommand: string | null;
  reactGrabInstalled: boolean;
  reactGrabInitialized: boolean;
  reactGrabInitFile: string | null;
  reactGrabInitChanged: boolean;
  reactGrabInitMessage: string | null;
  sourceAnnotationsInitialized: boolean;
  sourceAnnotationsFile: string | null;
  sourceAnnotationsChanged: boolean;
  sourceAnnotationsMessage: string | null;
};

export const CODEX_MCP_SNIPPET = `[mcp_servers.reck]
command = "bunx"
args = ["-y", "@anslai/reck", "mcp"]
# Local checkout testing only: use command = "reck-mcp" after bun link

[mcp_servers.reck.env]
OPENROUTER_API_KEY = "<set-in-env-only>"
RECK_OPENROUTER_MODEL = "qwen/qwen3.6-flash"
RECK_LOG_LEVEL = "info"
`;

export const CURSOR_MCP_SNIPPET = `{
  "mcpServers": {
    "reck": {
      "command": "bunx",
      "args": ["-y", "@anslai/reck", "mcp"],
      "env": {
        "OPENROUTER_API_KEY": "<set-in-env-only>",
        "RECK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
`;

export const CLAUDE_CODE_MCP_SNIPPET = `Claude Code MCP config (snippet-only; add with your local Claude settings flow):
{
  "mcpServers": {
    "reck": {
      "command": "bunx",
      "args": ["-y", "@anslai/reck", "mcp"],
      "env": {
        "OPENROUTER_API_KEY": "<set-in-env-only>",
        "RECK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
`;

export const CLINE_ROO_MCP_SNIPPET = `Cline/Roo MCP config (snippet-only; paste into the extension MCP settings):
{
  "mcpServers": {
    "reck": {
      "command": "bunx",
      "args": ["-y", "@anslai/reck", "mcp"],
      "env": {
        "OPENROUTER_API_KEY": "<set-in-env-only>",
        "RECK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
`;

export const VSCODE_COPILOT_MCP_SNIPPET = `VS Code Copilot MCP config (snippet-only; workspace .vscode/mcp.json or user settings):
{
  "servers": {
    "reck": {
      "command": "bunx",
      "args": ["-y", "@anslai/reck", "mcp"],
      "env": {
        "OPENROUTER_API_KEY": "<set-in-env-only>",
        "RECK_OPENROUTER_MODEL": "qwen/qwen3.6-flash"
      }
    }
  }
}
`;

export const LOCAL_MCP_SNIPPET = `Local checkout testing only after bun link:
  installed CLI: reck mcp
  linked MCP binary: reck-mcp
`;

/**
 * Writes or safely updates ~/.reck/config.json with non-secret defaults only (no secrets ever).
 * @param homeRoot - override user's home directory (for tests; default is `homedir()`)
 * @returns absolute path written or updated
 */
export function writeInitialUserConfigFile(options?: { homeRoot?: string }): string {
  const root = options?.homeRoot ?? homedir();
  const home = join(root, ".reck");
  const configPath = join(home, "config.json");
  mkdirSync(home, { recursive: true });
  const existing = readExistingConfig(configPath);
  const merged = { ...DEFAULT_INIT_CONFIG, ...existing };
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
  return configPath;
}

export function inspectFrameworkTarget(projectRoot: string): FrameworkTargetInspection {
  const packageJson = readPackageJson(join(projectRoot, "package.json"));
  const scripts = objectRecord(packageJson?.scripts);
  const dependencies = {
    ...objectRecord(packageJson?.dependencies),
    ...objectRecord(packageJson?.devDependencies),
  };
  const hasVite = "vite" in dependencies || existsSync(join(projectRoot, "vite.config.ts")) || existsSync(join(projectRoot, "vite.config.js"));
  const hasNext = "next" in dependencies || existsSync(join(projectRoot, "next.config.js")) || existsSync(join(projectRoot, "next.config.mjs"));
  const hasReact = "react" in dependencies || existsSync(join(projectRoot, "src", "main.jsx")) || existsSync(join(projectRoot, "src", "main.tsx"));
  const srcDirExists = existsSync(join(projectRoot, "src"));
  const nextAppRouterLayoutPath = findNextAppRouterLayoutFile(projectRoot);
  const layoutContent = nextAppRouterLayoutPath ? readFileSync(nextAppRouterLayoutPath, "utf8") : "";
  const reactGrabInitFile = nextAppRouterLayoutPath && hasReactGrabScript(layoutContent) ? nextAppRouterLayoutPath : null;
  const sourceAnnotationsFile = nextAppRouterLayoutPath && hasReckSourceAnnotations(layoutContent) ? nextAppRouterLayoutPath : null;

  return {
    framework: hasNext && hasReact ? "next-react" : hasVite && hasReact ? "vite-react" : "unknown",
    initialized: existsSync(join(projectRoot, ".reck", "target.json")),
    missingSource: !srcDirExists,
    missingSourceReason: srcDirExists ? null : "No src directory was found; React source capture cannot be verified for this target",
    buildCommand: typeof scripts.build === "string" ? scripts.build : null,
    startCommand: typeof scripts.start === "string" ? scripts.start : null,
    reactGrabInstalled: "react-grab" in dependencies,
    reactGrabInitialized: reactGrabInitFile !== null,
    reactGrabInitFile,
    reactGrabInitChanged: false,
    reactGrabInitMessage: reactGrabInitFile ? "React Grab is already initialized" : null,
    sourceAnnotationsInitialized: sourceAnnotationsFile !== null,
    sourceAnnotationsFile,
    sourceAnnotationsChanged: false,
    sourceAnnotationsMessage: sourceAnnotationsFile ? "Reck source annotations are already initialized" : null,
  };
}

export function initializeFrameworkTarget(projectRoot: string): FrameworkTargetInspection {
  const targetDir = join(projectRoot, ".reck");
  mkdirSync(targetDir, { recursive: true });
  const initialInspection = inspectFrameworkTarget(projectRoot);
  const reactGrabInit = initializeReactGrabForFramework(projectRoot, initialInspection.framework);
  const sourceAnnotationsInit = initializeSourceAnnotationsForFramework(projectRoot, initialInspection.framework);
  const inspection = inspectFrameworkTarget(projectRoot);
  writeFileSync(
    join(targetDir, "target.json"),
    `${JSON.stringify({
      framework: inspection.framework,
      missing_source: inspection.missingSource,
      missing_source_reason: inspection.missingSourceReason,
      react_grab_installed: inspection.reactGrabInstalled,
      react_grab_initialized: inspection.reactGrabInitialized,
      react_grab_init_file: inspection.reactGrabInitFile,
      source_annotations_initialized: inspection.sourceAnnotationsInitialized,
      source_annotations_file: inspection.sourceAnnotationsFile,
    }, null, 2)}\n`,
  );
  const initializedInspection = inspectFrameworkTarget(projectRoot);
  return {
    ...initializedInspection,
    reactGrabInitChanged: reactGrabInit.changed,
    reactGrabInitFile: reactGrabInit.filePath ?? initializedInspection.reactGrabInitFile,
    reactGrabInitMessage: reactGrabInit.message,
    sourceAnnotationsChanged: sourceAnnotationsInit.changed,
    sourceAnnotationsFile: sourceAnnotationsInit.filePath ?? initializedInspection.sourceAnnotationsFile,
    sourceAnnotationsMessage: sourceAnnotationsInit.message,
  };
}

type FrameworkInitResult = {
  changed: boolean;
  filePath: string | null;
  message: string | null;
};

const REACT_GRAB_NEXT_SCRIPT = `{process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}`;

function initializeReactGrabForFramework(projectRoot: string, framework: FrameworkTargetInspection["framework"]): FrameworkInitResult {
  if (framework !== "next-react") {
    return { changed: false, filePath: null, message: framework === "unknown" ? "No supported React framework detected" : "Framework initialization not required" };
  }

  return initializeNextAppRouterReactGrab(projectRoot);
}

function initializeSourceAnnotationsForFramework(projectRoot: string, framework: FrameworkTargetInspection["framework"]): FrameworkInitResult {
  if (framework !== "next-react") {
    return { changed: false, filePath: null, message: framework === "unknown" ? "No supported React framework detected" : "Framework source annotations not required" };
  }

  return initializeNextAppRouterSourceAnnotations(projectRoot);
}

function initializeNextAppRouterReactGrab(projectRoot: string): FrameworkInitResult {
  const layoutPath = findNextAppRouterLayoutFile(projectRoot);
  if (!layoutPath) return { changed: false, filePath: null, message: "Could not find app/layout.tsx or app/layout.jsx" };

  const originalContent = readFileSync(layoutPath, "utf8");
  if (hasReactGrabScript(originalContent)) {
    return { changed: false, filePath: layoutPath, message: "React Grab is already initialized" };
  }

  let newContent = ensureNextScriptImport(originalContent);
  newContent = insertReactGrabScript(newContent);
  if (newContent === originalContent) {
    return { changed: false, filePath: layoutPath, message: "Could not find <html> or <head> in app layout" };
  }

  writeFileSync(layoutPath, newContent);
  return { changed: true, filePath: layoutPath, message: "Added React Grab Next App Router script" };
}

function initializeNextAppRouterSourceAnnotations(projectRoot: string): FrameworkInitResult {
  const layoutPath = findNextAppRouterLayoutFile(projectRoot);
  if (!layoutPath) return { changed: false, filePath: null, message: "Could not find app/layout.tsx or app/layout.jsx" };

  const originalContent = readFileSync(layoutPath, "utf8");
  if (hasReckSourceAnnotations(originalContent)) {
    const upgradedContent = upgradeNextAppRouterSourceAnnotations(originalContent, layoutPath);
    if (upgradedContent !== originalContent) {
      writeFileSync(layoutPath, upgradedContent);
      return { changed: true, filePath: layoutPath, message: "Upgraded Reck dev-only source annotation wrapper" };
    }
    return { changed: false, filePath: layoutPath, message: "Reck source annotations are already initialized" };
  }

  let newContent = ensureReckSourceImport(originalContent, layoutPath);
  newContent = wrapNextLayoutChildrenWithSourceAnnotations(newContent, layoutPath);
  if (newContent === originalContent) {
    return { changed: false, filePath: layoutPath, message: "Could not find {children} in app layout" };
  }

  writeFileSync(layoutPath, newContent);
  return { changed: true, filePath: layoutPath, message: "Added Reck dev-only source annotation wrapper" };
}

function findNextAppRouterLayoutFile(projectRoot: string): string | null {
  const candidates = [
    join(projectRoot, "app", "layout.tsx"),
    join(projectRoot, "app", "layout.jsx"),
    join(projectRoot, "src", "app", "layout.tsx"),
    join(projectRoot, "src", "app", "layout.jsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function hasReactGrabScript(content: string): boolean {
  return /react-grab/.test(content);
}

function hasReckSourceAnnotations(content: string): boolean {
  return /data-reck-source-file|ReckSourceRoot/.test(content);
}

function ensureNextScriptImport(content: string): string {
  if (/import\s+Script\s+from\s+["']next\/script["'];?/.test(content)) return content;
  const importMatch = content.match(/^import .+ from ['"].+['"];?\s*$/m);
  if (importMatch) return content.replace(importMatch[0], `${importMatch[0]}\nimport Script from "next/script";`);
  return `import Script from "next/script";\n\n${content}`;
}

function insertReactGrabScript(content: string): string {
  const headMatch = content.match(/<head[^>]*>/);
  if (headMatch) return content.replace(headMatch[0], `${headMatch[0]}\n        ${REACT_GRAB_NEXT_SCRIPT}`);

  const htmlMatch = content.match(/<html[^>]*>/);
  if (htmlMatch) {
    return content.replace(htmlMatch[0], `${htmlMatch[0]}\n      <head>\n        ${REACT_GRAB_NEXT_SCRIPT}\n      </head>`);
  }

  return content;
}

function ensureReckSourceImport(content: string, layoutPath: string): string {
  if (/function\s+ReckSourceRoot/.test(content)) return content;
  const rootLayoutLine = lineNumberFor(content, /export\s+default\s+function\s+RootLayout/);
  const helper = `\nfunction ReckSourceRoot({ children }: { children: ReactNode }) {\n  if (process.env.NODE_ENV !== \"development\") return <>{children}</>;\n  return (\n    <>\n      <script\n        id=\"reck-source-root\"\n        type=\"application/json\"\n        data-reck-component=\"RootLayout\"\n        data-reck-source-file=${JSON.stringify(layoutPath)}\n        data-reck-source-line={${rootLayoutLine}}\n        data-reck-source-column={24}\n        data-reck-source-truth=\"source-file\"\n        suppressHydrationWarning\n      />\n      {children}\n    </>\n  );\n}\n`;
  const defaultFunctionMatch = content.match(/\nexport\s+default\s+function\s+/);
  if (defaultFunctionMatch?.index != null) {
    return `${content.slice(0, defaultFunctionMatch.index)}${helper}${content.slice(defaultFunctionMatch.index)}`;
  }
  return `${content}${helper}`;
}

function upgradeNextAppRouterSourceAnnotations(content: string, layoutPath: string): string {
  const sourceFileAttr = `data-reck-source-file=${JSON.stringify(layoutPath)}`;
  if (content.includes('id="reck-source-root"') && content.includes(sourceFileAttr)) return content;
  return content.replace(/return \(\n    <div\n      data-reck-component="RootLayout"\n      data-reck-source-file="[^"]+"\n      data-reck-source-line=\{(\d+)\}\n      data-reck-source-column=\{24\}\n      data-reck-source-truth="source-file"\n    >\n      \{children\}\n    <\/div>\n  \);/m, (_match, line) => `return (\n    <>\n      <script\n        id="reck-source-root"\n        type="application/json"\n        data-reck-component="RootLayout"\n        data-reck-source-file=${JSON.stringify(layoutPath)}\n        data-reck-source-line={${line}}\n        data-reck-source-column={24}\n        data-reck-source-truth="source-file"\n        suppressHydrationWarning\n      />\n      {children}\n    </>\n  );`);
}

function wrapNextLayoutChildrenWithSourceAnnotations(content: string, layoutPath: string): string {
  void layoutPath;
  return content.replace("{children}</AppShell>", "<ReckSourceRoot>{children}</ReckSourceRoot></AppShell>").replace("<body>{children}</body>", "<body><ReckSourceRoot>{children}</ReckSourceRoot></body>");
}

function lineNumberFor(content: string, pattern: RegExp): number {
  const match = content.match(pattern);
  if (match?.index == null) return 1;
  return content.slice(0, match.index).split("\n").length;
}

function readExistingConfig(configPath: string): Record<string, unknown> {
  if (!existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readPackageJson(packageJsonPath: string): Record<string, unknown> | null {
  if (!existsSync(packageJsonPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
