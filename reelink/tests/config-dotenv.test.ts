import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadDotEnv, parseDotEnvLine } from "../src/config/dotenv.js";

let previousCwd: string;

beforeEach(() => {
  previousCwd = process.cwd();
});

afterEach(() => {
  process.chdir(previousCwd);
  delete process.env.DOTENV_PRECEDENCE;
  delete process.env.FOO;
  delete process.env.DOTENV_EXISTING;
  delete process.env.DOTENV_TRIM;
  delete process.env.DOTENV_QUOTED;
  delete process.env.DOTENV_EXPORT;
  delete process.env.DOTENV_INLINE_COMMENT;
});

describe("loadDotEnv", () => {
  test(".env.local is applied before .env (local wins)", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "reelink-dotenv-precedence-"));
    process.chdir(workspace);
    writeFileSync(join(workspace, ".env"), `DOTENV_PRECEDENCE=left\nFOO=env\n`);
    writeFileSync(join(workspace, ".env.local"), `DOTENV_PRECEDENCE=right\nFOO=local\n`);
    delete process.env.DOTENV_PRECEDENCE;
    delete process.env.FOO;

    loadDotEnv(workspace);

    expect(process.env.DOTENV_PRECEDENCE as string | undefined).toBe("right");
    expect(process.env.FOO as string | undefined).toBe("local");
    await rm(workspace, { recursive: true, force: true });
  });

  test("does not overwrite existing process.env entries", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "reelink-dotenv-existing-"));
    process.chdir(workspace);
    process.env.DOTENV_EXISTING = "preserve";
    writeFileSync(join(workspace, ".env"), `DOTENV_EXISTING=lost-by-design-if-not-preserving\n`);

    loadDotEnv(workspace);

    expect(process.env.DOTENV_EXISTING).toBe("preserve");

    delete process.env.DOTENV_EXISTING;
    await rm(workspace, { recursive: true, force: true });
  });

  test("parses unquoted tokens and trims basic assignment", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "reelink-dotenv-trim-"));
    process.chdir(workspace);
    writeFileSync(join(workspace, ".env"), `# comment\n DOTENV_TRIM = spaced \n`);

    delete process.env.DOTENV_TRIM;
    loadDotEnv(workspace);

    expect(process.env.DOTENV_TRIM as string | undefined).toBe("spaced");
    await rm(workspace, { recursive: true, force: true });
  });

  test("parses doubly quoted values", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "reelink-dotenv-quoted-"));
    process.chdir(workspace);
    writeFileSync(join(workspace, ".env"), `DOTENV_QUOTED="quoted value"\n`);
    delete process.env.DOTENV_QUOTED;
    loadDotEnv(workspace);
    expect(process.env.DOTENV_QUOTED as string | undefined).toBe("quoted value");
    await rm(workspace, { recursive: true, force: true });
  });

  test("parses export syntax, single quotes, and unquoted inline comments", async () => {
    expect(parseDotEnvLine(`export DOTENV_EXPORT='single quoted'`)).toEqual({
      key: "DOTENV_EXPORT",
      value: "single quoted",
    });
    expect(parseDotEnvLine("DOTENV_INLINE_COMMENT=value # comment")).toEqual({
      key: "DOTENV_INLINE_COMMENT",
      value: "value",
    });
    expect(parseDotEnvLine("1_BAD=value")).toBeNull();
  });
});
