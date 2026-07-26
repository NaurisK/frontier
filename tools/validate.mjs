import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RELATION_TYPES = [
  "earlier_documented_use",
  "community_precedent",
  "conceptual_precedent",
  "later_adaptation",
  "possible_relation"
];

export const EVIDENCE_STATUSES = ["documented", "interpretive", "speculative"];

const DATA_FILES = {
  archive: "data/archive_index.json",
  lineages: "data/lineages.json",
  formats: "data/formats.json",
  disputes: "data/disputes.json",
  games: "data/games.json"
};

const PRODUCTION_FILES = [
  "index.html",
  "README.md",
  "css/main.css"
];

const PLACEHOLDER_PATTERNS = [
  { code: "scan.placeholder", expression: /\bTODO\b/iu, label: "TODO marker" },
  { code: "scan.placeholder", expression: /\[\s*Fill\b/iu, label: "unfilled template field" },
  { code: "scan.placeholder", expression: /\bfill\b[^\r\n]{0,80}\b(?:from|before submission|counts|captures?|sources?)\b/iu, label: "scaffold instruction" },
  { code: "scan.citation", expression: /\bturn\d+[a-z]+\d+\b/iu, label: "internal citation token" }
];

function issue(code, itemPath, message) {
  return { code, path: itemPath, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function recordsFor(section, key) {
  if (isRecord(section) && Array.isArray(section[key])) return section[key];
  return [];
}

function requireString(errors, value, itemPath, code) {
  if (!nonEmptyString(value)) errors.push(issue(code, itemPath, "must be a non-empty string"));
}

function requireArray(errors, value, itemPath, code, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    errors.push(issue(code, itemPath, allowEmpty ? "must be an array" : "must be a non-empty array"));
  }
}

function requireStringArray(errors, value, itemPath, code) {
  requireArray(errors, value, itemPath, code);
  if (!Array.isArray(value)) return;
  value.forEach((entry, index) => {
    if (!nonEmptyString(entry)) errors.push(issue(code, `${itemPath}[${index}]`, "must be a non-empty string"));
  });
}

function checkSchemaVersions(bundle, errors) {
  for (const [name, section] of Object.entries(bundle)) {
    if (!isRecord(section) || section.schema_version !== "1.0") {
      errors.push(issue("schema.version", `data/${name}`, "must declare schema_version 1.0"));
    }
  }
}

function checkContainerShapes(bundle, errors) {
  const expected = { archive: "records", lineages: "lineages", formats: "formats", disputes: "disputes", games: "games" };
  for (const [name, key] of Object.entries(expected)) {
    if (!isRecord(bundle[name]) || !Array.isArray(bundle[name][key])) {
      errors.push(issue("schema.container", `data/${name}`, `must contain an array at .${key}`));
    }
  }
}

function checkUniqueIds(collections, errors) {
  const seen = new Map();
  for (const [kind, records] of Object.entries(collections)) {
    records.forEach((record, index) => {
      const itemPath = `${kind}[${index}]`;
      if (!nonEmptyString(record?.id)) {
        errors.push(issue("id.required", `${itemPath}.id`, "must be a non-empty string"));
        return;
      }
      if (seen.has(record.id)) {
        errors.push(issue("id.duplicate", `${itemPath}.id`, `duplicates ${seen.get(record.id)}`));
      } else {
        seen.set(record.id, itemPath);
      }
    });
  }
}

function checkArchive(records, errors) {
  if (records.length === 0) {
    errors.push(issue("archive.records", "archive", "must contain at least one canonical archive record"));
  }
  records.forEach((record, index) => {
    const base = `archive[${index}]`;
    for (const field of ["id", "title", "creator", "platform", "source_type", "capture_date", "capture_path", "alt", "credit", "qualification_note"]) {
      requireString(errors, record?.[field], `${base}.${field}`, "archive.field");
    }
    for (const field of ["source_date", "source_url"]) {
      if (record?.[field] !== null && !nonEmptyString(record?.[field])) {
        errors.push(issue("archive.field", `${base}.${field}`, "must be null or a non-empty string"));
      }
      if (record?.[field] == null && !nonEmptyString(record?.qualification_note)) {
        errors.push(issue("date.qualification", `${base}.qualification_note`, `must explain missing ${field}`));
      }
    }
    if (record?.source_date !== null && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(record.source_date)) {
      errors.push(issue("date.source", `${base}.source_date`, "must use YYYY, YYYY-MM, YYYY-MM-DD, or null"));
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(record?.capture_date ?? "")) {
      errors.push(issue("date.capture", `${base}.capture_date`, "must use exact YYYY-MM-DD form"));
    }
    if (record?.source_url !== null) {
      try {
        const parsed = new URL(record.source_url);
        if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("unsupported URL");
      } catch {
        errors.push(issue("archive.url", `${base}.source_url`, "must be an absolute HTTP(S) URL without credentials, or null"));
      }
    }
  });
}

function checkArchiveIds(errors, ids, archiveIds, itemPath) {
  requireArray(errors, ids, itemPath, "reference.archive_ids");
  if (!Array.isArray(ids)) return;
  ids.forEach((id, index) => {
    if (!archiveIds.has(id)) errors.push(issue("reference.archive", `${itemPath}[${index}]`, `unknown archive ID: ${id}`));
  });
}

function checkRelationship(record, base, archiveIds, lineageIds, errors) {
  for (const field of ["target_id", "relation_type", "evidence_status", "claim", "qualification"]) {
    requireString(errors, record?.[field], `${base}.${field}`, "relationship.field");
  }
  if (nonEmptyString(record?.relation_type) && !RELATION_TYPES.includes(record.relation_type)) {
    errors.push(issue("enum.relation_type", `${base}.relation_type`, `unsupported value: ${record.relation_type}`));
  }
  if (nonEmptyString(record?.evidence_status) && !EVIDENCE_STATUSES.includes(record.evidence_status)) {
    errors.push(issue("enum.evidence_status", `${base}.evidence_status`, `unsupported value: ${record.evidence_status}`));
  }
  if (nonEmptyString(record?.target_id) && !lineageIds.has(record.target_id)) {
    errors.push(issue("reference.lineage", `${base}.target_id`, `unknown lineage ID: ${record.target_id}`));
  }
  checkArchiveIds(errors, record?.archive_ids, archiveIds, `${base}.archive_ids`);
}

function checkLineages(records, archiveIds, disputeIds, errors) {
  if (records.length === 0) errors.push(issue("lineage.records", "lineages", "must contain at least one lineage"));
  const lineageIds = new Set(records.map(record => record?.id).filter(nonEmptyString));
  records.forEach((record, index) => {
    const base = `lineages[${index}]`;
    for (const field of ["id", "name", "summary"]) requireString(errors, record?.[field], `${base}.${field}`, "lineage.field");
    for (const field of ["makes_visible", "simplifies"]) requireStringArray(errors, record?.[field], `${base}.${field}`, "lineage.field");
    for (const field of ["provenance", "connections", "version_history", "dispute_ids"]) {
      requireArray(errors, record?.[field], `${base}.${field}`, "lineage.field");
    }
    if (Array.isArray(record?.provenance)) {
      record.provenance.forEach((entry, entryIndex) => {
        const entryBase = `${base}.provenance[${entryIndex}]`;
        for (const field of ["claim", "relation_type", "evidence_status"]) requireString(errors, entry?.[field], `${entryBase}.${field}`, "lineage.provenance");
        if (nonEmptyString(entry?.relation_type) && !RELATION_TYPES.includes(entry.relation_type)) errors.push(issue("enum.relation_type", `${entryBase}.relation_type`, `unsupported value: ${entry.relation_type}`));
        if (nonEmptyString(entry?.evidence_status) && !EVIDENCE_STATUSES.includes(entry.evidence_status)) errors.push(issue("enum.evidence_status", `${entryBase}.evidence_status`, `unsupported value: ${entry.evidence_status}`));
        checkArchiveIds(errors, entry?.archive_ids, archiveIds, `${entryBase}.archive_ids`);
      });
    }
    if (Array.isArray(record?.connections)) record.connections.forEach((entry, entryIndex) => checkRelationship(entry, `${base}.connections[${entryIndex}]`, archiveIds, lineageIds, errors));
    if (Array.isArray(record?.version_history)) {
      record.version_history.forEach((entry, entryIndex) => {
        const entryBase = `${base}.version_history[${entryIndex}]`;
        requireString(errors, entry?.label, `${entryBase}.label`, "lineage.version_history");
        requireString(errors, entry?.evidence_status, `${entryBase}.evidence_status`, "lineage.version_history");
        if (nonEmptyString(entry?.evidence_status) && !EVIDENCE_STATUSES.includes(entry.evidence_status)) errors.push(issue("enum.evidence_status", `${entryBase}.evidence_status`, `unsupported value: ${entry.evidence_status}`));
        checkArchiveIds(errors, entry?.archive_ids, archiveIds, `${entryBase}.archive_ids`);
      });
    }
    if (Array.isArray(record?.dispute_ids)) record.dispute_ids.forEach((id, idIndex) => {
      if (!disputeIds.has(id)) errors.push(issue("reference.dispute", `${base}.dispute_ids[${idIndex}]`, `unknown dispute ID: ${id}`));
    });
  });
}

function checkFormats(records, archiveIds, lineageIds, errors) {
  if (records.length === 0) errors.push(issue("format.records", "formats", "must contain at least one format"));
  records.forEach((record, index) => {
    const base = `formats[${index}]`;
    for (const field of ["id", "name", "summary", "cross_game"]) requireString(errors, record?.[field], `${base}.${field}`, "format.field");
    for (const field of ["makes_visible", "simplifies"]) requireStringArray(errors, record?.[field], `${base}.${field}`, "format.field");
    for (const field of ["archive_ids", "related_lineage_ids"]) requireArray(errors, record?.[field], `${base}.${field}`, "format.field");
    checkArchiveIds(errors, record?.archive_ids, archiveIds, `${base}.archive_ids`);
    if (Array.isArray(record?.related_lineage_ids)) record.related_lineage_ids.forEach((id, idIndex) => {
      if (!lineageIds.has(id)) errors.push(issue("reference.lineage", `${base}.related_lineage_ids[${idIndex}]`, `unknown lineage ID: ${id}`));
    });
  });
}

function checkDisputes(records, archiveIds, attachedIds, errors) {
  if (records.length === 0) errors.push(issue("dispute.records", "disputes", "must contain at least one dispute"));
  records.forEach((record, index) => {
    const base = `disputes[${index}]`;
    for (const field of ["id", "excerpt", "participation", "evidence_status", "capture_date", "source_capture_window", "note"]) requireString(errors, record?.[field], `${base}.${field}`, "dispute.field");
    if (nonEmptyString(record?.evidence_status) && !EVIDENCE_STATUSES.includes(record.evidence_status)) {
      errors.push(issue("enum.evidence_status", `${base}.evidence_status`, `unsupported value: ${record.evidence_status}`));
    }
    if (record?.source_date !== null && !nonEmptyString(record?.source_date)) {
      errors.push(issue("dispute.field", `${base}.source_date`, "must be null or a non-empty string"));
    }
    if (record?.source_date === null && !nonEmptyString(record?.note)) {
      errors.push(issue("date.qualification", `${base}.note`, "must explain the unavailable source date"));
    }
    if (record?.source_date !== null && !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/u.test(record.source_date)) {
      errors.push(issue("date.source", `${base}.source_date`, "must use YYYY, YYYY-MM, YYYY-MM-DD, or null"));
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(record?.capture_date ?? "")) {
      errors.push(issue("date.capture", `${base}.capture_date`, "must use exact YYYY-MM-DD form"));
    }
    if (!/^(?:\d{4}-\d{2}(?:-\d{2})?|\d{4}-\d{2}\/\d{4}-\d{2})$/u.test(record?.source_capture_window ?? "")) {
      errors.push(issue("date.capture_window", `${base}.source_capture_window`, "must use YYYY-MM, YYYY-MM-DD, or YYYY-MM/YYYY-MM form"));
    }
    for (const field of ["paraphrased", "anonymised"]) {
      if (typeof record?.[field] !== "boolean") errors.push(issue("dispute.ethics", `${base}.${field}`, "must be a boolean"));
    }
    requireArray(errors, record?.attached_to, `${base}.attached_to`, "dispute.field");
    checkArchiveIds(errors, record?.archive_ids, archiveIds, `${base}.archive_ids`);
    checkArchiveIds(errors, record?.subject_archive_ids, archiveIds, `${base}.subject_archive_ids`);
    if (Array.isArray(record?.attached_to)) record.attached_to.forEach((id, idIndex) => {
      if (!attachedIds.has(id)) errors.push(issue("reference.attached_to", `${base}.attached_to[${idIndex}]`, `unknown lineage or format ID: ${id}`));
    });
  });
}

const GAME_FIELDS = [
  "id", "name", "scope_label", "genre", "play_problem", "player_question", "reduction",
  "supported_action", "interpretive_synthesis", "archive_ids", "related_lineage_ids",
  "related_format_ids"
];

function checkGameReferenceIds(errors, ids, knownIds, itemPath, code, label) {
  requireArray(errors, ids, itemPath, "game.field", { allowEmpty: true });
  if (!Array.isArray(ids)) return;
  ids.forEach((id, index) => {
    if (!nonEmptyString(id)) {
      errors.push(issue("game.field", `${itemPath}[${index}]`, "must be a non-empty string"));
    } else if (!knownIds.has(id)) {
      errors.push(issue(code, `${itemPath}[${index}]`, `unknown ${label} ID: ${id}`));
    }
  });
}

function checkGames(records, archiveIds, lineageIds, formatIds, errors) {
  if (records.length !== 5) errors.push(issue("game.records", "games", "must contain exactly five game records"));
  records.forEach((record, index) => {
    const base = `games[${index}]`;
    const keys = isRecord(record) ? Object.keys(record).sort() : [];
    if (keys.join("\0") !== [...GAME_FIELDS].sort().join("\0")) {
      errors.push(issue("game.schema", base, `must contain exactly these fields: ${GAME_FIELDS.join(", ")}`));
    }
    for (const field of ["id", "name", "scope_label", "play_problem", "player_question", "reduction", "supported_action"]) {
      requireString(errors, record?.[field], `${base}.${field}`, "game.field");
    }
    const isCrossGame = record?.id === "cross-game-classification";
    if ((isCrossGame && record?.genre !== null) || (!isCrossGame && !nonEmptyString(record?.genre))) {
      errors.push(issue("game.genre", `${base}.genre`, "must be null only for cross-game classification and otherwise a non-empty string"));
    }
    if (record?.interpretive_synthesis !== true) {
      errors.push(issue("game.interpretive_synthesis", `${base}.interpretive_synthesis`, "must be true"));
    }
    checkArchiveIds(errors, record?.archive_ids, archiveIds, `${base}.archive_ids`);
    checkGameReferenceIds(errors, record?.related_lineage_ids, lineageIds, `${base}.related_lineage_ids`, "reference.lineage", "lineage");
    checkGameReferenceIds(errors, record?.related_format_ids, formatIds, `${base}.related_format_ids`, "reference.format", "format");
  });
}

function checkCaptures(records, rootDir, errors) {
  for (let index = 0; index < records.length; index += 1) {
    const capturePath = records[index]?.capture_path;
    if (!nonEmptyString(capturePath)) continue;
    const resolved = path.resolve(rootDir, capturePath);
    const rootWithSeparator = `${path.resolve(rootDir)}${path.sep}`;
    if (path.isAbsolute(capturePath) || !resolved.startsWith(rootWithSeparator)) {
      errors.push(issue("capture.path", `archive[${index}].capture_path`, "must be repository-relative"));
      continue;
    }
    if (!existsSync(resolved)) {
      errors.push(issue("capture.missing", `archive[${index}].capture_path`, `file not found: ${capturePath}`));
    } else if (!statSync(resolved).isFile()) {
      errors.push(issue("capture.path", `archive[${index}].capture_path`, "must identify a file"));
    }
  }
}

export async function loadEvidenceBundle(rootDir) {
  const entries = await Promise.all(Object.entries(DATA_FILES).map(async ([key, relativePath]) => {
    const text = await readFile(path.join(rootDir, relativePath), "utf8");
    return [key, JSON.parse(text)];
  }));
  return Object.fromEntries(entries);
}

export function validateEvidenceBundle(bundle, { rootDir = process.cwd() } = {}) {
  const errors = [];
  const collections = {
    archive: recordsFor(bundle.archive, "records"),
    lineages: recordsFor(bundle.lineages, "lineages"),
    formats: recordsFor(bundle.formats, "formats"),
    disputes: recordsFor(bundle.disputes, "disputes"),
    games: recordsFor(bundle.games, "games")
  };
  checkSchemaVersions(bundle, errors);
  checkContainerShapes(bundle, errors);
  checkUniqueIds(collections, errors);
  checkArchive(collections.archive, errors);
  const archiveIds = new Set(collections.archive.map(record => record?.id).filter(nonEmptyString));
  const lineageIds = new Set(collections.lineages.map(record => record?.id).filter(nonEmptyString));
  const formatIds = new Set(collections.formats.map(record => record?.id).filter(nonEmptyString));
  const disputeIds = new Set(collections.disputes.map(record => record?.id).filter(nonEmptyString));
  checkLineages(collections.lineages, archiveIds, disputeIds, errors);
  checkFormats(collections.formats, archiveIds, lineageIds, errors);
  checkDisputes(collections.disputes, archiveIds, new Set([...lineageIds, ...formatIds]), errors);
  checkGames(collections.games, archiveIds, lineageIds, formatIds, errors);
  checkCaptures(collections.archive, rootDir, errors);
  return errors;
}

export async function scanProductionFiles(rootDir) {
  const errors = [];
  const discovered = [...PRODUCTION_FILES];
  for (const [directory, extension] of [["data", ".json"], ["js", ".js"]]) {
    try {
      const entries = await readdir(path.join(rootDir, directory), { withFileTypes: true });
      discovered.push(...entries.filter(entry => entry.isFile() && entry.name.endsWith(extension)).map(entry => `${directory}/${entry.name}`));
    } catch {
      // A missing production directory will be reported by the relevant build tests.
    }
  }
  for (const relativePath of [...new Set(discovered)]) {
    let text;
    try {
      text = await readFile(path.join(rootDir, relativePath), "utf8");
    } catch {
      continue;
    }
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.expression.test(text)) errors.push(issue(pattern.code, relativePath, `contains ${pattern.label}`));
    }
  }
  return errors;
}

export async function validateRepository(rootDir) {
  const bundle = await loadEvidenceBundle(rootDir);
  const errors = validateEvidenceBundle(bundle, { rootDir });
  errors.push(...await scanProductionFiles(rootDir));
  return { bundle, errors };
}

async function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { bundle, errors } = await validateRepository(rootDir);
  if (errors.length > 0) {
    errors.forEach(error => console.error(`${error.code} ${error.path}: ${error.message}`));
    process.exitCode = 1;
    return;
  }
  const counts = {
    archive: recordsFor(bundle.archive, "records").length,
    lineages: recordsFor(bundle.lineages, "lineages").length,
    formats: recordsFor(bundle.formats, "formats").length,
    disputes: recordsFor(bundle.disputes, "disputes").length,
    games: recordsFor(bundle.games, "games").length
  };
  console.log(`Frontier validation passed (${counts.archive} archive records, ${counts.lineages} lineages, ${counts.formats} formats, ${counts.disputes} disputes, ${counts.games} games)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
