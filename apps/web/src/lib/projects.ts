import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, rm, writeFile, stat } from "fs/promises";
import path from "path";
import { interpretToSpec } from "../../../../lib/specInterpreter";
import { GameSpec, validateGameSpec } from "../../../../lib/gameSpec";
import {
  GeneratedGame,
  GameTemplate,
  getTemplates,
  normalizeTriviaQuestions,
  selectTemplate,
  TemplateId,
} from "../../../../lib/templates/registry";

export type ProjectRecord = {
  schemaVersion: number;
  id: string;
  title: string;
  createdAt: string;
  spec: GameSpec;
  templateId: TemplateId;
  route: string;
  config: any;
};

const PRIMARY_DIR = path.resolve(process.cwd(), "../../..", "data", "projects");
const FALLBACK_DIR = path.resolve(process.cwd(), ".data", "projects");
const PROJECT_DIRS = [PRIMARY_DIR, FALLBACK_DIR];

const PROJECT_EXT = ".json";

export async function ensureProjectDirs() {
  for (const dir of PROJECT_DIRS) {
    await mkdir(dir, { recursive: true }).catch(() => {});
  }
}

export function buildProjectRecord(spec: GameSpec, template: GameTemplate, generated: GeneratedGame, id?: string): ProjectRecord {
  const projectId = id || `proj-${randomUUID()}`;
  return {
    schemaVersion: 1,
    id: projectId,
    title: spec.title,
    createdAt: new Date().toISOString(),
    spec,
    templateId: template.id,
    route: `/play?projectId=${encodeURIComponent(projectId)}`,
    config: generated?.config ?? {},
  };
}

export async function persistProject(record: ProjectRecord) {
  await ensureProjectDirs();
  const payload = JSON.stringify(record, null, 2);
  try {
    await writeFile(path.join(PRIMARY_DIR, `${record.id}${PROJECT_EXT}`), payload, "utf-8");
  } catch {
    await writeFile(path.join(FALLBACK_DIR, `${record.id}${PROJECT_EXT}`), payload, "utf-8");
  }
}

export async function listProjects(): Promise<ProjectRecord[]> {
  await ensureProjectDirs();
  const seen = new Map<string, ProjectRecord>();

  for (const dir of PROJECT_DIRS) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(PROJECT_EXT)) {
        const filePath = path.join(dir, entry.name);
        const raw = await readFileSafe(filePath);
        if (!raw) continue;
        const idFromName = entry.name.replace(PROJECT_EXT, "");
        const { record, changed } = migrateProject(raw, idFromName);
        if (!record) continue;
        if (changed) await persistProject(record);
        if (!seen.has(record.id)) seen.set(record.id, record);
      } else if (entry.isDirectory()) {
        const legacy = await readLegacyProject(path.join(dir, entry.name));
        if (!legacy) continue;
        const { record, changed } = migrateProject(legacy, entry.name);
        if (!record) continue;
        if (changed) await persistProject(record);
        if (!seen.has(record.id)) seen.set(record.id, record);
      }
    }
  }

  return Array.from(seen.values());
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  await ensureProjectDirs();
  for (const dir of PROJECT_DIRS) {
    const filePath = path.join(dir, `${id}${PROJECT_EXT}`);
    const exists = await stat(filePath).then(() => true).catch(() => false);
    if (!exists) continue;
    const raw = await readFileSafe(filePath);
    if (!raw) continue;
    const { record, changed } = migrateProject(raw, id);
    if (record && changed) await persistProject(record);
    if (record) return record;
  }
  for (const dir of PROJECT_DIRS) {
    const legacyDir = path.join(dir, id);
    const legacy = await readLegacyProject(legacyDir);
    if (!legacy) continue;
    const { record, changed } = migrateProject(legacy, id);
    if (record && changed) await persistProject(record);
    if (record) return record;
  }
  return null;
}

export async function deleteProject(id: string) {
  for (const dir of PROJECT_DIRS) {
    const filePath = path.join(dir, `${id}${PROJECT_EXT}`);
    await rm(filePath, { force: true }).catch(() => {});
    await rm(path.join(dir, id), { force: true, recursive: true }).catch(() => {});
  }
}

export async function resetAllProjects() {
  for (const dir of PROJECT_DIRS) {
    await rm(dir, { force: true, recursive: true }).catch(() => {});
  }
  await ensureProjectDirs();
}

function readProjectSpec(raw: any, titleFallback: string): GameSpec {
  const candidate = raw?.spec;
  if (candidate) {
    const validation = validateGameSpec(candidate);
    if (validation.ok) return candidate;
  }
  return interpretToSpec(titleFallback || "Untitled", raw?.prompt || "");
}

function safeTemplateBuild(template: GameTemplate, spec: GameSpec): GeneratedGame {
  try {
    return template.build(spec);
  } catch (err) {
    console.warn("Template build failed, using placeholder", err);
    const placeholder = getTemplates().find((t) => t.id === TemplateId.placeholder_basic) || template;
    return placeholder.build(spec);
  }
}

export function migrateProject(raw: any, filenameId?: string): { record: ProjectRecord | null; changed: boolean } {
  if (!raw || typeof raw !== "object") return { record: null, changed: false };
  const changedFields = new Set<string>();
  const id = raw.id || raw.projectId || filenameId || `proj-${randomUUID()}`;
  if (!raw.id) changedFields.add("id");
  const title = raw.title || raw.name || raw.projectName || raw.spec?.title || id;
  const baseSpec = readProjectSpec(raw, title);
  const spec: GameSpec = {
    ...baseSpec,
    title: baseSpec.title || title,
  };
  if (spec.title !== baseSpec.title) changedFields.add("spec.title");
  const template = raw.templateId
    ? getTemplates().find((t) => t.id === raw.templateId) || selectTemplate(spec)
    : selectTemplate(spec);
  const generated = raw.generated || safeTemplateBuild(template, spec);
  const route = `/play?projectId=${encodeURIComponent(id)}`;
  const templateId = (raw.templateId as TemplateId) || template.id;
  let config: any = raw.config ?? generated?.config ?? {};
  if (!config || typeof config !== "object") config = {};
  if (templateId === TemplateId.trivia_basic) {
    const rawQuestions =
      config?.questions ??
      config?.content?.entities ??
      raw?.config?.content?.entities ??
      spec?.content?.entities ??
      [];
    const normalizedQuestions = normalizeTriviaQuestions(rawQuestions, spec.title);
    if (normalizedQuestions.length > 0) {
      const previousQuestions = JSON.stringify(config?.questions || []);
      const nextQuestions = JSON.stringify(normalizedQuestions);
      if (previousQuestions !== nextQuestions) changedFields.add("config.questions");
      const nextContent = { ...(config.content || {}), entities: normalizedQuestions };
      config = { ...config, questions: normalizedQuestions, content: nextContent };
      spec.content = { ...(spec.content || { entities: [] }), entities: normalizedQuestions };
    }
  }
  const schemaVersion = raw.schemaVersion ?? 1;
  if (!raw.schemaVersion) changedFields.add("schemaVersion");
  if (!raw.route || raw.route !== route) changedFields.add("route");
  if (!raw.config) changedFields.add("config");
  if (!raw.templateId) changedFields.add("templateId");
  if (!raw.title || raw.title !== title) changedFields.add("title");

  const record: ProjectRecord = {
    schemaVersion,
    id,
    title,
    createdAt: raw.createdAt || new Date().toISOString(),
    spec,
    templateId,
    route,
    config,
  };

  return { record, changed: changedFields.size > 0 };
}

async function readFileSafe(filePath: string) {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readLegacyProject(dirPath: string) {
  const meta = await readFileSafe(path.join(dirPath, "meta.json"));
  const spec = await readFileSafe(path.join(dirPath, "spec.json"));
  if (!meta && !spec) return null;
  const projectId = meta?.projectId || meta?.id || path.basename(dirPath);
  return {
    ...meta,
    id: projectId,
    projectId,
    title: meta?.name || meta?.title,
    spec: spec || meta?.spec,
  };
}
