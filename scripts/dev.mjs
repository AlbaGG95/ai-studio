#!/usr/bin/env node

import { spawn } from "child_process";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

// Determine if running on Windows
const isWindows = process.platform === "win32";

/**
 * Run a command with proper shell handling for Windows and Unix
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: "inherit",
      ...options,
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on("error", reject);
  });
}

/**
 * Poll for API readiness by checking ports.json existence
 */
async function waitForApiReady(maxAttempts = 60, delayMs = 500) {
  const portsPath = join(repoRoot, ".ai-studio", "ports.json");

  for (let i = 0; i < maxAttempts; i++) {
    try {
      if (existsSync(portsPath)) {
        const data = await readFile(portsPath, "utf-8");
        const parsed = JSON.parse(data);
        console.log(`✓ API ready on ${parsed.apiUrl}`);
        return parsed;
      }
    } catch (err) {
      // File might exist but not be readable yet; continue polling
    }

    if (i < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(
    "API did not become ready within timeout. Check if API process is running."
  );
}

/**
 * Main orchestration
 */
async function main() {
  console.log(
    "🚀 Starting AI Studio development servers (Windows + cross-platform)...\n"
  );

  try {
    // Step 1: Start API in background
    console.log("📦 Starting API server...");
    const apiProc = spawn(
      isWindows ? "cmd" : "sh",
      isWindows
        ? ["/c", "pnpm --filter api dev"]
        : ["-c", "pnpm --filter api dev"],
      {
        cwd: repoRoot,
        stdio: "inherit",
      }
    );

    // Handle API process errors
    apiProc.on("error", (err) => {
      console.error("❌ Failed to start API:", err);
      process.exit(1);
    });

    // Step 2: Wait for API to be ready
    console.log("⏳ Waiting for API to be ready...");
    let apiInfo;
    try {
      apiInfo = await waitForApiReady();
    } catch (err) {
      console.error("❌", err.message);
      apiProc.kill();
      process.exit(1);
    }

        console.log("\nAPI server started!");
    console.log(`   API:  ${apiInfo.apiUrl}`);
    console.log("\nPress Ctrl+C to stop the server.\n");

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Shutting down servers...");
      apiProc.kill();
      process.exit(0);
    });

    // Monitor child processes
    apiProc.on("close", (code) => {
      if (code !== null && code !== 0) {
        console.error(`❌ API exited with code ${code}`);
      }
    });
  } catch (err) {
    console.error("❌ Fatal error:", err.message);
    process.exit(1);
  }
}

main();
