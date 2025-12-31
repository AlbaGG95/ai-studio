"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";
import { interpretToSpec } from "../../../../../lib/specInterpreter";
import { selectTemplate } from "../../../../../lib/templates/registry";
import { buildApiUrl } from "@/lib/api";

type Recent = { id: string; title: string; templateId: string; route: string };

export default function PlaygroundPage() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specJson, setSpecJson] = useState<string>("");
  const [generatedRoute, setGeneratedRoute] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);
  const isDev = process.env.NODE_ENV !== "production";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("playground-recent");
    if (stored) {
      try {
        setRecent(JSON.parse(stored));
      } catch {
        setRecent([]);
      }
    }
  }, []);

  useEffect(() => {
    const spec = interpretToSpec(title || "Untitled", prompt || "");
    setSpecJson(JSON.stringify(spec, null, 2));
  }, [title, prompt]);

  const trimmedTitle = useMemo(() => title.trim(), [title]);
  const trimmedPrompt = useMemo(() => prompt.trim(), [prompt]);

  const handleGenerate = async () => {
    setStatus("Generating...");
    setError(null);
    setGeneratedRoute(null);
    try {
      const response = await fetch(buildApiUrl("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle || "Untitled", prompt: trimmedPrompt }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        throw new Error(data?.error || `Request failed ${response.status}`);
      }
      const playRoute = data.projectId ? `/play?projectId=${encodeURIComponent(data.projectId)}` : data.route;
      const normalized = playRoute?.startsWith("http") ? playRoute : playRoute;
      setGeneratedRoute(normalized);
      pushRecent({ id: data.projectId, title: data.spec?.title || trimmedTitle, templateId: data.templateId, route: playRoute });
      setStatus("Ready. Click Play.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
      setStatus(null);
    }
  };

  const resetStorage = () => {
    if (typeof window === "undefined") return;
    Object.keys(window.localStorage || {}).forEach((key) => {
      if (key.startsWith("ai-studio") || key.startsWith("projects") || key.startsWith("project") || key.startsWith("state")) {
        window.localStorage.removeItem(key);
      }
    });
  };

  const resetAndReload = async () => {
    try {
      await fetch("/api/dev/reset", { method: "POST" });
    } catch {
      // ignore
    }
    resetStorage();
    if (typeof window !== "undefined") window.location.reload();
  };

  const runTriviaE2E = async () => {
    if (!isDev) return;
    setStatus("Resetting (DEV)...");
    setError(null);
    await fetch("/api/dev/reset", { method: "POST" }).catch(() => {});
    resetStorage();
    setTitle("Trivia Anime");
    setPrompt("Juego de preguntas tipo quiz con categorías, tono casual.");
    setStatus("Generating Trivia (DEV)...");
    try {
      const response = await fetch(buildApiUrl("/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Trivia Anime", prompt: "Juego de preguntas tipo quiz con categorías, tono casual." }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error || !data?.projectId) {
        throw new Error(data?.error || `Request failed ${response.status}`);
      }
      setStatus("Opening /play (debug)...");
      if (typeof window !== "undefined") {
        window.location.href = `/play?projectId=${encodeURIComponent(data.projectId)}&debug=1`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run Trivia E2E");
      setStatus(null);
    }
  };

  const pushRecent = (entry: Recent) => {
    setRecent((prev) => {
      const next = [entry, ...prev.filter((r) => r.id !== entry.id)].slice(0, 5);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("playground-recent", JSON.stringify(next));
      }
      return next;
    });
  };

  const templatePreview = useMemo(() => {
    const spec = interpretToSpec(trimmedTitle || "Untitled", trimmedPrompt || "");
    const template = selectTemplate(spec);
    return template.id;
  }, [trimmedPrompt, trimmedTitle]);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Playground</p>
            <h1 className={styles.title}>Generate & Play</h1>
          </div>
          <Link className={styles.link} href="/">
            Home
          </Link>
        </header>

        <div className={styles.field}>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Neon Runner"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            name="prompt"
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe el juego, mecánicas, tono..."
          />
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={handleGenerate}>
            Generate
          </button>
          {generatedRoute && (
            <Link className={styles.link} href={generatedRoute}>
              Play
            </Link>
          )}
          {isDev && (
            <>
              <button type="button" onClick={resetAndReload}>
                Reset (DEV)
              </button>
              <button type="button" onClick={runTriviaE2E}>
                Run E2E: Trivia (DEV)
              </button>
            </>
          )}
        </div>

        <p className={styles.subtle}>Template preview: {templatePreview}</p>
        {status && <p className={styles.status}>{status}</p>}
        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.card} style={{ marginTop: 12 }}>
          <p className={styles.kicker}>Spec Preview</p>
          <pre style={{ maxHeight: 240, overflow: "auto" }}>{specJson}</pre>
        </div>

        <div className={styles.card} style={{ marginTop: 12 }}>
          <p className={styles.kicker}>Recent</p>
          {recent.length === 0 && <p className={styles.muted}>No recent projects.</p>}
          <div className={styles.heroGrid}>
            {recent.map((r) => (
              <div key={r.id} className={styles.heroCard}>
                <p className={styles.itemTitle}>{r.title}</p>
                <p className={styles.subtle}>Template: {r.templateId}</p>
                <Link className={styles.link} href={r.route.startsWith("http") ? r.route : r.route}>
                  Play
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
