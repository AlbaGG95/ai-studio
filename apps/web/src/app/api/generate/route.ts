"use server";

import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { interpretToSpec } from "../../../../../../lib/specInterpreter";
import { validateGameSpec } from "../../../../../../lib/gameSpec";
import { getTemplates, selectTemplate, TemplateId } from "../../../../../../lib/templates/registry";

type GenerateBody = { title?: string; prompt?: string };

const RATE_LIMIT = { windowMs: 60_000, max: 30 };
const LIMITS = { title: 120, prompt: 6000 };

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

    const parsed = await parseBody(request);
    if (!parsed.ok) {
      return cors(NextResponse.json({ error: parsed.error }, { status: 400 }));
    }

    let title: string;
    let prompt: string;
    try {
      title = sanitizeText(parsed.body.title, LIMITS.title);
      prompt = sanitizeText(parsed.body.prompt, LIMITS.prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid input";
      return cors(NextResponse.json({ error: message }, { status: 400 }));
    }

    if (!title && !prompt) {
      return cors(NextResponse.json({ error: "title or prompt required" }, { status: 400 }));
    }

    const spec = interpretToSpec(title || "Untitled Game", prompt || "");
    const validation = validateGameSpec(spec);
    if (!validation.ok) {
      return cors(NextResponse.json({ error: "Invalid spec", details: validation.errors }, { status: 400 }));
    }

    let template = selectTemplate(spec);
    let generated;
    try {
      generated = template.build(spec);
    } catch (err) {
      console.warn("Template build failed, using placeholder:", err);
      template = getPlaceholderTemplate();
      generated = template.build(spec);
    }

    if (!generated?.route) {
      return cors(NextResponse.json({ error: "Template build failed" }, { status: 500 }));
    }

    const projectId = `proj-${randomUUID()}`;
    const record = {
      id: projectId,
      schemaVersion: 1,
      specVersion: spec.version,
      title: title || spec.title,
      prompt,
      spec,
      templateId: template.id,
      generated,
      createdAt: new Date().toISOString(),
    };

    try {
      await persist(record);
    } catch (err) {
      console.warn("Failed to persist project; returning response anyway", err);
    }

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

async function parseBody(request: Request): Promise<{ ok: true; body: GenerateBody } | { ok: false; error: string }> {
  try {
    const body = (await request.json()) as GenerateBody;
    return { ok: true, body };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

function sanitizeText(value: unknown, max: number): string {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`Input too long (max ${max} chars)`);
  }
  return trimmed;
}

function getPlaceholderTemplate() {
  const templates = getTemplates();
  const placeholder = templates.find((t) => t.id === TemplateId.placeholder_basic);
  if (!placeholder) {
    throw new Error("No placeholder template available");
  }
  return placeholder;
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
