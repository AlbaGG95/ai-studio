"use server";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { interpretToSpec } from "../../../../../../lib/specInterpreter";
import { selectTemplate } from "../../../../../../lib/templates/registry";

type GenerateBody = { title?: string; prompt?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const title = (body?.title || "").trim();
    const prompt = (body?.prompt || "").trim();

    if (!title && !prompt) {
      return NextResponse.json({ error: "title or prompt required" }, { status: 400 });
    }

    const spec = interpretToSpec(title || "Untitled Game", prompt || "");
    const template = selectTemplate(spec);
    const generated = template.build(spec);

    const projectId = `proj-${randomUUID()}`;
    const record = {
      id: projectId,
      title: title || spec.title,
      prompt,
      spec,
      templateId: template.id,
      generated,
      createdAt: new Date().toISOString(),
    };

    await persist(record);

    return NextResponse.json(
      {
        projectId,
        spec,
        templateId: template.id,
        route: generated.route,
      },
      { status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function persist(record: any) {
  // Attempt to save under repo root data/projects; fallback to local .data
  const repoRoot = path.resolve(process.cwd(), "../../..");
  const primaryDir = path.join(repoRoot, "data", "projects");
  const fallbackDir = path.join(process.cwd(), ".data", "projects");

  try {
    await mkdir(primaryDir, { recursive: true });
    await writeFile(path.join(primaryDir, `${record.id}.json`), JSON.stringify(record, null, 2), "utf-8");
    return;
  } catch {
    await mkdir(fallbackDir, { recursive: true });
    await writeFile(path.join(fallbackDir, `${record.id}.json`), JSON.stringify(record, null, 2), "utf-8");
  }
}
