export function getApiBaseUrl() {
  // Keep relative in dev; return empty string to use same-origin.
  return "";
}

export function buildApiUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return normalized;
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
