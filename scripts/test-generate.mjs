#!/usr/bin/env node

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

async function postGenerate() {
  const payload = {
    projectName: "AFK Test",
    description: "idle rpg",
    themePreset: "magical-storybook",
  };

  const response = await fetch(`${baseUrl}/api/generate/game`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Response was not valid JSON");
  }

  if (response.status !== 200 || data.ok === false) {
    throw new Error(data.error || `Unexpected status ${response.status}`);
  }

  if (!data.projectId) {
    throw new Error("projectId missing in generate response");
  }

  return data.projectId;
}

async function getProjects() {
  const res = await fetch(`${baseUrl}/api/projects`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `GET /api/projects -> ${res.status}`);
  }
  if (!Array.isArray(data.projects) || data.projects.length < 1) {
    throw new Error("projects list empty");
  }
  return data.projects;
}

async function getProject(id) {
  const res = await fetch(`${baseUrl}/api/projects/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `GET /api/projects/${id} -> ${res.status}`);
  }
  return data;
}

async function run() {
  const projectId = await postGenerate();
  const projects = await getProjects();
  const found = projects.find((p) => p.projectId === projectId) || projects[0];

  const detail = await getProject(found.projectId || projectId);
  const spec = detail.spec;
  if (!spec || !spec.roster || !Array.isArray(spec.roster.heroes)) {
    throw new Error("spec.roster.heroes missing");
  }
  if (spec.roster.heroes.length < 5) {
    throw new Error("Not enough heroes generated");
  }
  if (!spec.world || !Array.isArray(spec.world.regions) || spec.world.regions.length < 3) {
    throw new Error("World regions insufficient");
  }
  if (!Array.isArray(spec.enemies) || spec.enemies.length === 0) {
    throw new Error("Enemies missing");
  }

  console.log(
    `Smoke test ok -> project ${projectId} with ${spec.roster.heroes.length} heroes, ${spec.world.regions.length} regions`
  );
}

run().catch((err) => {
  console.error("Smoke test failed:", err.message);
  process.exit(1);
});
