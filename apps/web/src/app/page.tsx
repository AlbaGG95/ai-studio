"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { buildApiUrl, getApiBaseUrl } from "@/lib/api";
import styles from "./page.module.css";

type GenerationResponse = {
  id?: string;
  projectId?: string;
  message?: string;
  error?: string;
  ok?: boolean;
  previewUrl?: string;
  staticPreviewUrl?: string;
  createdAt?: string;
  project?: { id?: string };
};

export default function HomePage() {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const [lastProjectName, setLastProjectName] = useState<string | null>(null);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedPrompt = useMemo(() => prompt.trim(), [prompt]);

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
          name: trimmedName,
          description: trimmedPrompt || undefined,
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
    const payload = {
      prompt: trimmedPrompt || trimmedName || "Idle RPG offline",
      language: "es",
      templateId: "idle-rpg-base",
      projectName: trimmedName || undefined,
      description: trimmedPrompt || trimmedName || "Idle RPG offline",
    };

    setGenerating(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(buildApiUrl("/api/generate/game"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data: GenerationResponse = await response
        .json()
        .catch(() => ({} as GenerationResponse));

      if (!response.ok || data?.ok === false) {
        throw new Error(
          data?.error ||
            data?.message ||
            `POST /api/generate respondio ${response.status}`
        );
      }

      const projectIdFromResponse =
        data.projectId ?? data.id ?? data.project?.id ?? lastProjectId ?? trimmedName;
      setLastProjectId(projectIdFromResponse || null);
      setStatus("Juego generado.");

      const previewUrl =
        data.previewUrl ||
        data.staticPreviewUrl ||
        (projectIdFromResponse ? `/preview/${projectIdFromResponse}/` : null);

      if (previewUrl) {
        const target = previewUrl.startsWith("http")
          ? previewUrl
          : `${getApiBaseUrl()}${previewUrl}`;
        window.location.href = target;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo iniciar la generacion.";
      setError(message);
    } finally {
      setGenerating(false);
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
          <Link className={styles.link} href="/projects">
            Ver proyectos
          </Link>
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
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </main>
  );
}
