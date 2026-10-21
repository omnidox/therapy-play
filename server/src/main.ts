import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { readConfig } from "./config.js";

// Refuses to start without a host passcode unless this is a demo or local development.
let config;
try {
  config = readConfig(process.env, process.argv.includes("--allow-open"));
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

// The built page lives in client/dist, two folders up from both server/src and server/dist.
const builtPage = fileURLToPath(new URL("../../client/dist", import.meta.url));
const clientDir = process.env.CLIENT_DIR ?? (existsSync(builtPage) ? builtPage : undefined);

const { port, host, demo, hostPasscode } = config;
const app = await buildApp(undefined, { clientDir, demo, hostPasscode });
await app.listen({ port, host });
console.log(
  `Server listening on port ${port}${clientDir ? " (serving the built page)" : ""}` +
    `${hostPasscode ? ", host passcode required" : ", room creation is open"}`,
);

// Hosts stop a program with SIGTERM; close the connections politely.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
