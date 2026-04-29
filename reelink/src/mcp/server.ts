// fallow-ignore-next-line unresolved-import
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAnalysisTools } from "./tools/analysis.js";
import { registerDevxTools } from "./tools/devx.js";
import { registerRecordingTools, registerRunTools } from "./tools/recording.js";
import { registerQueryTools, registerRetrievalTools } from "./tools/retrieval.js";

export function createReelinkMcpServer(): McpServer {
  const server = new McpServer({
    name: "reelink",
    version: "0.0.0",
  });

  registerAnalysisTools(server);
  registerRetrievalTools(server);
  registerRecordingTools(server);
  registerQueryTools(server);
  registerRunTools(server);
  registerDevxTools(server);

  return server;
}
