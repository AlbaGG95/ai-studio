"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "../page.module.css";
import { interpretToSpec } from "../../../../../lib/specInterpreter";
import { selectTemplate } from "../../../../../lib/templates/registry";
import { buildApiUrl, getApiBaseUrl } from "@/lib/api";

type Recent = { id: string; title: string; templateId: string; route: string };

export default function PlaygroundPage() {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specJson, setSpecJson] = useState<string>("");
  const [generatedRoute, setGeneratedRoute] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

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
      const route = data.route || `/play?projectId=${data.projectId}`;
      setGeneratedRoute(route.startsWith("http") ? route : `${getApiBaseUrl()}${route}`);
      pushRecent({ id: data.projectId, title: data.spec?.title || trimmedTitle, templateId: data.templateId, route });
      setStatus("Ready. Click Play.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
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
                <Link className={styles.link} href={r.route.startsWith("http") ? r.route : `${getApiBaseUrl()}${r.route}`}>
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
