import { NextResponse } from "next/server";
import { join } from "path";
import { readFile } from "fs/promises";

export async function GET() {
  try {
    const portsPath = join(process.cwd(), ".ai-studio", "ports.json");
    const data = await readFile(portsPath, "utf-8");
    const parsed = JSON.parse(data);
    return NextResponse.json({
      apiUrl: parsed.apiUrl,
      apiPort: parsed.apiPort,
    });
  } catch (err) {
    // Fallback to env or default
    const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    return NextResponse.json({
      apiUrl: envUrl,
      apiPort: Number(
        process.env.NEXT_PUBLIC_API_URL?.split(":").pop() || 4000
      ),
    });
  }
}
