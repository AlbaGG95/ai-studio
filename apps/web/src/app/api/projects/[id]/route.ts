"use server";

import { NextResponse } from "next/server";
import { deleteProject, getProject, persistProject } from "../../../../lib/projects";

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const projectId = params.id;
    const project = projectId ? await getProject(projectId) : null;
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
    }
    // ensure persisted (migration)
    await persistProject(project);
    return NextResponse.json({ ok: true, project });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const projectId = params.id;
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "Missing projectId" }, { status: 400 });
    }
    await deleteProject(projectId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
