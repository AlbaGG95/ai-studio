#!/usr/bin/env node

const target = process.env.RESET_URL || "http://localhost:3000/api/dev/reset";

async function main() {
  console.log(`Resetting via ${target} ...`);
  try {
    const res = await fetch(target, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || `Status ${res.status}`);
    }
    console.log("Reset OK");
  } catch (err) {
    console.error("Reset failed:", err instanceof Error ? err.message : err);
    console.log("If server not running, start web dev server then retry.");
    process.exitCode = 1;
  }
}

main();
