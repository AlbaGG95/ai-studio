import path from "path";
import type { FeatureManifest } from "@ai-studio/core";

export interface WriteOperation {
  moduleId: string;
  path: string;
}

export interface IntegrationFile {
  moduleId: string;
  path: string;
  content: string;
}

export interface IntegrationResult {
  ok: boolean;
  errors: string[];
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function isSafeRelativePath(value: string) {
  if (!value || value.includes("..")) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  return true;
}

function baseDir(entryPath: string) {
  const normalized = normalizePath(entryPath);
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "" : dir;
}

export function validateWriteOperations(
  manifests: FeatureManifest[],
  operations: WriteOperation[]
): string[] {
  const errors: string[] = [];
  const manifestById = new Map(
    manifests.map((manifest) => [manifest.module.id, manifest])
  );

  for (const operation of operations) {
    const manifest = manifestById.get(operation.moduleId);
    if (!manifest) {
      errors.push(`Write sin manifest: ${operation.moduleId}`);
      continue;
    }
    const normalizedPath = normalizePath(operation.path);
    if (!isSafeRelativePath(normalizedPath)) {
      errors.push(`Path invalido: ${operation.path}`);
      continue;
    }

    const root = baseDir(manifest.module.entry);
    if (root && !normalizedPath.startsWith(`${root}/`)) {
      errors.push(
        `Path fuera del modulo ${manifest.module.id}: ${normalizedPath}`
      );
      continue;
    }

    const allowedPaths = new Set<string>();
    for (const file of manifest.files) {
      allowedPaths.add(normalizePath(file.path));
    }
    for (const asset of manifest.assets || []) {
      allowedPaths.add(normalizePath(asset.path));
    }

    if (!allowedPaths.has(normalizedPath)) {
      errors.push(
        `Path no declarado en manifest ${manifest.module.id}: ${normalizedPath}`
      );
    }
  }

  return errors;
}

export async function applyIntegration(
  manifests: FeatureManifest[],
  files: IntegrationFile[],
  targetDir: string
): Promise<IntegrationResult> {
  const missingModuleErrors = files
    .filter((file) => !file.moduleId)
    .map((file) => `Write sin moduleId: ${file.path}`);
  const writeErrors = [
    ...missingModuleErrors,
    ...validateWriteOperations(
      manifests,
      files.map((file) => ({
        moduleId: file.moduleId,
        path: file.path,
      }))
    ),
  ];

  if (writeErrors.length > 0) {
    return { ok: false, errors: writeErrors };
  }

  const sorted = [...files].sort((a, b) => {
    const keyA = `${a.moduleId}:${normalizePath(a.path)}`;
    const keyB = `${b.moduleId}:${normalizePath(b.path)}`;
    return keyA.localeCompare(keyB);
  });

  await import("fs/promises").then(async ({ mkdir, writeFile }) => {
    await mkdir(targetDir, { recursive: true });
    for (const file of sorted) {
      const normalized = normalizePath(file.path);
      const target = path.resolve(targetDir, normalized);
      if (!target.startsWith(`${targetDir}${path.sep}`) && target !== targetDir) {
        throw new Error(`write fuera del target: ${file.path}`);
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, "utf-8");
    }
  });

  return { ok: true, errors: [] };
}
