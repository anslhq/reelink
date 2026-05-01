import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (!existsSync(join(process.cwd(), "src", "App.jsx"))) {
  throw new Error("missing source: src/App.jsx");
}

mkdirSync(join(process.cwd(), "dist"), { recursive: true });
writeFileSync(join(process.cwd(), "dist", "index.html"), "<html><body>built second target</body></html>\n");
process.stdout.write("built fixture target\n");
