import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? "0.0.0.0";

// The built page lives in client/dist, two folders up from both server/src and server/dist.
const builtPage = fileURLToPath(new URL("../../client/dist", import.meta.url));
const clientDir = process.env.CLIENT_DIR ?? (existsSync(builtPage) ? builtPage : undefined);

// DEMO=1 marks a site as a demo: the page shows a banner saying to use made-up content only.
const demo = process.env.DEMO === "1" || process.env.DEMO === "true";

const app = await buildApp(undefined, { clientDir, demo });
await app.listen({ port, host });
console.log(`Server listening on port ${port}${clientDir ? " (serving the built page)" : ""}`);

// Hosts stop a program with SIGTERM; close the connections politely.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
