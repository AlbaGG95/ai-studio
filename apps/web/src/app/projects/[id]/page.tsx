"use client";

import { useState, useRef, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";
import styles from "./page.module.css";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const PROMPT_STORAGE_KEY = "ai-studio-project-prompts";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      text: "Welcome to your game studio! I can help you create and modify your game.",
      sender: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    // load stored prompt for this project
    try {
      const stored = localStorage.getItem(PROMPT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[params.id]) {
          setPrompt(parsed[params.id]);
        }
      }
    } catch {
      // ignore storage errors
    }

    (async () => {
      try {
        const res = await fetch("/api/ports");
        if (res.ok) {
          const data = await res.json();
          setApiUrl(
            data?.apiUrl ||
              process.env.NEXT_PUBLIC_API_BASE_URL ||
              process.env.NEXT_PUBLIC_API_URL ||
              "http://localhost:4000"
          );
        } else {
          setApiUrl(getApiBaseUrl());
        }
      } catch (err) {
        setApiUrl(getApiBaseUrl());
      }
    })();
  }, [params.id]);

  const persistPrompt = (value: string) => {
    try {
      const stored = localStorage.getItem(PROMPT_STORAGE_KEY);
      const data = stored ? JSON.parse(stored) : {};
      data[params.id] = value;
      localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore persistence errors
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInput("");

    // Simulate assistant response
    setTimeout(() => {
      const responses = [
        "That sounds like a great idea! Would you like me to implement it?",
        "I can help with that. Let me update the game.",
        "Sure! I can add that feature to your game.",
      ];
      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: randomResponse,
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    }, 500);
  };

  const handleApplyDemoChange = async () => {
    setIsApplying(true);
    try {
      const base =
        apiUrl || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${base}/projects/${params.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              path: "demo.txt",
              content: `This is a demo change applied at ${new Date().toISOString()}`,
            },
          ],
        }),
      });

      if (!response.ok) throw new Error("Failed to apply changes");

      // Reload iframe
      if (previewRef.current) {
        previewRef.current.src = previewRef.current.src;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Demo change applied! The game preview has been updated.",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error("Error applying changes:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          text: "Error applying changes. Please try again.",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsApplying(false);
    }
  };

  const buildApiBase = () => apiUrl || getApiBaseUrl();

  const handleGenerate = async () => {
    const finalPrompt = prompt.trim();
    if (!finalPrompt) {
      setGenerateError("Necesitas un prompt en espanol para generar.");
      return;
    }
    setGenerateError("");
    setGenerating(true);
    persistPrompt(finalPrompt);

    try {
      const base = buildApiBase();
      const res = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          language: "es",
          templateId: "idle-rpg-base",
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.ok === false || data?.error) {
        throw new Error(
          data?.error ||
            data?.message ||
            `POST /api/generate respondio ${res.status}`
        );
      }
      if (!data.previewUrl && !data.staticPreviewUrl) {
        throw new Error("No se recibio previewUrl");
      }
      const previewUrl = data.previewUrl || data.staticPreviewUrl;
      const target = previewUrl.startsWith("http")
        ? previewUrl
        : `${base}${previewUrl}`;
      window.location.href = target;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo generar el juego";
      setGenerateError(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Left Panel: Chat */}
        <div className={styles.chatPanel}>
          <div className={styles.header}>
            <h1>AI Assistant</h1>
          </div>

          <div className={styles.generatorBox}>
            <label className={styles.label}>Describe tu juego (ES)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: un idle RPG medieval con heroes tanque y mago..."
              rows={3}
            />
            <button
              className={styles.generateButton}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Generando..." : "Generar juego"}
            </button>
            {generateError && (
              <div className={styles.errorBox}>{generateError}</div>
            )}
          </div>

          <div className={styles.messagesContainer}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`${styles.message} ${styles[msg.sender]}`}
              >
                <div className={styles.messageContent}>{msg.text}</div>
                <div className={styles.timestamp}>
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className={styles.inputForm}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me to modify your game..."
              rows={3}
            />
            <button type="submit" disabled={!input.trim()}>
              Send
            </button>
          </form>

          <button
            className={styles.demoButton}
            onClick={handleApplyDemoChange}
            disabled={isApplying}
          >
            {isApplying ? "Applying..." : "Apply Demo Change"}
          </button>
        </div>

        {/* Right Panel: Preview */}
        <div className={styles.previewPanel}>
          <div className={styles.header}>
            <h1>Game Preview</h1>
          </div>
          <iframe
            ref={previewRef}
            src={`${buildApiBase()}/preview/${params.id}/`}
            className={styles.preview}
            title="Game Preview"
            onError={() =>
              setPreviewError(
                "No se pudo cargar el preview. Genera un juego o revisa la conexion."
              )
            }
          />
          {previewError && (
            <div className={styles.errorBox}>{previewError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
