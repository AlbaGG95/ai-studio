"use server";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { interpretToSpec } from "../../../../../../lib/specInterpreter";
import { selectTemplate } from "../../../../../../lib/templates/registry";

type GenerateBody = { title?: string; prompt?: string };

const RATE_LIMIT = {
  windowMs: 60_000,
  max: 30,
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export async function OPTIONS() {
  return cors(NextResponse.json({ ok: true }));
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return cors(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    }

    let body: GenerateBody = {};
    try {
      body = (await request.json()) as GenerateBody;
    } catch {
      return cors(NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
    }
    const title = (body?.title || "").trim();
    const prompt = (body?.prompt || "").trim();

    if (!title && !prompt) {
      return cors(NextResponse.json({ error: "title or prompt required" }, { status: 400 }));
    }

    const spec = interpretToSpec(title || "Untitled Game", prompt || "");
    const template = selectTemplate(spec);
    const generated = template.build(spec);

    const projectId = `proj-${randomUUID()}`;
    const record = {
      id: projectId,
      schemaVersion: 1,
      title: title || spec.title,
      prompt,
      spec,
      templateId: template.id,
      generated,
      createdAt: new Date().toISOString(),
    };

    await persist(record);

    return cors(
      NextResponse.json(
        {
          projectId,
          spec,
          templateId: template.id,
          route: generated.route,
        },
        { status: 200 }
      )
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return cors(NextResponse.json({ error: message }, { status: 500 }));
  }
}

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return true;
  }
  if (bucket.count >= RATE_LIMIT.max) {
    return false;
  }
  bucket.count += 1;
  return true;
}
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
