# Rename Plan: `reelink` → `reck`

**Status:** ready to execute (do NOT start until npm `@anslai` scope and `github.com/anslai` org are confirmed available).

**Final identity:**
- Project name: **Reck**
- npm package: **`@anslai/reck`** (scoped, public)
- GitHub: **`anslai/reck`** (org rename `anslhq` → `anslai`, repo rename `reelink` → `reck`)
- Domain: **`tryreck.dev`** (defensive: `tryreck.app`)
- Binaries: `reck` (CLI), `reck-mcp` (MCP server)
- Recording dir: `.reck/<id>/`
- MCP tool prefix: `reck_*` (was `reelink_*`)
- Env var prefix: `RECK_*` (was `REELINK_*`)
- Folder: `reck/` at repo root (was `reelink/`)

---

## 0. Pre-flight verification (DO FIRST — blocks everything else)

| Check | Command / URL | Pass condition |
|---|---|---|
| npm scope `@anslai` free | `curl -sS -o /dev/null -w "%{http_code}\n" https://registry.npmjs.org/@anslai%2Fanything` then visit `https://www.npmjs.com/~anslai` | `~anslai` returns 404 |
| GitHub org `anslai` free | `https://github.com/anslai` | 404 |
| Domain `tryreck.dev` free | Namecheap | available |
| npm bare `reck` (sanity) | `https://www.npmjs.com/package/reck` | accept that bare `reck` is taken (2016 abandoned); we're scoped |

**If `@anslai` or `github.com/anslai` is taken → fall back to `@anslhq/reck` and skip §1 (org rename).** The rest of this plan still applies.

---

## 1. GitHub org + repo rename

1. Create or claim `github.com/anslai` (Settings → New organization, or transfer ownership if pre-existing).
2. Rename current org: `Settings → Organization name → anslai` on `anslhq`. GitHub auto-redirects `anslhq/*` URLs.
3. Rename repo: `anslhq/reelink → anslai/reck` (Settings → Repository name).
4. Update local remotes:
   ```bash
   git remote set-url origin git@github.com:anslai/reck.git
   git remote -v   # verify
   ```
5. Update README badges, clone URLs, and any `github.com/anslhq/reelink` strings (covered in §3).

---

## 2. Filesystem renames (single commit, no content changes)

```bash
git mv reelink reck
git mv reck/.reelink reck/.reck      # if tracked; otherwise update .gitignore
```

Update `.gitignore` to add `.reck/` (and remove `.reelink/` if listed).

**Commit:** `chore: rename reelink/ → reck/ folder`

---

## 3. Identity fields (single commit per logical group)

### 3a. `reck/package.json`
```json
{
  "name": "@anslai/reck",
  "bin": {
    "reck": "./dist/cli.js",
    "reck-mcp": "./dist/server.js"
  }
}
```
Also update `description`, `homepage`, `repository.url`, `bugs.url` to point at `anslai/reck`.

### 3b. MCP server identity — `reck/src/mcp/server.ts` (and `reck/src/server/index.ts`)
- `new McpServer({ name: "reck", version: ... })`
- `export const REELINK_VERSION` → `export const RECK_VERSION`

### 3c. CLI — `reck/src/cli.ts`
- Help strings: `reelink record …` → `reck record …`
- Logger component name: `reelink-cli` → `reck-cli`

### 3d. Logger — `reck/src/utils/logger.ts`
- `pino({ name: "reelink" })` → `pino({ name: "reck" })`
- Env reads: `REELINK_LOG_LEVEL` → `RECK_LOG_LEVEL`, `REELINK_LOG_PRETTY` → `RECK_LOG_PRETTY`

### 3e. Env vars — `reck/.env.example` + all `compose-config.ts`, `init-config.ts` readers
Rename in-place (keep semantics identical):

| Old | New |
|---|---|
| `REELINK_OPENROUTER_MODEL` | `RECK_OPENROUTER_MODEL` |
| `REELINK_OPENAI_MODEL` | `RECK_OPENAI_MODEL` |
| `REELINK_OPENAI_QUERY_MODEL` | `RECK_OPENAI_QUERY_MODEL` |
| `REELINK_VLM_MODEL` | `RECK_VLM_MODEL` |
| `REELINK_LOG_LEVEL` | `RECK_LOG_LEVEL` |
| `REELINK_LOG_PRETTY` | `RECK_LOG_PRETTY` |
| `REELINK_DEFAULT_FPS_SAMPLE` | `RECK_DEFAULT_FPS_SAMPLE` |
| `REELINK_COPY_IMPORTED_VIDEOS` | `RECK_COPY_IMPORTED_VIDEOS` |
| `REELINK_QUERY_GPT_FALLBACK` | `RECK_QUERY_GPT_FALLBACK` |
| `REELINK_PLAYWRIGHT_MCP_COMMAND` | `RECK_PLAYWRIGHT_MCP_COMMAND` |

**No backward-compat aliases.** Pre-1.0, breaking change is fine; document in CHANGELOG.

### 3f. Browser-recording globals — `reck/src/browser-recording/lifecycle.ts`
- `__REELINK_REACT_RECORDER__` → `__RECK_REACT_RECORDER__` (5+ occurrences)

### 3g. MCP tool names — `reck/src/mcp/tools/*.ts`

| Old tool name | New tool name |
|---|---|
| `reelink_analyze` | `reck_analyze` |
| `reelink_get_finding` | `reck_get_finding` |
| `reelink_get_frame` | `reck_get_frame` |
| `reelink_query` | `reck_query` |
| `reelink_get_dom` | `reck_get_dom` |
| `reelink_get_components` | `reck_get_components` |
| `reelink_run` | `reck_run` |
| `reelink_record_start` | `reck_record_start` |
| `reelink_record_stop` | `reck_record_stop` |
| `reelink_record_status` | `reck_record_status` |
| `reelink_browser_*` | `reck_browser_*` |

Update tool registration calls AND any internal cross-references (route handlers, telemetry, smoketests).

### 3h. Recording artifact directory
- Hardcoded `.reelink/` paths in `reck/src/recordings/store.ts`, `reck/src/agent-run/run.ts`, `reck/src/analysis/pipeline.ts` → `.reck/`

### 3i. Codex MCP config block (in `docs/setup-prompt.md` and `docs/integration-testing-runbook.md`)
```toml
[mcp_servers.reck]
command = "/absolute/path/to/bun"
args = ["run", "/absolute/path/to/reck/dist/server.js"]
env = { OPENROUTER_API_KEY = "..." }
```
Replace all `[mcp_servers.reelink]` → `[mcp_servers.reck]` and `reelink_analyze` example calls → `reck_analyze`.

---

## 4. Documentation pass (find-and-replace)

Run these in order; each one is a separate commit so the diff is reviewable.

```bash
# 4a. lowercase identifier (most occurrences)
rg -l 'reelink' --type-add 'cfg:*.{md,toml,json,ts,js,yml,yaml,sh,env,example}' -t cfg \
  | grep -v node_modules | grep -v transcript-combined | grep -v openspec/ \
  | xargs sed -i '' 's/reelink/reck/g'

# 4b. uppercase env-var prefix
rg -l 'REELINK_' | grep -v node_modules \
  | xargs sed -i '' 's/REELINK_/RECK_/g'

# 4c. PascalCase brand mentions
rg -l 'Reelink' | grep -v node_modules | grep -v transcript-combined \
  | xargs sed -i '' 's/Reelink/Reck/g'
```

**Files explicitly NOT to touch:**
- `transcript-combined.md` (historical, will be `.gitignore`d)
- `openspec/changes/build-reelink-mcp/**` (folder name preserves the historical change ID; content can keep `Reelink` references — leave as historical record OR rename folder to `build-reck-mcp` and bump spec version, your call)
- Anything under `.git/` or `node_modules/`
- `.agents/skills/` (unrelated to project identity)

**Manual review after sed:**
- `README.md` — verify install commands, badges, screenshots' alt text
- `reck/README.md` — verify quickstart still works
- `docs/setup-prompt.md` — paste-ready Codex block must be self-consistent
- `LICENSE` and `NOTICE` — copyright lines stay as "Harsha Vardhan and ANSL contributors" (no rename)

---

## 5. Build + verify

```bash
cd reck
bun install
bun run typecheck
bun run build          # if defined
bun run smoketest      # or whatever the existing smoketest entrypoint is
./dist/cli.js --help   # confirms binary name + help renders cleanly
./dist/cli.js record https://example.com --max-seconds 5
```

Verify in MCP client (Codex):
```bash
codex mcp remove reelink   # if previously registered
# add new block per docs/setup-prompt.md (now references "reck")
codex mcp list             # should show "reck" running
```

Inside Codex, call `reck_analyze("/path/to/clip.mov")` and confirm `{recording_id, duration_sec, summary, findings, next_steps}` returns.

---

## 6. Publish to npm

```bash
cd reck
npm whoami                    # confirm logged in as harshav
npm access ls-packages @anslai 2>/dev/null   # confirms scope ownership
npm publish --access public   # scoped packages default to private; --access public required
```

Verify:
- `https://www.npmjs.com/package/@anslai/reck` resolves
- `npx @anslai/reck --help` works from a clean directory

---

## 7. Push + repo hygiene

```bash
git push origin main
git push origin --tags
```

GitHub repo settings:
- Description: "Temporal memory for AI coding agents — turn screen recordings into queryable WorkItems via MCP"
- Topics: `mcp`, `ai-agents`, `screen-recording`, `developer-tools`, `typescript`, `bun`, `codex`, `cursor`
- Pin the demo video to README
- Add `https://tryreck.dev` to homepage field once domain resolves

---

## 8. Out of scope (do later, in a separate PR)

- Rename OpenSpec change directory `openspec/changes/build-reelink-mcp/` (historical artifact — only rename if you regenerate the spec authority)
- Migrate `.reelink/` recording dirs in user `$HOME` (one-shot migration script — write only if there are real users; for now just document `.reck/` as the new location)
- Rewrite git history to scrub the string `reelink` (DO NOT do this — it's the project's historical name, not a secret; rewriting breaks every existing clone, link, and the submission's git hash)

---

## 9. Rollback plan

If something breaks mid-rename:
1. `git reset --hard HEAD~N` to drop the rename commits (they're isolated per §3 sub-step)
2. GitHub org rename has a 90-day undo window via Support
3. npm package — once published, you cannot delete; instead `npm deprecate @anslai/reck@<version> "use <correct-version>"` and publish a fix

---

## Execution order summary

1. ☐ §0 verify availability of `@anslai`, `github.com/anslai`, `tryreck.dev`
2. ☐ §1 GitHub org + repo rename (`anslhq` → `anslai`, `reelink` → `reck`)
3. ☐ §2 filesystem rename `reelink/` → `reck/`
4. ☐ §3 identity fields (package.json, MCP server, CLI, logger, env, tool names, dirs)
5. ☐ §4 doc find-and-replace (4a → 4b → 4c, separate commits)
6. ☐ §5 build + verify (typecheck, smoketest, MCP roundtrip)
7. ☐ §6 `npm publish --access public`
8. ☐ §7 push + repo hygiene
9. ☐ §8 (deferred) OpenSpec dir, user migration script
