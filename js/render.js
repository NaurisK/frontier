import {
  displayDate,
  escapeHtml,
  evidenceLabel,
  getArchiveRecords,
  relationLabel,
  uniqueArchiveIds
} from "./utils.js";

function list(items, className = "") {
  const classes = className ? ` class="${className}"` : "";
  return `<ul${classes}>${(items ?? [])
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function evidenceBadge(status) {
  const safeStatus = escapeHtml(status || "unknown");
  return `<span class="ev ev-${safeStatus}">${escapeHtml(evidenceLabel(status))}</span>`;
}

function tradeOff(record) {
  return `<div class="vs-split">
    <section class="vs-col vs-visible">
      <h4>Makes visible</h4>
      ${list(record.makes_visible)}
    </section>
    <section class="vs-col vs-simplifies">
      <h4>Simplifies</h4>
      ${list(record.simplifies)}
    </section>
  </div>`;
}

function archiveFigure(archive, { compact = false } = {}) {
  if (!archive) return "";
  const sourceDate = escapeHtml(displayDate(archive.source_date));
  const captureDate = escapeHtml(displayDate(archive.capture_date));
  const source = archive.source_url
    ? `<a href="${escapeHtml(archive.source_url)}" rel="noreferrer">${escapeHtml(archive.title)}</a>`
    : escapeHtml(archive.title);
  return `<figure class="capture${compact ? " capture-compact" : ""}">
    <img src="./${escapeHtml(archive.capture_path)}" alt="${escapeHtml(archive.alt)}" loading="lazy">
    <figcaption>
      <span class="capture-credit">${escapeHtml(archive.credit)}</span>
      <span class="capture-meta">${source} · Source date: ${sourceDate} · Capture date: ${captureDate}</span>
    </figcaption>
  </figure>`;
}

function archiveMetadata(archive) {
  const sourceTitle = archive.source_url
    ? `<a href="${escapeHtml(archive.source_url)}" rel="noreferrer">${escapeHtml(archive.title)}</a>`
    : escapeHtml(archive.title);
  return `<article class="source-record">
    <h4>${sourceTitle}</h4>
    <dl class="metadata">
      <div><dt>Creator</dt><dd>${escapeHtml(archive.creator)}</dd></div>
      <div><dt>Platform</dt><dd>${escapeHtml(archive.platform)}</dd></div>
      <div><dt>Source type</dt><dd>${escapeHtml(archive.source_type)}</dd></div>
      <div><dt>Source date</dt><dd>${escapeHtml(displayDate(archive.source_date))}</dd></div>
      <div><dt>Capture date</dt><dd>${escapeHtml(displayDate(archive.capture_date))}</dd></div>
      <div><dt>Credit</dt><dd>${escapeHtml(archive.credit)}</dd></div>
    </dl>
    <p class="qualification">${escapeHtml(archive.qualification_note)}</p>
  </article>`;
}

function firstArchive(record, data) {
  return getArchiveRecords(uniqueArchiveIds(record), data)[0];
}

function renderEvidenceGallery(ids, data, heading = "Visual evidence") {
  const archives = getArchiveRecords([...new Set(ids ?? [])], data);
  if (!archives.length) return "";
  return `<section class="detail-section evidence-section">
    <h3>${escapeHtml(heading)}</h3>
    <div class="evidence-gallery">${archives.map(item => archiveFigure(item)).join("")}</div>
  </section>`;
}

function gameRelatedLinks(game, data) {
  const lineageLinks = (game.related_lineage_ids ?? []).map(id => {
    const record = data.index.lineages.get(id);
    const label = id === "yomi-reads"
      ? `${record?.name ?? id} — conceptual, interpretive context`
      : record?.name ?? id;
    return `<a href="#entry/lineage/${escapeHtml(id)}">${escapeHtml(label)}</a>`;
  });
  const formatLinks = (game.related_format_ids ?? []).map(id => {
    const record = data.index.formats.get(id);
    return `<a href="#entry/format/${escapeHtml(id)}">${escapeHtml(record?.name ?? id)}</a>`;
  });
  const links = [...lineageLinks, ...formatLinks];
  return links.length
    ? `<nav class="game-links" aria-label="Related Frontier entries">${links.join("")}</nav>`
    : "";
}

export function renderGames(data) {
  return (data.games ?? []).map(game => {
    const archives = getArchiveRecords(game.archive_ids, data);
    const evidence = archives.map(archive => `${archiveFigure(archive)}
      <p class="qualification">${escapeHtml(archive.qualification_note)}</p>`).join("");
    const genre = game.genre ? ` · ${escapeHtml(game.genre)}` : "";
    return `<article class="card game-card" id="game-${escapeHtml(game.id)}">
      <p class="eyebrow">${escapeHtml(game.scope_label)}${genre}</p>
      <h3>${escapeHtml(game.name)}</h3>
      <p class="interpretive-label">Frontier interpretive synthesis</p>
      <dl class="game-context">
        <div><dt>In play</dt><dd>${escapeHtml(game.play_problem)}</dd></div>
        <div><dt>Player question</dt><dd>${escapeHtml(game.player_question)}</dd></div>
        <div><dt>Visual reduction</dt><dd>${escapeHtml(game.reduction)}</dd></div>
        <div><dt>Supports</dt><dd>${escapeHtml(game.supported_action)}</dd></div>
      </dl>
      <div class="game-evidence">${evidence}</div>
      ${gameRelatedLinks(game, data)}
    </article>`;
  }).join("");
}

export function renderOverviewCard(record, type, data) {
  const archive = firstArchive(record, data);
  const typeLabel = type === "lineage" ? "Framework lineage" : "Visual format";
  return `<article class="card ${escapeHtml(type)}-card" id="${escapeHtml(type)}-${escapeHtml(record.id)}">
    <p class="eyebrow">${typeLabel}</p>
    <h3>${escapeHtml(record.name)}</h3>
    ${archiveFigure(archive, { compact: true })}
    <p>${escapeHtml(record.summary)}</p>
    ${tradeOff(record)}
    <a class="entry-link" href="#entry/${escapeHtml(type)}/${escapeHtml(record.id)}">Open evidence-qualified detail <span aria-hidden="true">→</span></a>
  </article>`;
}

function archiveReferenceList(ids, data) {
  const records = getArchiveRecords(ids, data);
  if (!records.length) return "";
  return `<ul class="source-links">${records.map(record => {
    const title = record.source_url
      ? `<a href="${escapeHtml(record.source_url)}" rel="noreferrer">${escapeHtml(record.title)}</a>`
      : escapeHtml(record.title);
    return `<li>${title} <span class="prov-meta">Source date: ${escapeHtml(displayDate(record.source_date))}; capture date: ${escapeHtml(displayDate(record.capture_date))}</span></li>`;
  }).join("")}</ul>`;
}

function renderProvenance(record, data) {
  return `<section class="detail-section">
    <h3>Provenance</h3>
    <ol class="provenance">${record.provenance.map(item => `<li class="prov-node">
      <div class="prov-head">
        <strong>${escapeHtml(relationLabel(item.relation_type))}</strong>
        ${evidenceBadge(item.evidence_status)}
      </div>
      <p>${escapeHtml(item.claim)}</p>
      ${archiveReferenceList(item.archive_ids, data)}
    </li>`).join("")}</ol>
  </section>`;
}

function renderConnections(record, data) {
  if (!record.connections?.length) return "";
  return `<section class="detail-section">
    <h3>Connections and qualifications</h3>
    <div class="connection-list">${record.connections.map(item => {
      const target = data.index.lineages.get(item.target_id);
      const targetName = target?.name ?? item.target_id;
      return `<article class="connection">
        <div class="prov-head">
          <h4><a href="#entry/lineage/${escapeHtml(item.target_id)}">${escapeHtml(targetName)}</a></h4>
          <span class="relation-label">${escapeHtml(relationLabel(item.relation_type))}</span>
          ${evidenceBadge(item.evidence_status)}
        </div>
        <p>${escapeHtml(item.claim)}</p>
        <p class="qualification"><strong>Qualification:</strong> ${escapeHtml(item.qualification)}</p>
        ${archiveReferenceList(item.archive_ids, data)}
      </article>`;
    }).join("")}</div>
  </section>`;
}

function renderVersionHistory(record, data) {
  return `<section class="detail-section">
    <h3>Selected history and comparisons</h3>
    <ol class="version-history">${record.version_history.map(item => `<li>
      <div class="prov-head">${evidenceBadge(item.evidence_status)}</div>
      <p>${escapeHtml(item.label)}</p>
      ${archiveReferenceList(item.archive_ids, data)}
    </li>`).join("")}</ol>
  </section>`;
}

function disputesFor(record, data) {
  const explicit = (record.dispute_ids ?? [])
    .map(id => data.index.disputes.get(id))
    .filter(Boolean);
  if (explicit.length) return explicit;
  return data.disputes.filter(dispute => dispute.attached_to?.includes(record.id));
}

function renderDisputes(record, data) {
  const disputes = disputesFor(record, data);
  if (!disputes.length) return "";
  return `<section class="detail-section">
    <h3>Community dispute and reuse</h3>
    <div class="disputes">${disputes.map(dispute => {
      const excerpt = dispute.paraphrased
        ? `<p class="dispute-excerpt">${escapeHtml(dispute.excerpt)}</p>`
        : `<q>${escapeHtml(dispute.excerpt)}</q>`;
      return `<article class="dispute">
      <div class="prov-head">
        <span class="part-tag">${escapeHtml(dispute.participation)}</span>
        ${evidenceBadge(dispute.evidence_status)}
      </div>
      ${excerpt}
      <p class="ethics-flags">${dispute.paraphrased ? "Paraphrased" : "Quoted"} · ${dispute.anonymised ? "Anonymised" : "Named public source"}</p>
      <div class="dispute-dates" aria-label="Community contribution dates">
        <p><strong>Community source date:</strong> ${escapeHtml(displayDate(dispute.source_date))}</p>
        <p><strong>Community source/capture window:</strong> ${escapeHtml(displayDate(dispute.source_capture_window))}</p>
        <p><strong>Local netnography capture date:</strong> ${escapeHtml(displayDate(dispute.capture_date))}</p>
      </div>
      <p class="note">${escapeHtml(dispute.note)}</p>
      ${archiveReferenceList(dispute.archive_ids, data)}
    </article>`;
    }).join("")}</div>
  </section>`;
}

function renderSourceSection(record, data) {
  const archives = getArchiveRecords(uniqueArchiveIds(record), data);
  return `<section class="detail-section">
    <h3>Source records</h3>
    <div class="source-grid">${archives.map(archiveMetadata).join("")}</div>
  </section>`;
}

function renderLineageDetail(record, data) {
  const archiveIds = uniqueArchiveIds(record);
  return `<article class="entry-view">
    <p class="eyebrow">Framework lineage</p>
    <h2 data-route-heading tabindex="-1">${escapeHtml(record.name)}</h2>
    <p class="lead">${escapeHtml(record.summary)}</p>
    ${renderEvidenceGallery(archiveIds, data)}
    ${tradeOff(record)}
    ${renderProvenance(record, data)}
    ${renderConnections(record, data)}
    ${renderVersionHistory(record, data)}
    ${renderDisputes(record, data)}
    ${renderSourceSection(record, data)}
  </article>`;
}

function renderFormatDetail(record, data) {
  const archiveIds = uniqueArchiveIds(record);
  const related = record.related_lineage_ids
    .map(id => data.index.lineages.get(id))
    .filter(Boolean);
  return `<article class="entry-view">
    <p class="eyebrow">Visual format</p>
    <h2 data-route-heading tabindex="-1">${escapeHtml(record.name)}</h2>
    <p class="lead">${escapeHtml(record.summary)}</p>
    ${renderEvidenceGallery(archiveIds, data)}
    ${tradeOff(record)}
    <section class="detail-section">
      <h3>Cross-game reading</h3>
      <p>${escapeHtml(record.cross_game)}</p>
    </section>
    <section class="detail-section">
      <h3>Related lineages</h3>
      <ul class="source-links">${related.map(lineage =>
        `<li><a href="#entry/lineage/${escapeHtml(lineage.id)}">${escapeHtml(lineage.name)}</a></li>`
      ).join("")}</ul>
    </section>
    ${renderDisputes(record, data)}
    ${renderSourceSection(record, data)}
  </article>`;
}

export function renderEntryDetail(view, data) {
  if (view.entryType === "lineage") return renderLineageDetail(view.record, data);
  if (view.entryType === "format") return renderFormatDetail(view.record, data);
  return renderNotFound({
    heading: "Entry not found",
    message: "The requested entry type is not part of this corpus."
  });
}

const COMPARISON_PROMPTS = [
  {
    label: "What kind of skill is externalised?",
    answer: (record) => record.makes_visible.join("; ")
  },
  {
    label: "What appears authoritative?",
    answer: (_record, archive) => archive
      ? `${archive.creator}; ${archive.source_type} on ${archive.platform}`
      : "No source record is available."
  },
  {
    label: "What must the viewer already know?",
    answer: (record, _archive, type) =>
      `The domain vocabulary and conventions used by this ${type === "lineage" ? "framework lineage" : "visual format"}.`
  },
  {
    label: "What uncertainty is removed?",
    answer: (record) => record.simplifies.join("; ")
  },
  {
    label: "What action is the viewer invited to take?",
    answer: (_record, _archive, type) => type === "lineage"
      ? "Trace, compare and qualify the represented connections."
      : "Inspect and use the selected features while retaining the stated limits."
  }
];

function comparisonItem(record, type, data) {
  return {
    record,
    type,
    archive: firstArchive(record, data)
  };
}

export function renderComparison(data) {
  const items = [
    comparisonItem(data.index.lineages.get("surnex-playertype"), "lineage", data),
    ...["frame-data", "build-order", "callout-map"]
      .map(id => comparisonItem(data.index.formats.get(id), "format", data))
  ].filter(item => item.record);

  return `<div class="table-scroll" tabindex="0" role="region" aria-label="Curated comparison table">
    <table class="comparison-table">
      <thead><tr>
        <th scope="col">Analytical prompt</th>
        ${items.map(item => `<th scope="col">${escapeHtml(item.record.name)}</th>`).join("")}
      </tr></thead>
      <tbody>${COMPARISON_PROMPTS.map(prompt => `<tr>
        <th scope="row">${escapeHtml(prompt.label)}</th>
        ${items.map(item => `<td>${escapeHtml(prompt.answer(item.record, item.archive, item.type))}</td>`).join("")}
      </tr>`).join("")}</tbody>
    </table>
  </div>
  <p class="qualification">Frontier treats these answers as structured visual-analysis prompts, not objective measurements of the games or communities represented.</p>`;
}

export function renderNotFound(view) {
  return `<section class="route-message" role="status">
    <h2 data-route-heading tabindex="-1">${escapeHtml(view.heading)}</h2>
    <p>${escapeHtml(view.message)}</p>
    <p><a href="#home">Return to Frontier home</a></p>
  </section>`;
}

export function renderFatalError(view) {
  return `<section class="route-message fatal-error" role="${escapeHtml(view.role || "alert")}">
    <h1 data-route-heading tabindex="-1">${escapeHtml(view.heading)}</h1>
    <p>${escapeHtml(view.message)}</p>
    <p>Reload the page to try again. If the problem remains, use the submitted fallback or repository documentation.</p>
  </section>`;
}
