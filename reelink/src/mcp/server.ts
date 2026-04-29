// fallow-ignore-next-line unresolved-import
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerDevxTools } from "./tools/devx.js";
import { registerLayer0Tools } from "./tools/layer0.js";
import { registerRecordingTools, registerRunTools } from "./tools/recording.js";
import { registerQueryTools, registerRetrievalTools } from "./tools/retrieval.js";

export function createReelinkMcpServer(): McpServer {
  const server = new McpServer({
    name: "reelink",
    version: "0.0.0",
  });

  registerLayer0Tools(server);
  registerRetrievalTools(server);
  registerRecordingTools(server);
  registerQueryTools(server);
  registerRunTools(server);
  registerDevxTools(server);

  return server;
}
