"use server";

import { NextResponse } from "next/server";
import { resetAllProjects } from "../../../../lib/projects";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  try {
    await resetAllProjects();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reset failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
