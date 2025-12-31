import { NextResponse } from "next/server";
import { join } from "path";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export async function GET() {
  try {
    const cwd = process.cwd();
    const candidates = [
      join(cwd, ".ai-studio", "ports.json"),
      join(cwd, "..", ".ai-studio", "ports.json"),
      join(cwd, "..", "..", ".ai-studio", "ports.json"),
    ];
    const portsPath = candidates.find((p) => existsSync(p));
    if (portsPath) {
      const data = await readFile(portsPath, "utf-8");
      const parsed = JSON.parse(data);
      return NextResponse.json({
        apiUrl: parsed.apiUrl,
        apiPort: parsed.apiPort,
      });
    }
  } catch (err) {
    // Fallback to env or default
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
  return NextResponse.json({
    apiUrl: envUrl,
    apiPort: Number(
      process.env.NEXT_PUBLIC_API_URL?.split(":").pop() ||
        process.env.API_PORT ||
        4001
    ),
  });
}
