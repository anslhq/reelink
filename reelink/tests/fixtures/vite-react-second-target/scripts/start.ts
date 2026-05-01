import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const port = Number(process.env.PORT);
if (!Number.isFinite(port) || port <= 0) throw new Error("PORT must be set for fixture start smoke");

const html = readFileSync(join(process.cwd(), "dist", "index.html"), "utf8");
const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/html" });
  response.end(html);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`fixture target listening on ${port}\n`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
