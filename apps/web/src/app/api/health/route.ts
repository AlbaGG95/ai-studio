"use server";

import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    version: pkg.version || "dev",
  });
}
