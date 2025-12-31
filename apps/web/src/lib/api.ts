const FALLBACK = "http://localhost:4001";
const FALLBACK_PORT = (() => {
  try {
    const url = new URL(FALLBACK);
    return url.port || "4001";
  } catch {
    return "4001";
  }
})();

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function getApiBaseUrl() {
  const envBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envBase && envBase.length > 0) {
    return stripTrailingSlash(envBase);
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000" || port === "") {
      return `${protocol}//${hostname}:${FALLBACK_PORT}`;
    }
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  return FALLBACK;
}

export function buildApiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const envBase = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  const localPreferred =
    normalized.startsWith("/api/projects") || normalized.startsWith("/api/generate");
  if (!envBase && localPreferred) {
    return normalized;
  }
  const base = envBase ? stripTrailingSlash(envBase) : getApiBaseUrl();
  return `${base}${normalized}`;
}

type ProjectLike = {
  previewUrl?: string;
  projectId?: string;
  id?: string;
};

export function buildPreviewUrl(project: ProjectLike) {
  const projectId = project.projectId || project.id || "";
  return projectId ? `/play?projectId=${encodeURIComponent(projectId)}` : "/";
}
