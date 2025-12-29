"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buildApiUrl, buildPreviewUrl } from "@/lib/api";
import styles from "../page.module.css";

type Project = {
  projectId?: string;
  id?: string;
  name?: string;
  description?: string;
  createdAt?: string;
  previewUrl?: string;
  status?: string;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    setDeleteError(null);

    try {
      const response = await fetch(buildApiUrl("/api/projects"), {
        cache: "no-store",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data?.error || `GET /api/projects respondio ${response.status}`
        );
      }

      const data = await response.json();
      const list = Array.isArray(data) ? data : data.projects ?? data.items ?? [];
      setProjects(list);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los proyectos.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (project: Project) => {
    const projectId = project.projectId ?? project.id;
    if (!projectId) {
      setDeleteError("No se pudo determinar el ID del proyecto.");
      return;
    }

    const confirmed = window.confirm(
      "¿Seguro que quieres borrar este proyecto? Esta acción no se puede deshacer."
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingId(projectId);

    try {
      const response = await fetch(buildApiUrl(`/api/projects/${projectId}`), {
        method: "DELETE",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        throw new Error(
          data?.error || `DELETE /api/projects/${projectId} respondio ${response.status}`
        );
      }

      setProjects((prev) => prev.filter((item) => (item.projectId ?? item.id) !== projectId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo borrar el proyecto.";
      setDeleteError(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Projects</p>
            <h1 className={styles.title}>AI Studio Projects</h1>
          </div>
          <Link className={styles.link} href="/">
            Crear proyecto
          </Link>
        </header>

        {loading && <p className={styles.status}>Cargando proyectos...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {deleteError && <p className={styles.error}>{deleteError}</p>}

        {!loading && !error && (
          <ul className={styles.list}>
            {projects.length === 0 ? (
              <li className={styles.muted}>Aun no hay proyectos. Crea uno.</li>
            ) : (
              projects.map((project) => (
                <li
                  key={project.projectId ?? project.id ?? project.name}
                  className={styles.listItem}
                >
                  <div>
                    <p className={styles.itemTitle}>{project.name ?? "Proyecto sin nombre"}</p>
                    {project.description && <p className={styles.muted}>{project.description}</p>}
                    {(project.id || project.projectId) && (
                      <p className={styles.subtle}>ID: {project.projectId ?? project.id}</p>
                    )}
                    {project.createdAt && (
                      <p className={styles.subtle}>
                        Creado: {new Date(project.createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {project.status && <span className={styles.tag}>{project.status}</span>}
                    <a
                      className={styles.link}
                      href={buildPreviewUrl(project)}
                      target="_self"
                      rel="noreferrer"
                    >
                      Abrir
                    </a>
                    <button
                      className={styles.dangerButton}
                      onClick={() => handleDelete(project)}
                      disabled={deletingId === (project.projectId ?? project.id)}
                    >
                      {deletingId === (project.projectId ?? project.id) ? "Borrando..." : "Borrar"}
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </main>
  );
}
