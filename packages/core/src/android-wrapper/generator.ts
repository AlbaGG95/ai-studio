import { createHash } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import {
  validateAndroidWrapperSpecStrict,
  type AndroidWrapperSpec,
} from "../contracts/android-wrapper/v1/index.js";
import { readZipEntries } from "./zip.js";

export interface AndroidWrapperResult {
  ok: boolean;
  projectDir: string;
  reportPath: string;
  checksumPath: string;
  errors: string[];
}

interface GeneratedFile {
  path: string;
  sha256: string;
}

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizePath(value: string): string {
  return toPosix(value).replace(/^\.\/+/, "");
}

function isSafeRelativePath(value: string): boolean {
  if (!value) return false;
  if (value.includes("..")) return false;
  if (value.startsWith("/") || value.startsWith("\\")) return false;
  if (value.includes(":")) return false;
  return true;
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function hashFile(filePath: string): Promise<string> {
  const data = await readFile(filePath);
  return hashBuffer(data);
}

async function listFiles(rootDir: string): Promise<string[]> {
  const entries: string[] = [];
  async function walk(current: string) {
    const items = await import("fs/promises").then(({ readdir }) =>
      readdir(current, { withFileTypes: true })
    );
    const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of sorted) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        await walk(full);
      } else if (item.isFile()) {
        entries.push(toPosix(path.relative(rootDir, full)));
      }
    }
  }
  await walk(rootDir);
  return entries.sort();
}

async function writeTextFile(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

function slugFromAppId(appId: string): string {
  return appId.replace(/\./g, "-").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
}

function buildManifestXml(spec: AndroidWrapperSpec): string {
  const cleartext = spec.cleartextTraffic ? "true" : "false";
  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<manifest xmlns:android="http://schemas.android.com/apk/res/android"`,
    `    package="${spec.appId}">`,
    `    <application`,
    `        android:label="@string/app_name"`,
    `        android:usesCleartextTraffic="${cleartext}">`,
    `        <activity`,
    `            android:name=".MainActivity"`,
    `            android:exported="true"`,
    `            android:screenOrientation="${spec.orientation}">`,
    `            <intent-filter>`,
    `                <action android:name="android.intent.action.MAIN" />`,
    `                <category android:name="android.intent.category.LAUNCHER" />`,
    `            </intent-filter>`,
    `        </activity>`,
    `    </application>`,
    `</manifest>`,
  ].join("\n");
}

function buildMainActivity(spec: AndroidWrapperSpec): string {
  const debugLine = spec.webviewDebug
    ? "    WebView.setWebContentsDebuggingEnabled(true)"
    : "";
  return [
    `package ${spec.appId}`,
    ``,
    `import android.app.Activity`,
    `import android.os.Bundle`,
    `import android.webkit.WebResourceRequest`,
    `import android.webkit.WebView`,
    `import android.webkit.WebViewClient`,
    ``,
    `class MainActivity : Activity() {`,
    `    override fun onCreate(savedInstanceState: Bundle?) {`,
    `        super.onCreate(savedInstanceState)`,
    debugLine,
    `        val webView = WebView(this)`,
    `        webView.settings.javaScriptEnabled = true`,
    `        webView.webViewClient = object : WebViewClient() {`,
    `            override fun shouldOverrideUrlLoading(`,
    `                view: WebView?,`,
    `                request: WebResourceRequest?`,
    `            ): Boolean {`,
    `                val url = request?.url?.toString() ?: return true`,
    `                return !url.startsWith("file:///android_asset/")`,
    `            }`,
    `        }`,
    `        webView.loadUrl("file:///android_asset/www/index.html")`,
    `        setContentView(webView)`,
    `    }`,
    `}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildGradleProperties(): string {
  return [
    "org.gradle.jvmargs=-Xmx1g",
    "android.useAndroidX=true",
    "kotlin.code.style=official",
  ].join("\n");
}

function buildSettingsGradle(appName: string): string {
  return [
    "pluginManagement {",
    "    repositories {",
    "        google()",
    "        mavenCentral()",
    "    }",
    "}",
    "dependencyResolutionManagement {",
    "    repositories {",
    "        google()",
    "        mavenCentral()",
    "    }",
    "}",
    `rootProject.name = "${appName}"`,
    "include(\":app\")",
  ].join("\n");
}

function buildRootGradle(): string {
  return [
    "plugins {",
    "    id 'com.android.application' version '8.2.2' apply false",
    "    id 'org.jetbrains.kotlin.android' version '1.9.22' apply false",
    "}",
  ].join("\n");
}

function buildAppGradle(spec: AndroidWrapperSpec): string {
  return [
    "plugins {",
    "    id 'com.android.application'",
    "    id 'org.jetbrains.kotlin.android'",
    "}",
    "",
    "android {",
    `    namespace "${spec.appId}"`,
    `    compileSdk ${spec.targetSdk}`,
    "",
    "    defaultConfig {",
    `        applicationId "${spec.appId}"`,
    `        minSdk ${spec.minSdk}`,
    `        targetSdk ${spec.targetSdk}`,
    `        versionCode ${spec.versionCode}`,
    `        versionName "${spec.versionName}"`,
    "    }",
    "",
    "    buildTypes {",
    "        release {",
    "            minifyEnabled false",
    "        }",
    "    }",
    "",
    "    compileOptions {",
    "        sourceCompatibility JavaVersion.VERSION_11",
    "        targetCompatibility JavaVersion.VERSION_11",
    "    }",
    "    kotlinOptions {",
    "        jvmTarget = '11'",
    "    }",
    "}",
    "",
    "dependencies {",
    "    implementation 'androidx.core:core-ktx:1.12.0'",
    "}",
  ].join("\n");
}

function buildStringsXml(appName: string): string {
  return [
    `<?xml version="1.0" encoding="utf-8"?>`,
    `<resources>`,
    `    <string name="app_name">${appName}</string>`,
    `</resources>`,
  ].join("\n");
}

function buildGradleWrapperProperties(): string {
  return [
    "distributionBase=GRADLE_USER_HOME",
    "distributionPath=wrapper/dists",
    "distributionUrl=https\\://services.gradle.org/distributions/gradle-8.7-bin.zip",
    "zipStoreBase=GRADLE_USER_HOME",
    "zipStorePath=wrapper/dists",
  ].join("\n");
}

function buildGradlew(): string {
  return [
    "#!/usr/bin/env sh",
    "DIR=$(CDPATH= cd -- \"$(dirname -- \"$0\")\" && pwd)",
    "JAR=\"$DIR/gradle/wrapper/gradle-wrapper.jar\"",
    "if [ ! -f \"$JAR\" ]; then",
    "  echo \"gradle-wrapper.jar missing. Please add the Gradle wrapper jar.\"",
    "  exit 1",
    "fi",
    "exec java -jar \"$JAR\" \"$@\"",
  ].join("\n");
}

function buildGradlewBat(): string {
  return [
    "@echo off",
    "set DIR=%~dp0",
    "set JAR=%DIR%gradle\\wrapper\\gradle-wrapper.jar",
    "if not exist %JAR% (",
    "  echo gradle-wrapper.jar missing. Please add the Gradle wrapper jar.",
    "  exit /b 1",
    ")",
    "java -jar %JAR% %*",
  ].join("\r\n");
}

async function writeChecksums(
  rootDir: string,
  files: GeneratedFile[]
): Promise<void> {
  const lines = files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.sha256}  ${file.path}`);
  const content = lines.join("\n");
  await writeTextFile(path.join(rootDir, "checksums.sha256"), content);
}

export async function generateAndroidWrapperProject(params: {
  exportZipPath: string;
  spec: AndroidWrapperSpec;
  outDir: string;
}): Promise<AndroidWrapperResult> {
  const spec = validateAndroidWrapperSpecStrict(params.spec);
  const exportZipSha256 = hashBuffer(await readFile(params.exportZipPath));
  const exportZipRelative = toPosix(
    path.relative(process.cwd(), params.exportZipPath)
  );

  const projectSlug = slugFromAppId(spec.appId);
  const projectDir = path.resolve(params.outDir, "android", projectSlug);
  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });

  const reportPath = path.join(projectDir, "android-wrapper-report.json");
  const checksumPath = path.join(projectDir, "checksums.sha256");
  const errors: string[] = [];

  const entries = await readZipEntries(params.exportZipPath);
  const normalizedEntries = entries.map((entry) => normalizePath(entry.name));
  const hasIndex = normalizedEntries.includes("index.html");
  if (!hasIndex) {
    errors.push("index.html missing in export zip");
    const report = {
      ok: false,
      outputDir: toPosix(path.relative(process.cwd(), projectDir)),
      exportZipPath: exportZipRelative,
      exportZipSha256,
      spec,
      errors,
      entries: normalizedEntries.sort(),
      excluded: ["android-wrapper-report.json", "checksums.sha256", "build/", ".gradle/"],
      generatedFiles: [],
    };
    await writeTextFile(reportPath, JSON.stringify(report, null, 2));
    await writeChecksums(projectDir, []);
    return {
      ok: false,
      projectDir,
      reportPath,
      checksumPath,
      errors,
    };
  }

  const filesToWrite: Array<{ path: string; content: Buffer | string }> = [];

  const manifestPath = path.join(
    projectDir,
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
  );
  filesToWrite.push({ path: manifestPath, content: buildManifestXml(spec) });

  const kotlinPath = path.join(
    projectDir,
    "app",
    "src",
    "main",
    "java",
    ...spec.appId.split("."),
    "MainActivity.kt"
  );
  filesToWrite.push({ path: kotlinPath, content: buildMainActivity(spec) });

  const stringsPath = path.join(
    projectDir,
    "app",
    "src",
    "main",
    "res",
    "values",
    "strings.xml"
  );
  filesToWrite.push({
    path: stringsPath,
    content: buildStringsXml(spec.appName),
  });

  filesToWrite.push({
    path: path.join(projectDir, "settings.gradle"),
    content: buildSettingsGradle(spec.appName),
  });
  filesToWrite.push({
    path: path.join(projectDir, "build.gradle"),
    content: buildRootGradle(),
  });
  filesToWrite.push({
    path: path.join(projectDir, "gradle.properties"),
    content: buildGradleProperties(),
  });
  filesToWrite.push({
    path: path.join(projectDir, "gradle", "wrapper", "gradle-wrapper.properties"),
    content: buildGradleWrapperProperties(),
  });
  filesToWrite.push({
    path: path.join(projectDir, "gradlew"),
    content: buildGradlew(),
  });
  filesToWrite.push({
    path: path.join(projectDir, "gradlew.bat"),
    content: buildGradlewBat(),
  });
  filesToWrite.push({
    path: path.join(projectDir, "app", "build.gradle"),
    content: buildAppGradle(spec),
  });

  const assetsRoot = path.join(projectDir, "app", "src", "main", "assets", "www");
  for (const entry of entries) {
    const normalized = normalizePath(entry.name);
    if (!isSafeRelativePath(normalized)) {
      errors.push(`Unsafe path in zip: ${entry.name}`);
      continue;
    }
    const targetPath = path.join(assetsRoot, normalized);
    filesToWrite.push({ path: targetPath, content: entry.data });
  }

  for (const file of filesToWrite) {
    await mkdir(path.dirname(file.path), { recursive: true });
    if (typeof file.content === "string") {
      await writeFile(file.path, file.content, "utf-8");
    } else {
      await writeFile(file.path, file.content);
    }
  }

  const excluded = [
    "android-wrapper-report.json",
    "checksums.sha256",
    "build/",
    ".gradle/",
  ];

  const allFiles = await listFiles(projectDir);
  const generatedFiles: GeneratedFile[] = [];
  for (const file of allFiles) {
    if (excluded.some((prefix) => file.startsWith(prefix))) {
      continue;
    }
    if (file === "android-wrapper-report.json" || file === "checksums.sha256") {
      continue;
    }
    generatedFiles.push({
      path: file,
      sha256: await hashFile(path.join(projectDir, file)),
    });
  }

  const report = {
    ok: errors.length === 0,
    outputDir: toPosix(path.relative(process.cwd(), projectDir)),
    exportZipPath: exportZipRelative,
    exportZipSha256,
    spec,
    errors,
    excluded,
    generatedFiles,
  };
  await writeTextFile(reportPath, JSON.stringify(report, null, 2));
  await writeChecksums(projectDir, generatedFiles);

  return {
    ok: errors.length === 0,
    projectDir,
    reportPath,
    checksumPath,
    errors,
  };
}
