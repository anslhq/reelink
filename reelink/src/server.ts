#!/usr/bin/env node
// fallow-ignore-next-line unresolved-import
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createReelinkMcpServer } from "./mcp/server.js";
import { logger } from "./utils/logger.js";

const log = logger("server");

async function main(): Promise<void> {
  const server = createReelinkMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info({ transport: "stdio" }, "reelink MCP server started");
}

main().catch((err) => {
  log.error(
    {
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
    "reelink MCP server failed",
  );
  process.exit(1);
});
