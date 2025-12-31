"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { buildApiUrl } from "@/lib/api";
import styles from "./page.module.css";

type GenerationResponse = {
  id?: string;
  projectId?: string;
  route?: string;
  templateId?: string;
  message?: string;
  error?: string;
  ok?: boolean;
  previewUrl?: string;
  staticPreviewUrl?: string;
  createdAt?: string;
  project?: { id?: string };
};

type ProjectListItem = {
  id: string;
  title?: string;
  templateId?: string;
  spec?: { type?: string };
  route?: string;
};

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [lastProjectName, setLastProjectName] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [apiOk, setApiOk] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedPrompt = useMemo(() => prompt.trim(), [prompt]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json().catch(() => ({}));
        if (!data?.ok) throw new Error("Healthcheck not ok");
        setApiOk(true);
        setApiError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "API no disponible";
        setApiOk(false);
        setApiError(message);
      }
    };
    checkHealth();
  }, []);

  const handleCreate = async () => {
    if (!trimmedName) {
      setError("Escribe un nombre para el proyecto.");
      return;
    }

    setCreating(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(buildApiUrl("/api/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedName || "Untitled",
          prompt: trimmedPrompt || trimmedName || "Idle RPG offline",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.error || `POST /api/generate respondio ${response.status}`
        );
      }

      const data = await response.json();
      const projectId = data.id ?? data.projectId ?? data.project?.id ?? null;
      setLastProjectId(projectId ?? trimmedName);
      setLastProjectName(trimmedName);
      setStatus(projectId ? `Proyecto creado (id: ${projectId})` : "Proyecto creado");
    } catch (err) {
      setLastProjectId(trimmedName);
      setLastProjectName(trimmedName);
      setStatus("Proyecto guardado en memoria.");
      const message = err instanceof Error ? err.message : "No se pudo crear el proyecto en el servidor.";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!trimmedName && !trimmedPrompt) {
      setError("Escribe un nombre o prompt para generar.");
      return;
    }
    setGenerating(true);
    setError(null);
    setStatus("Interpretando...");
    const timers: NodeJS.Timeout[] = [];
    const step = (next: string, delay: number) => {
      const t = setTimeout(() => setStatus((prev) => (generating && !error ? next : prev)), delay);
      timers.push(t);
    };
    step("Validando...", 400);
    step("Generando...", 900);

    try {
      const response = await fetch(buildApiUrl("/api/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedName || "Untitled",
          prompt: trimmedPrompt || trimmedName || "Idle RPG offline",
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const message =
          errData?.error ||
          errData?.message ||
          `POST /api/generate respondio ${response.status}`;
        throw new Error(message);
      }

      const data: GenerationResponse = await response
        .json()
        .catch(() => ({} as GenerationResponse));

      const projectIdFromResponse = data.projectId ?? data.id ?? data.project?.id;
      if (!projectIdFromResponse) {
        throw new Error("Generation failed: no projectId");
      }
      console.log("[GENERATE OK]", data);
      setLastProjectId(projectIdFromResponse);
      setStatus("Listo");
      await fetchProjects();
      router.push(`/play?projectId=${encodeURIComponent(projectIdFromResponse)}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la generacion.";
      setError(message);
      setStatus(null);
    } finally {
      timers.forEach((t) => clearTimeout(t));
      setGenerating(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/projects"), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.projects)) {
        setProjects(data.projects as ProjectListItem[]);
      }
    } catch {
      // ignore
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Home</p>
            <h1 className={styles.title}>AI Studio</h1>
          </div>
          <div className={styles.actions}>
            <Link className={styles.link} href="/projects">
              Ir a proyectos
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowProjects((p) => !p);
                if (!projects.length) fetchProjects();
              }}
            >
              Ver proyectos
            </button>
          </div>
        </header>

        <div className={styles.field}>
          <label htmlFor="name">Nombre del proyecto</label>
          <input
            id="name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Idle RPG"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="prompt">Describe tu juego (ES)</label>
          <textarea
            id="prompt"
            name="prompt"
            rows={4}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe mecanicas, tono y ambientacion en espanol."
          />
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? "Creando..." : "Nuevo proyecto"}
          </button>
          <button type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generando..." : "Generar juego"}
          </button>
        </div>

        {status && <p className={styles.status}>{status}</p>}
        {lastProjectName && (
          <p className={styles.subtle}>
            Ultimo proyecto: {lastProjectName}
            {lastProjectId ? ` (${lastProjectId})` : ""}
          </p>
        )}
        {!apiOk && (
          <p className={styles.error}>
            API no disponible en este puerto. {process.env.NODE_ENV !== "production" ? `Detalle: ${apiError ?? "network error"}` : ""}
          </p>
        )}
        {error && <p className={styles.error}>{error}</p>}

        {showProjects && (
          <div className={styles.card} style={{ marginTop: 12 }}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.kicker}>Proyectos</p>
                <h3 className={styles.title}>Generados</h3>
              </div>
              <button type="button" onClick={fetchProjects}>
                Refrescar
              </button>
            </div>
            {projects.length === 0 && <p className={styles.muted}>Sin proyectos aún.</p>}
            <div className={styles.heroGrid}>
              {projects.map((project) => {
                const projectId = project.id;
                const templateId = project.templateId ?? project.spec?.type ?? "?";
                const playHref = projectId ? `/play?projectId=${encodeURIComponent(projectId)}` : null;
                return (
                <div key={project.id} className={styles.heroCard}>
                  <p className={styles.itemTitle}>{project.title || project.id}</p>
                  <p className={styles.subtle}>Tipo: {project.spec?.type ?? "?"}</p>
                  <p className={styles.subtle}>Template: {templateId}</p>
                  <div className={styles.actions}>
                    {playHref ? (
                      <Link className={styles.link} href={playHref}>
                        Jugar
                      </Link>
                    ) : (
                      <button className={styles.link} disabled>
                        Jugar
                      </button>
                    )}
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
