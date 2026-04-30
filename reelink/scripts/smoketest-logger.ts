// confirm the logger emits structured JSON to stderr
// and the tool-middleware wrapper produces enter/exit log lines.

import { logger } from "../src/utils/logger.js";
import { withToolLogging } from "../src/utils/tool-middleware.js";

const log = logger("smoketest-logger");

log.info({ step: "init" }, "logger online");

const wrapped = withToolLogging<{ path: string; deep?: { secret: string } }, { ok: boolean }>(
  "reelink_dummy",
  async (args) => {
    log.info({ path: args.path, hasSecret: Boolean(args.deep?.secret) }, "handler ran");
    return { ok: true };
  },
);

await wrapped({ path: "/tmp/example.mov", deep: { secret: "should-not-leak" } });

log.info({ step: "done" }, "smoketest complete");
