import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const parser = require("@typescript-eslint/parser");
const parserRequire = createRequire(require.resolve("@typescript-eslint/typescript-estree"));
const { minimatch } = parserRequire("minimatch");

// These are the named API and options used by typescript-estree's project service.
const cases = [
  ["config.js", "*.js", true],
  [".config.js", "*.js", true],
  ["nested/config.js", "*.js", false],
  ["config.ts", "*.{js,ts}", true],
  ["config.txt", "*.{js,ts}", false],
  ["src/entry.ts", "src/*.ts", true],
  ["src/nested/entry.ts", "src/*.ts", false],
  ["src/nested/entry.ts", "src/**/entry.ts", true],
  ["src/.hidden/entry.ts", "src/**/entry.ts", true],
  ["foo.js", "@(foo|bar).js", true],
  ["other.js", "@(foo|bar).js", false],
  ["test1.ts", "test[0-9].ts", true],
  ["testA.ts", "test[0-9].ts", false],
];
for (const [file, pattern, expected] of cases) {
  assert.equal(minimatch(file, pattern, { dot: true }), expected, `${pattern}: ${file}`);
}

const fixture = mkdtempSync(path.join(tmpdir(), "llm-search-parser-"));
try {
  writeFileSync(path.join(fixture, "tsconfig.json"), JSON.stringify({
    compilerOptions: { allowJs: true, checkJs: true, noEmit: true },
    include: ["included.ts"],
  }));
  writeFileSync(path.join(fixture, "included.ts"), "export const included: number = 1;\n");
  const source = "const answer = 42; export { answer };\n";
  for (const file of ["allowed.js", ".allowed.js", "denied.js"]) {
    writeFileSync(path.join(fixture, file), source);
  }
  const parse = (file, allowDefaultProject) => {
    parser.clearCaches();
    return parser.parseForESLint(source, {
      filePath: path.join(fixture, file),
      tsconfigRootDir: fixture,
      sourceType: "module",
      projectService: { allowDefaultProject, defaultProject: "tsconfig.json" },
    });
  };
  for (const [file, patterns] of [["allowed.js", ["allowed.js"]], [".allowed.js", ["*.js"]]]) {
    const result = parse(file, patterns);
    assert.ok(result.services.program);
    assert.equal(result.ast.type, "Program");
  }
  assert.throws(() => parse("denied.js", ["allowed.js"]), /not found|not.*allowDefaultProject|was not found/i);
  console.log("Parser override: 13 matching cases and 3 project-service cases passed.");
} finally {
  parser.clearCaches();
  rmSync(fixture, { recursive: true, force: true });
}
