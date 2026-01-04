#!/usr/bin/env node

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "http://localhost:4000";

async function verify(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    // ignore parse errors; handled below
  }
  if (!res.ok) {
    throw new Error(`${path} responded ${res.status}: ${text || "empty body"}`);
  }
  if (!(data?.ok === true || data?.status === "ok")) {
    throw new Error(`${path} payload missing ok/status flag`);
  }
  return data;
}

async function main() {
  await verify("/health");
  await verify("/api/health");
  console.log(`Health endpoints OK at ${baseUrl}`);
}

main().catch((err) => {
  console.error("Health check failed:", err.message);
  process.exit(1);
});
