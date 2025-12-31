"use server";

import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";

export async function GET() {
  try {
    const repoRoot = path.resolve(process.cwd(), "../../..");
    const dir = path.join(repoRoot, "data", "projects");
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const projects = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const raw = await readFile(path.join(dir, entry.name), "utf-8").catch(() => null);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        projects.push(parsed);
      } catch {
        // ignore invalid json
      }
    }
    return NextResponse.json({ ok: true, projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
