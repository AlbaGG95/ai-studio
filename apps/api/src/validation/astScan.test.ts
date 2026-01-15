import assert from "node:assert/strict";
import test from "node:test";
import { scanFilesForForbiddenApis } from "./astScan.js";

test("ast scan blocks forbidden apis and imports", () => {
  const content = `
import fs from "fs";
const a = eval("1");
const b = new Function("return 1");
async function go() { await import("mod"); }
`;

  const violations = scanFilesForForbiddenApis([
    { path: "modules/mod-a/index.ts", content },
  ]);

  assert.ok(
    violations.some((violation) => violation.message.includes("Import prohibido: fs"))
  );
  assert.ok(
    violations.some((violation) => violation.message.includes("API prohibida: eval()"))
  );
  assert.ok(
    violations.some((violation) =>
      violation.message.includes("API prohibida: new Function()")
    )
  );
  assert.ok(
    violations.some((violation) =>
      violation.message.includes("Import dinamico prohibido")
    )
  );
});
