import ts from "typescript";

export interface ForbiddenUsage {
  file: string;
  message: string;
  line: number;
  column: number;
}

export interface ScanFileInput {
  path: string;
  content: string;
}

const FORBIDDEN_IMPORTS = new Set([
  "fs",
  "node:fs",
  "fs/promises",
  "node:fs/promises",
  "child_process",
  "node:child_process",
  "worker_threads",
  "node:worker_threads",
  "vm",
  "node:vm",
  "net",
  "node:net",
  "tls",
  "node:tls",
  "http",
  "node:http",
  "https",
  "node:https",
  "os",
  "node:os",
  "path",
  "node:path",
]);

const FORBIDDEN_CALLS = new Set(["eval", "Function", "fetch", "require"]);

function pushUsage(
  usages: ForbiddenUsage[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  message: string
) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    node.getStart()
  );
  usages.push({
    file: sourceFile.fileName,
    message,
    line: line + 1,
    column: character + 1,
  });
}

function scanSourceFile(sourceFile: ts.SourceFile): ForbiddenUsage[] {
  const usages: ForbiddenUsage[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const value = specifier.text;
        if (FORBIDDEN_IMPORTS.has(value) || value.startsWith("node:")) {
          pushUsage(
            usages,
            sourceFile,
            node,
            `Import prohibido: ${value}`
          );
        }
      }
    }

    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        pushUsage(usages, sourceFile, node, "Import dinamico prohibido");
      }
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (FORBIDDEN_CALLS.has(name)) {
          pushUsage(usages, sourceFile, node, `API prohibida: ${name}()`);
        }
      }
    }

    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "Function") {
        pushUsage(usages, sourceFile, node, "API prohibida: new Function()");
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return usages;
}

export function scanFilesForForbiddenApis(
  files: ScanFileInput[]
): ForbiddenUsage[] {
  const usages: ForbiddenUsage[] = [];

  for (const file of files) {
    const sourceFile = ts.createSourceFile(
      file.path,
      file.content,
      ts.ScriptTarget.ES2020,
      true,
      ts.ScriptKind.TSX
    );
    usages.push(...scanSourceFile(sourceFile));
  }

  return usages;
}
