const FALLBACK = "http://localhost:4000";

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const ensureTrailingSlash = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

export function getApiBaseUrl() {
  const envBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envBase && envBase.length > 0) {
    return stripTrailingSlash(envBase);
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000" || port === "") {
      return `${protocol}//${hostname}:4000`;
    }
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }

  return FALLBACK;
}

export function buildApiUrl(path: string) {
  const base = getApiBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

type ProjectLike = {
  previewUrl?: string;
  projectId?: string;
  id?: string;
};

function toAbsoluteUrl(candidate: string, apiBase: string) {
  if (candidate.startsWith("http")) return candidate;
  if (candidate.startsWith("/")) return `${apiBase}${candidate}`;
  return `${apiBase}/${candidate}`;
}

export function buildPreviewUrl(project: ProjectLike, apiBase?: string) {
  const base = stripTrailingSlash(apiBase || getApiBaseUrl());
  const preview = project.previewUrl;

  if (preview && preview.length > 0) {
    return ensureTrailingSlash(toAbsoluteUrl(preview, base));
  }

  const projectId = project.projectId || project.id || "";
  return ensureTrailingSlash(`${base}/preview/${projectId}`);
}
