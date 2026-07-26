import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  EVIDENCE_STATUSES,
  RELATION_TYPES,
  loadEvidenceBundle,
  scanProductionFiles,
  validateEvidenceBundle
} from "../tools/validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = await loadEvidenceBundle(ROOT);
const errors = validateEvidenceBundle(bundle, { rootDir: ROOT });

function errorsFor(prefixes) {
  const wanted = Array.isArray(prefixes) ? prefixes : [prefixes];
  return errors.filter(({ code }) => wanted.some(prefix => code.startsWith(prefix)));
}

function assertNoErrors(prefixes) {
  const matching = errorsFor(prefixes);
  assert.deepEqual(matching, [], matching.map(error => `${error.path}: ${error.message}`).join("\n"));
}

function fixtureGames() {
  const base = {
    scope_label: "Fixture scope",
    genre: "fixture genre",
    play_problem: "A fixture play problem.",
    player_question: "What does this fixture test?",
    reduction: "fixture reduction",
    supported_action: "exercise the game schema",
    interpretive_synthesis: true,
    archive_ids: ["ARC-TEST"],
    related_lineage_ids: ["lineage-test"],
    related_format_ids: ["format-test"]
  };
  return [
    { ...base, id: "game-test-one", name: "Fixture game one" },
    { ...base, id: "game-test-two", name: "Fixture game two" },
    { ...base, id: "game-test-three", name: "Fixture game three" },
    { ...base, id: "game-test-four", name: "Fixture game four" },
    {
      ...base,
      id: "cross-game-classification",
      name: "Cross-game classification",
      scope_label: "competitive games across genres",
      genre: null
    }
  ];
}

test("uses the exact approved relation and evidence enums", () => {
  assert.deepEqual(RELATION_TYPES, [
    "earlier_documented_use",
    "community_precedent",
    "conceptual_precedent",
    "later_adaptation",
    "possible_relation"
  ]);
  assert.deepEqual(EVIDENCE_STATUSES, ["documented", "interpretive", "speculative"]);
  assertNoErrors("enum.");
});

test("each evidence file declares one schema version and IDs are unique", () => {
  assertNoErrors(["schema.", "id."]);
});

test("archive records use the canonical source and capture fields", () => {
  assertNoErrors(["archive.", "date."]);
});

test("lineages expose provenance, relationships, history, and disputes", () => {
  assertNoErrors(["lineage.", "relationship."]);
});

test("formats expose their archive-backed comparative analysis", () => {
  assertNoErrors("format.");
});

test("disputes retain dates, archive links, and explicit ethics flags", () => {
  assertNoErrors("dispute.");
});

test("games use the approved evidence-qualified schema and copy", () => {
  assertNoErrors("game.");
  assert.equal(bundle.games.schema_version, "1.0");
  assert.deepEqual(bundle.games.games, [
    {
      id: "starcraft-brood-war",
      name: "StarCraft: Brood War",
      scope_label: "StarCraft: Brood War",
      genre: "real-time strategy",
      play_problem: "coordinating local mechanical execution, multitasking, economy and longer-term strategic control",
      player_question: "How do I balance precise unit control and multitasking with economy and longer-term strategy?",
      reduction: "Micro/Macro vocabulary",
      supported_action: "diagnose and discuss local execution in relation to broader strategic control",
      interpretive_synthesis: true,
      archive_ids: ["ARC-MICRO-MACRO-TL"],
      related_lineage_ids: ["micro-macro"],
      related_format_ids: []
    },
    {
      id: "starcraft-ii",
      name: "StarCraft II",
      scope_label: "StarCraft II",
      genre: "real-time strategy",
      play_problem: "executing a planned opening while scouting, adapting and recovering from disruption",
      player_question: "What should I build and when, and when must I depart from the planned sequence?",
      reduction: "build order",
      supported_action: "rehearse an opening and compare in-game progress with planned milestones",
      interpretive_synthesis: true,
      archive_ids: ["ARC-SPAWNING-TOOL-BUILD"],
      related_lineage_ids: [],
      related_format_ids: ["build-order"]
    },
    {
      id: "guilty-gear-strive",
      name: "Guilty Gear Strive",
      scope_label: "Guilty Gear Strive",
      genre: "fighting game",
      play_problem: "judging whether an attack leaves enough time to retaliate while accounting for spacing, pressure and execution",
      player_question: "After this move, is there enough time to retaliate?",
      reduction: "frame-data table",
      supported_action: "reason about punish windows and frame advantage",
      interpretive_synthesis: true,
      archive_ids: ["ARC-DUSTLOOP-FRAME-DATA"],
      related_lineage_ids: ["yomi-reads"],
      related_format_ids: ["frame-data"]
    },
    {
      id: "counter-strike-mirage",
      name: "Counter-Strike: Mirage",
      scope_label: "Counter-Strike: Mirage",
      genre: "tactical first-person shooter",
      play_problem: "coordinating locations, movement and team communication through a shared spatial vocabulary",
      player_question: "What location do we mean, and how can the team refer to it quickly?",
      reduction: "callout map",
      supported_action: "name locations consistently during team communication",
      interpretive_synthesis: true,
      archive_ids: ["ARC-TOTAL-CS-MIRAGE"],
      related_lineage_ids: [],
      related_format_ids: ["callout-map"]
    },
    {
      id: "cross-game-classification",
      name: "Cross-game classification",
      scope_label: "competitive games across genres",
      genre: null,
      play_problem: "comparing which dimensions of competitive skill different games appear to emphasise",
      player_question: "Which dimensions of competitive skill does this game appear to emphasise?",
      reduction: "Surnex taxonomy diagram and Player Type adaptation",
      supported_action: "compare and debate games through shared skill categories",
      interpretive_synthesis: true,
      archive_ids: ["ARC-SURNEX-DIAGRAM", "ARC-PLAYERTYPE-METHOD"],
      related_lineage_ids: ["surnex-playertype"],
      related_format_ids: ["taxonomy-diagram"]
    }
  ]);
});

test("game validation rejects wrong counts, fields, flags, genres, and references", () => {
  const malformed = structuredClone(bundle);
  malformed.games.games.pop();
  malformed.games.games[0].unexpected = "not canonical";
  malformed.games.games[0].scope_label = "";
  malformed.games.games[0].genre = null;
  malformed.games.games[0].interpretive_synthesis = false;
  malformed.games.games[0].archive_ids = ["ARC-UNKNOWN"];
  malformed.games.games[0].related_lineage_ids = ["lineage-unknown"];
  malformed.games.games[0].related_format_ids = ["format-unknown"];
  malformed.games.games[1].id = malformed.games.games[0].id;
  const fixtureErrors = validateEvidenceBundle(malformed, { rootDir: ROOT });
  for (const code of [
    "game.records", "game.schema", "game.field", "game.genre", "game.interpretive_synthesis",
    "reference.archive", "reference.lineage", "reference.format", "id.duplicate"
  ]) {
    assert.ok(fixtureErrors.some(error => error.code === code), `expected ${code}`);
  }
});

test("only the cross-game classification may use a null genre", () => {
  const malformed = structuredClone(bundle);
  malformed.games.games.at(-1).genre = "all genres";
  const fixtureErrors = validateEvidenceBundle(malformed, { rootDir: ROOT });
  assert.ok(fixtureErrors.some(error => error.code === "game.genre" && error.path.endsWith(".genre")));
});

test("all evidence links resolve to canonical archive records and local captures", () => {
  assertNoErrors(["reference.", "capture."]);
});

test("production-facing files contain no scaffold placeholders or internal citation tokens", async () => {
  const scanErrors = await scanProductionFiles(ROOT);
  assert.deepEqual(scanErrors, [], scanErrors.map(error => `${error.path}: ${error.message}`).join("\n"));
});

test("nullable source dates are qualified and source/capture values may match", () => {
  const fixture = {
    archive: {
      schema_version: "1.0",
      records: [{
        id: "ARC-TEST",
        title: "Test source",
        creator: "Test creator",
        platform: "Test platform",
        source_type: "test fixture",
        source_date: "2026-07-25",
        capture_date: "2026-07-25",
        source_url: null,
        capture_path: "index.html",
        alt: "Test capture",
        credit: "Test creator",
        qualification_note: "No public URL is assigned to this local test fixture."
      }]
    },
    lineages: {
      schema_version: "1.0",
      lineages: [{
        id: "lineage-test",
        name: "Test lineage",
        summary: "A validator fixture.",
        makes_visible: ["evidence"],
        simplifies: ["context"],
        provenance: [{
          claim: "The fixture is documented locally.",
          relation_type: "earlier_documented_use",
          evidence_status: "documented",
          archive_ids: ["ARC-TEST"]
        }],
        connections: [{
          target_id: "lineage-test",
          relation_type: "possible_relation",
          evidence_status: "speculative",
          archive_ids: ["ARC-TEST"],
          claim: "A deliberately self-contained test relationship.",
          qualification: "This exists only to exercise the schema."
        }],
        version_history: [{
          label: "Fixture version",
          evidence_status: "interpretive",
          archive_ids: ["ARC-TEST"]
        }],
        dispute_ids: ["dispute-test"]
      }]
    },
    formats: {
      schema_version: "1.0",
      formats: [{
        id: "format-test",
        name: "Test format",
        summary: "A format fixture.",
        archive_ids: ["ARC-TEST"],
        makes_visible: ["structure"],
        simplifies: ["variation"],
        cross_game: "Not applicable outside this fixture.",
        related_lineage_ids: ["lineage-test"]
      }]
    },
    disputes: {
      schema_version: "1.0",
      disputes: [{
        id: "dispute-test",
        excerpt: "A paraphrased fixture claim.",
        participation: "dispute",
        attached_to: ["lineage-test"],
        archive_ids: ["ARC-TEST"],
        subject_archive_ids: ["ARC-TEST"],
        evidence_status: "documented",
        source_date: null,
        source_capture_window: "2026-07",
        capture_date: "2026-07-25",
        paraphrased: true,
        anonymised: true,
        note: "The source date is unavailable in this test fixture."
      }]
    },
    games: {
      schema_version: "1.0",
      games: fixtureGames()
    }
  };

  const fixtureErrors = validateEvidenceBundle(fixture, { rootDir: ROOT });
  assert.deepEqual(fixtureErrors, [], fixtureErrors.map(error => `${error.path}: ${error.message}`).join("\n"));
});

test("capture paths cannot escape the repository or identify directories", () => {
  const malformed = {
    archive: {
      schema_version: "1.0",
      records: [{
        id: "ARC-ESCAPE", title: "Escape", creator: "Test", platform: "Test",
        source_type: "fixture", source_date: null, capture_date: "2026-07-25",
        source_url: null, capture_path: "..", alt: "Escape fixture", credit: "Test",
        qualification_note: "Dates and URL unavailable in this deliberate invalid fixture."
      }, {
        id: "ARC-DIRECTORY", title: "Directory", creator: "Test", platform: "Test",
        source_type: "fixture", source_date: null, capture_date: "2026-07-25",
        source_url: null, capture_path: "data", alt: "Directory fixture", credit: "Test",
        qualification_note: "Dates and URL unavailable in this deliberate invalid fixture."
      }]
    },
    lineages: { schema_version: "1.0", lineages: [] },
    formats: { schema_version: "1.0", formats: [] },
    disputes: { schema_version: "1.0", disputes: [] },
    games: { schema_version: "1.0", games: [] }
  };
  const fixtureErrors = validateEvidenceBundle(malformed, { rootDir: ROOT });
  assert.ok(fixtureErrors.some(error => error.path === "archive[0].capture_path"));
  assert.ok(fixtureErrors.some(error => error.path === "archive[1].capture_path"));
});

test("analysis arrays contain meaningful strings", () => {
  const malformed = {
    archive: { schema_version: "1.0", records: [] },
    lineages: {
      schema_version: "1.0",
      lineages: [{
        id: "lineage-empty-analysis", name: "Empty analysis", summary: "Fixture",
        makes_visible: [null], simplifies: [""], provenance: [], connections: [],
        version_history: [], dispute_ids: []
      }]
    },
    formats: { schema_version: "1.0", formats: [] },
    disputes: { schema_version: "1.0", disputes: [] },
    games: { schema_version: "1.0", games: [] }
  };
  const fixtureErrors = validateEvidenceBundle(malformed, { rootDir: ROOT });
  assert.ok(fixtureErrors.some(error => error.path === "lineages[0].makes_visible[0]"));
  assert.ok(fixtureErrors.some(error => error.path === "lineages[0].simplifies[0]"));
});

test("all core evidence containers use their exact keys and remain non-empty", () => {
  const malformed = {
    archive: { schema_version: "1.0", records: [] },
    lineages: { schema_version: "1.0", records: [] },
    formats: { schema_version: "1.0", records: [] },
    disputes: { schema_version: "1.0", records: [] },
    games: { schema_version: "1.0", records: [] }
  };
  const fixtureErrors = validateEvidenceBundle(malformed, { rootDir: ROOT });
  for (const section of ["lineages", "formats", "disputes", "games"]) {
    assert.ok(fixtureErrors.some(error => error.code === "schema.container" && error.path === `data/${section}`));
  }
  assert.ok(fixtureErrors.some(error => error.code === "lineage.records"));
  assert.ok(fixtureErrors.some(error => error.code === "format.records"));
  assert.ok(fixtureErrors.some(error => error.code === "dispute.records"));
  assert.ok(fixtureErrors.some(error => error.code === "game.records"));
});

test("scanner catches standalone pre-submission scaffold instructions", async () => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "frontier-validator-"));
  try {
    await mkdir(path.join(fixtureRoot, "data"));
    await writeFile(path.join(fixtureRoot, "data", "formats.json"), '{"note":"Fill from A1 references before submission."}', "utf8");
    const fixtureErrors = await scanProductionFiles(fixtureRoot);
    assert.ok(fixtureErrors.some(error => error.code === "scan.placeholder" && error.path === "data/formats.json"));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("corpus years are not promoted to unsupported publication dates", () => {
  const records = bundle.archive.records;
  for (const id of ["ARC-SURNEX-DIAGRAM", "ARC-PLAYERTYPE-METHOD", "ARC-DUSTLOOP-FRAME-DATA", "ARC-TOTAL-CS-MIRAGE"]) {
    const record = records.find(entry => entry.id === id);
    assert.ok(record, `missing ${id}`);
    assert.equal(record.source_date, null, `${id} must not use the corpus year as a publication date`);
    assert.match(record.qualification_note, /publication date|publication/i);
  }
});

test("netnography evidence sources remain distinct from the artefacts being discussed", () => {
  const netnography = bundle.archive.records.find(record => record.id === "ARC-A1-NETNOGRAPHY");
  assert.ok(netnography, "missing canonical Assessment 1 netnography record");
  assert.equal(netnography.capture_path, "assets/captures/a1-netnography.png");

  for (const dispute of bundle.disputes.disputes) {
    assert.ok(dispute.archive_ids.includes("ARC-A1-NETNOGRAPHY") || dispute.id === "dispute-extension", `${dispute.id} must cite its recorded evidence source`);
    assert.ok(Array.isArray(dispute.subject_archive_ids) && dispute.subject_archive_ids.length > 0, `${dispute.id} requires subject archive IDs`);
    assert.ok(EVIDENCE_STATUSES.includes(dispute.evidence_status), `${dispute.id} requires a valid evidence status`);
    assert.match(dispute.capture_date, /^\d{4}-\d{2}-\d{2}$/u);
    assert.match(dispute.source_capture_window, /^(?:\d{4}-\d{2}(?:-\d{2})?|\d{4}-\d{2}\/\d{4}-\d{2})$/u);
  }
  for (const dispute of bundle.disputes.disputes.filter(entry => entry.anonymised)) {
    assert.equal(dispute.source_capture_window, "2026-06/2026-07", `${dispute.id} must preserve the documented June–July collection range`);
  }
});

test("Yomi chronology uses the publication date visible on the official page", () => {
  const yomi = bundle.archive.records.find(record => record.id === "ARC-YOMI-SIRLIN");
  assert.equal(yomi?.source_date, "2014-08-03");
});

test("Spawning Tool metadata matches the verified official build page", () => {
  const build = bundle.archive.records.find(record => record.id === "ARC-SPAWNING-TOOL-BUILD");
  assert.ok(build, "missing canonical Spawning Tool record");
  assert.equal(build.title, "Beginner Terran Build Order Guide (2023) By Probe (TvX Economic)");
  assert.equal(build.creator, "Kenosua");
  assert.equal(build.credit, "Kenosua; hosted by Spawning Tool");
  assert.equal(build.source_date, "2023-09-24");
  assert.equal(build.capture_date, "2026-07-26");
  assert.doesNotMatch(build.qualification_note, /date (?:was )?not established|publication date was not established/iu);
});

test("validator rejects unsupported schema versions, dates, URLs, and dispute statuses", () => {
  const malformed = structuredClone(bundle);
  malformed.archive.schema_version = "2.0";
  malformed.archive.records[0].capture_date = "2026-07";
  malformed.archive.records[0].source_url = "javascript:alert(1)";
  malformed.disputes.disputes[0].evidence_status = "certain";
  const fixtureErrors = validateEvidenceBundle(malformed, { rootDir: ROOT });
  assert.ok(fixtureErrors.some(error => error.code === "schema.version"));
  assert.ok(fixtureErrors.some(error => error.code === "date.capture"));
  assert.ok(fixtureErrors.some(error => error.code === "archive.url"));
  assert.ok(fixtureErrors.some(error => error.code === "enum.evidence_status" && error.path.includes("disputes")));
});
