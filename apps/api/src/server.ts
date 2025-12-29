import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { mkdir, readFile, readdir, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { buildIdleRpgProject } from "./projectGenerator.js";
import {
  generateGameSpec,
  generateHero,
  generateWorld,
  hashStringToSeed,
} from "./generator.js";
import {
  GameSpec,
  GenerateGameParams,
  GenerateHeroParams,
  GenerateWorldParams,
} from "./types.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

function findRepoRoot(startDir: string): string {
  let current = startDir;
  let lastPackageDir: string | null = null;
  for (let i = 0; i < 10; i += 1) {
    const candidate = resolve(current, "..");
    if (existsSync(join(candidate, "pnpm-workspace.yaml"))) {
      return candidate;
    }
    if (existsSync(join(candidate, "package.json"))) {
      lastPackageDir = candidate;
    }
    current = candidate;
  }
  return lastPackageDir || resolve(startDir, "..");
}

const REPO_ROOT = findRepoRoot(__dirname);
const PROJECTS_DIR = resolve(REPO_ROOT, "data", "projects");
const PORTS_DIR = join(REPO_ROOT, ".ai-studio");
const PORTS_FILE = join(PORTS_DIR, "ports.json");

interface ProjectMetadata {
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
  previewUrl: string;
  themePreset?: string;
}

interface ApplyRequest {
  files: { path: string; content: string }[];
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: "*",
});

if (!existsSync(PROJECTS_DIR)) {
  await mkdir(PROJECTS_DIR, { recursive: true });
}

const buildPreviewUrl = (projectId: string) => `/preview/${projectId}/`;

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function slugifyName(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "idle-rpg";
}

function projectPaths(projectId: string) {
  const dir = join(PROJECTS_DIR, projectId);
  return {
    dir,
    metaPath: join(dir, "meta.json"),
    specPath: join(dir, "spec.json"),
    buildDir: join(dir, "build"),
  };
}

async function saveMetadata(meta: ProjectMetadata) {
  const paths = projectPaths(meta.projectId);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

async function saveSpec(projectId: string, spec: GameSpec) {
  const paths = projectPaths(projectId);
  await mkdir(paths.dir, { recursive: true });
  await writeFile(paths.specPath, JSON.stringify(spec, null, 2), "utf-8");
}

async function loadMetadata(projectId: string): Promise<ProjectMetadata | null> {
  const paths = projectPaths(projectId);
  if (!existsSync(paths.metaPath)) return null;
  const data = await readJsonFile<ProjectMetadata>(paths.metaPath);
  return data
    ? {
        ...data,
        projectId: data.projectId || projectId,
        previewUrl: data.previewUrl || buildPreviewUrl(projectId),
      }
    : null;
}

async function loadSpec(projectId: string): Promise<GameSpec | null> {
  const paths = projectPaths(projectId);
  if (!existsSync(paths.specPath)) return null;
  return readJsonFile<GameSpec>(paths.specPath);
}

async function listProjects(): Promise<ProjectMetadata[]> {
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true }).catch(() => []);
  const metas: ProjectMetadata[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await loadMetadata(entry.name);
    if (meta) {
      metas.push(meta);
      continue;
    }
    const spec = await loadSpec(entry.name);
    if (spec) {
      metas.push({
        projectId: entry.name,
        name: spec.meta.name,
        description: spec.meta.description,
        createdAt: spec.meta.createdAt,
        previewUrl: buildPreviewUrl(entry.name),
        themePreset: spec.meta.themePreset,
      });
    }
  }

  metas.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return metas;
}

async function writeBuildFiles(projectId: string, spec: GameSpec) {
  const paths = projectPaths(projectId);
  const build = buildIdleRpgProject(spec);
  await mkdir(paths.buildDir, { recursive: true });

  // Clean build dir
  if (existsSync(paths.buildDir)) {
    await rm(paths.buildDir, { recursive: true, force: true });
    await mkdir(paths.buildDir, { recursive: true });
  }

  for (const file of build.files) {
    const target = join(paths.buildDir, file.path);
    const parent = resolve(target, "..");
    await mkdir(parent, { recursive: true });
    await writeFile(target, file.content, "utf-8");
  }
}

function buildProjectId(name: string, description: string) {
  const seed = hashStringToSeed(`${name}|${description}`);
  const slug = slugifyName(name);
  const seedPart = seed.toString(36).slice(0, 6) || "offline";
  return `${slug}-${seedPart}`;
}

async function handleGenerateGame(body: any, reply: any) {
  const projectName = (body?.projectName || body?.prompt || "AFK Storybook").toString();
  const description = (body?.description || body?.prompt || "Idle RPG offline").toString();
  const themePreset = body?.themePreset || "magical-storybook";

  if (!projectName.trim()) {
    return reply.code(400).send({ ok: false, error: "projectName requerido" });
  }

  const projectId = buildProjectId(projectName, description);
  const spec = generateGameSpec({ projectName, description, themePreset });
  const createdAt =
    (await loadMetadata(projectId))?.createdAt || new Date().toISOString();

  const meta: ProjectMetadata = {
    projectId,
    name: projectName,
    description,
    createdAt,
    previewUrl: buildPreviewUrl(projectId),
    themePreset,
  };

  await saveMetadata(meta);
  await saveSpec(projectId, spec);
  await writeBuildFiles(projectId, spec);

  return reply.code(200).send({
    ok: true,
    projectId,
    previewUrl: meta.previewUrl,
    createdAt,
    specSummary: {
      heroes: spec.roster.heroes.length,
      regions: spec.world.regions.length,
    },
  });
}

// Endpoints
app.post("/api/generate/game", async (request, reply) => {
  try {
    return await handleGenerateGame(request.body, reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    request.log.error(err);
    return reply.code(500).send({ ok: false, error: message });
  }
});

app.post("/api/generate", async (request, reply) => {
  try {
    return await handleGenerateGame(request.body, reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    request.log.error(err);
    return reply.code(500).send({ ok: false, error: message });
  }
});

app.post<{ Body: GenerateHeroParams }>("/api/generate/hero", async (request, reply) => {
  try {
    const hero = generateHero(request.body || {});
    return reply.code(200).send({ ok: true, hero });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    request.log.error(err);
    return reply.code(500).send({ ok: false, error: message });
  }
});

app.post<{ Body: GenerateWorldParams }>("/api/generate/world", async (request, reply) => {
  try {
    const world = generateWorld(request.body || {});
    return reply.code(200).send({ ok: true, world });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    request.log.error(err);
    return reply.code(500).send({ ok: false, error: message });
  }
});

app.get("/api/projects", async (_request, reply) => {
  try {
    const projects = await listProjects();
    return reply.code(200).send({ ok: true, projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudieron listar los proyectos";
    app.log.error(err);
    return reply.code(500).send({ ok: false, error: message, projects: [] });
  }
});

app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
  const projectId = request.params.id;
  const spec = await loadSpec(projectId);
  const meta = await loadMetadata(projectId);

  if (!meta && !spec) {
    return reply.code(404).send({ ok: false, error: "Not found" });
  }

  return reply.code(200).send({
    ok: true,
    project: meta || {
      projectId,
      name: spec?.meta.name,
      description: spec?.meta.description,
      createdAt: spec?.meta.createdAt,
      previewUrl: buildPreviewUrl(projectId),
    },
    spec,
  });
});

app.post<{ Params: { id: string }; Body: ApplyRequest }>(
  "/projects/:id/apply",
  async (request, reply) => {
    const { id } = request.params;
    const { files } = request.body;

    if (!Array.isArray(files)) {
      return reply.code(400).send({ error: "Invalid files array" });
    }

    const paths = projectPaths(id);
    if (!existsSync(paths.dir)) {
      return reply.code(404).send({ error: "Project not found" });
    }

    try {
      for (const file of files) {
        const target = join(paths.dir, "src", file.path);
        const parent = resolve(target, "..");
        await mkdir(parent, { recursive: true });
        await writeFile(target, file.content, "utf-8");
      }

      return reply.send({ writtenFiles: files.map((f) => f.path) });
    } catch (error) {
      return reply.code(500).send({ error: "Failed to apply changes" });
    }
  }
);

await app.register(fastifyStatic, {
  root: PROJECTS_DIR,
  prefix: "/__static/",
});

app.get<{ Params: { id: string; "*": string } }>(
  "/preview/:id/*",
  async (request, reply) => {
    const { id, "*": path } = request.params as { id: string; "*": string };
    if (path && path.includes("..")) {
      return reply.code(403).send({ error: "Access denied" });
    }
    const paths = projectPaths(id);
    const filePath = join(paths.buildDir, path || "index.html");

    if (!existsSync(paths.buildDir)) {
      return reply.code(404).send({ error: "Project not found" });
    }

    if (!existsSync(filePath)) {
      const indexPath = join(paths.buildDir, "index.html");
      if (existsSync(indexPath)) {
        return reply.sendFile("index.html", paths.buildDir);
      }
      return reply.code(404).send({ error: "Not found" });
    }

    return reply.sendFile(filePath.slice(paths.buildDir.length + 1), paths.buildDir);
  }
);

app.get("/health", async (_request, reply) => {
  return reply.send({ status: "ok" });
});

const start = async () => {
  const startPort = Number(process.env.PORT) || 4000;
  const portsToTry = [startPort, startPort + 1, startPort + 2, startPort + 3];

  for (const port of portsToTry) {
    try {
      await app.listen({ port, host: "0.0.0.0" });
      const apiUrl = `http://localhost:${port}`;
      app.log.info(`API running on ${apiUrl}`);

      if (!existsSync(PORTS_DIR)) {
        await mkdir(PORTS_DIR, { recursive: true });
      }
      await writeFile(PORTS_FILE, JSON.stringify({ apiPort: port, apiUrl }, null, 2), "utf-8");
      return;
    } catch (err: any) {
      if (err?.code === "EADDRINUSE" || err?.message?.includes("EADDRINUSE")) {
        app.log.warn(`Port ${port} in use, trying next port`);
        continue;
      }
      app.log.error(err);
      process.exit(1);
    }
  }

  app.log.error("No available ports found in range 4000-4003");
  process.exit(1);
};

start();
