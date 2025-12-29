import { readdir, copyFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

export const getTemplateDir = (templateName: string): string => {
  return join(__dirname, "templates", templateName);
};

export const getAvailableTemplates = async (): Promise<string[]> => {
  const templatesDir = join(__dirname, "templates");
  const entries = await readdir(templatesDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
};
