import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);

test("Pages workflow uses Node 22", () => {
  assert.match(workflow, /uses:\s*actions\/setup-node@v4/u);
  assert.match(workflow, /node-version:\s*["']?22["']?/u);
});

test("Pages workflow validates before uploading the repository root", () => {
  const testsIndex = workflow.indexOf("node --test tests/*.test.mjs");
  const validatorIndex = workflow.indexOf("node tools/validate.mjs");
  const uploadIndex = workflow.indexOf("actions/upload-pages-artifact@v3");

  assert.ok(testsIndex >= 0, "full Node test command is missing");
  assert.ok(validatorIndex >= 0, "data validator command is missing");
  assert.ok(uploadIndex >= 0, "Pages artifact upload is missing");
  assert.ok(testsIndex < uploadIndex, "tests must run before the Pages artifact is uploaded");
  assert.ok(validatorIndex < uploadIndex, "validator must run before the Pages artifact is uploaded");
  assert.match(workflow.slice(uploadIndex), /path:\s*["']\.["']/u);
});

test("workflow retains the standard Pages deployment contract", () => {
  assert.match(workflow, /uses:\s*actions\/checkout@v4/u);
  assert.match(workflow, /uses:\s*actions\/configure-pages@v5/u);
  assert.match(workflow, /uses:\s*actions\/deploy-pages@v4/u);
  assert.match(workflow, /pages:\s*write/u);
  assert.match(workflow, /id-token:\s*write/u);
});
