#!/usr/bin/env node
/* eslint-env node */

import { spawn } from "child_process";
import { createServer } from "net";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desiredPort = Number(process.env.PORT || 3000);

async function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => server.close(() => resolve(true)))
      .listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(start) {
  const max = start + 20;
  for (let port = start; port <= max; port++) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  return start;
}

async function main() {
  const port = await findAvailablePort(desiredPort);
  if (port !== desiredPort) {
    console.log(`Port ${desiredPort} busy, using ${port} instead.`);
  } else {
    console.log(`Using port ${port}. Set PORT to override.`);
  }

  const command = process.platform === "win32" ? "cmd" : "sh";
  const args =
    process.platform === "win32"
      ? ["/c", `next dev -p ${port}`]
      : ["-c", `next dev -p ${port}`];

  const child = spawn(command, args, {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  child.on("error", (err) => {
    console.error("Failed to start Next dev server:", err);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  process.on("SIGINT", () => {
    child.kill();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Unexpected error starting dev server:", err);
  process.exit(1);
});
