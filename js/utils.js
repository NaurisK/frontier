export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

const EVIDENCE_LABELS = Object.freeze({
  documented: "Documented evidence",
  interpretive: "Interpretive claim",
  speculative: "Speculative relation"
});

const RELATION_LABELS = Object.freeze({
  earlier_documented_use: "Earlier documented use",
  community_precedent: "Community precedent",
  conceptual_precedent: "Conceptual precedent",
  later_adaptation: "Later adaptation",
  possible_relation: "Possible relation"
});

export function evidenceLabel(status) {
  return EVIDENCE_LABELS[status] ?? String(status ?? "Evidence status unavailable");
}

export function relationLabel(relation) {
  return RELATION_LABELS[relation] ?? String(relation ?? "Relation unavailable");
}

export function displayDate(value) {
  return value || "Not established";
}

export function uniqueArchiveIds(record) {
  const ids = new Set(record?.archive_ids ?? []);
  for (const field of ["provenance", "connections", "version_history"]) {
    for (const item of record?.[field] ?? []) {
      for (const id of item.archive_ids ?? []) ids.add(id);
    }
  }
  return [...ids];
}

export function getArchiveRecords(ids, data) {
  return (ids ?? [])
    .map(id => data?.index?.archive?.get(id))
    .filter(Boolean);
}
