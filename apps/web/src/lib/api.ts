const FALLBACK = "http://localhost:4000";

export function getApiBaseUrl() {
  const envBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envBase && envBase.length > 0) {
    return envBase.replace(/\/$/, "");
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
