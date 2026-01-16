import { exportBuild } from "./exporter.js";

const buildId = process.argv[2];
if (!buildId) {
  process.stderr.write("Usage: pnpm export-build <buildId>\n");
  process.exitCode = 2;
} else {
  try {
    const result = await exportBuild(buildId);
    process.stdout.write(`buildId: ${result.buildId}\n`);
    process.stdout.write(`status: ${result.status}\n`);
    process.stdout.write(`export: ${result.zipPath}\n`);
    process.stdout.write(`checksum: ${result.checksum}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}
