import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_CAPTURES = [
  "assets/captures/surnex-diagram.png",
  "assets/captures/player-type-methodology.png",
  "assets/captures/yomi-sirlin.png",
  "assets/captures/micro-macro-teamliquid.png",
  "assets/captures/a1-archive-method.png",
  "assets/captures/a1-netnography.png",
  "assets/captures/dustloop-frame-data.png",
  "assets/captures/spawning-tool-build-order.png",
  "assets/captures/total-cs-callout-map.png"
];

const REQUIRED_MATRIX_ROWS = [
  "ARC-SURNEX-DIAGRAM",
  "ARC-PLAYERTYPE-METHOD",
  "ARC-YOMI-SIRLIN",
  "ARC-MICRO-MACRO-TL",
  "ARC-A1-ARCHIVE-METHOD",
  "ARC-A1-NETNOGRAPHY",
  "ARC-DUSTLOOP-FRAME-DATA",
  "ARC-SPAWNING-TOOL-BUILD",
  "ARC-TOTAL-CS-MIRAGE",
  "CLM-MICRO-MACRO-EARLIER-USE",
  "CLM-YOMI-EARLIER-USE",
  "CLM-SURNEX-CROSS-GENRE-SYNTHESIS",
  "CLM-PLAYERTYPE-ADAPTATION",
  "CLM-FRAME-DATA-REDUCTION",
  "CLM-BUILD-ORDER-REDUCTION",
  "CLM-CALLOUT-MAP-REDUCTION",
  "CLM-ARCHIVE-POSITIONED-SELECTION",
  "REL-MICRO-MACRO-SURNEX",
  "REL-YOMI-SURNEX",
  "REL-SURNEX-PLAYERTYPE",
  "DISPUTE-MICRO-MEMBERSHIP",
  "DISPUTE-KNOWLEDGE-SKILL",
  "DISPUTE-PERSONAL-TASTE",
  "DISPUTE-EXTENSION",
  "DISPUTE-PLACEMENT-CRITERIA",
  "VIS-SURNEX-DIAGRAM",
  "VIS-PLAYERTYPE-METHOD",
  "VIS-YOMI-SIRLIN",
  "VIS-MICRO-MACRO-TL",
  "VIS-A1-ARCHIVE-METHOD",
  "VIS-A1-NETNOGRAPHY",
  "VIS-DUSTLOOP-FRAME-DATA",
  "VIS-SPAWNING-TOOL-BUILD",
  "VIS-TOTAL-CS-MIRAGE"
];

function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature), "capture must be a PNG");
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", "PNG must contain an IHDR header");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function parseMarkdownTable(markdown) {
  const rows = markdown
    .split(/\r?\n/)
    .filter(line => /^\|/.test(line.trim()))
    .map(line => line.trim().replace(/^\||\|$/g, "").split("|").map(cell => cell.trim()));

  assert.ok(rows.length >= 3, "evidence matrix must contain a header and evidence rows");
  const headers = rows[0].map(header => header.toLowerCase());
  const requiredHeaders = ["matrix id", "kind", "product id", "archive ids", "source", "capture", "alt / description", "credit", "claim / use", "evidence status", "qualification"];
  assert.deepEqual(headers, requiredHeaders, "evidence matrix columns must match the approved contract");

  return rows.slice(2).map(cells => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

test("all approved captures exist as readable PNGs at the minimum dimensions", async () => {
  for (const relativePath of REQUIRED_CAPTURES) {
    const absolutePath = path.join(ROOT, relativePath);
    const fileStats = await stat(absolutePath);
    assert.ok(fileStats.isFile(), `${relativePath} must be a file`);
    const dimensions = pngDimensions(await readFile(absolutePath));
    assert.ok(dimensions.width >= 600, `${relativePath} width ${dimensions.width} is below 600 px`);
    assert.ok(dimensions.height >= 350, `${relativePath} height ${dimensions.height} is below 350 px`);
  }
});

test("the evidence matrix covers every intended archive, claim, relation, dispute, and visual", async () => {
  const markdown = await readFile(path.join(ROOT, "docs/evidence-matrix.md"), "utf8");
  const rows = parseMarkdownTable(markdown);
  const rowIds = rows.map(row => row["matrix id"]);

  assert.equal(new Set(rowIds).size, rowIds.length, "evidence matrix IDs must be unique");
  for (const requiredId of REQUIRED_MATRIX_ROWS) {
    assert.ok(rowIds.includes(requiredId), `evidence matrix is missing ${requiredId}`);
  }

  const requiredKinds = new Map([
    ["ARC-", "archive"],
    ["CLM-", "claim"],
    ["REL-", "relation"],
    ["DISPUTE-", "dispute"],
    ["VIS-", "visual"]
  ]);

  for (const row of rows) {
    const matched = [...requiredKinds].find(([prefix]) => row["matrix id"].startsWith(prefix));
    assert.ok(matched, `${row["matrix id"]} uses an unknown matrix ID prefix`);
    assert.equal(row.kind, matched[1], `${row["matrix id"]} has the wrong kind`);
    for (const field of ["product id", "archive ids", "source", "alt / description", "credit", "claim / use", "evidence status", "qualification"]) {
      assert.ok(row[field], `${row["matrix id"]} requires a non-empty ${field}`);
    }
  }
});

test("every capture has one visual row with planned alt text and credit", async () => {
  const markdown = await readFile(path.join(ROOT, "docs/evidence-matrix.md"), "utf8");
  const visualRows = parseMarkdownTable(markdown).filter(row => row.kind === "visual");

  for (const relativePath of REQUIRED_CAPTURES) {
    const matches = visualRows.filter(row => row.capture === relativePath);
    assert.equal(matches.length, 1, `${relativePath} must have exactly one visual matrix row`);
    assert.ok(matches[0]["alt / description"].length >= 20, `${relativePath} alt text is too short to be descriptive`);
    assert.ok(matches[0].credit.length >= 3, `${relativePath} requires a meaningful credit`);
  }
});

test("external artefact visuals are documented as direct source captures", async () => {
  const markdown = await readFile(path.join(ROOT, "docs/evidence-matrix.md"), "utf8");
  const visualRows = parseMarkdownTable(markdown).filter(row => row.kind === "visual");
  for (const productId of [
    "surnex-diagram",
    "player-type-method",
    "yomi-sirlin",
    "micro-macro-teamliquid",
    "frame-data",
    "build-order",
    "callout-map"
  ]) {
    const row = visualRows.find(entry => entry["product id"] === productId);
    assert.ok(row, `missing visual row for ${productId}`);
    assert.match(row.qualification, /direct/i);
  }
});
