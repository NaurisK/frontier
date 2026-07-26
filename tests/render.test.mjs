import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  renderComparison,
  renderEntryDetail,
  renderFatalError,
  renderGames,
  renderOverviewCard
} from "../js/render.js";

const archive = {
  id: "ARC-1",
  title: "Source <table>",
  creator: "Creator & contributors",
  platform: "Community wiki",
  source_type: "visual guide",
  source_date: "2024-03-01",
  capture_date: "2026-07-25",
  source_url: "https://example.test/source?a=1&b=2",
  capture_path: "assets/captures/example.png",
  alt: "A meaningful <capture> description",
  credit: "Creator & contributors",
  qualification_note: "This capture documents a version, not an origin claim."
};

const dispute = {
  id: "DIS-1",
  excerpt: "A viewer disputes <certainty>.",
  participation: "dispute",
  evidence_status: "interpretive",
  attached_to: ["lineage-1", "format-1"],
  archive_ids: ["ARC-1"],
  subject_archive_ids: ["ARC-1"],
  source_date: null,
  capture_date: "2026-07-25",
  source_capture_window: "2026-07-25",
  paraphrased: true,
  anonymised: true,
  note: "Paraphrased & anonymised."
};

const lineage = {
  id: "lineage-1",
  name: "Lineage <one>",
  summary: "Summary & qualification.",
  makes_visible: ["timing <exact>"],
  simplifies: ["pressure & context"],
  provenance: [{
    claim: "A documented <claim>.",
    relation_type: "earlier_documented_use",
    evidence_status: "documented",
    archive_ids: ["ARC-1"]
  }],
  connections: [{
    target_id: "lineage-2",
    relation_type: "possible_relation",
    evidence_status: "interpretive",
    archive_ids: ["ARC-1"],
    claim: "A possible relation.",
    qualification: "No direct influence is claimed."
  }],
  version_history: [{
    label: "A documented version.",
    evidence_status: "documented",
    archive_ids: ["ARC-1"]
  }],
  dispute_ids: ["DIS-1"]
};

const relatedLineage = {
  ...lineage,
  id: "lineage-2",
  name: "Related lineage",
  connections: [],
  dispute_ids: []
};

const format = {
  id: "format-1",
  name: "Format <one>",
  summary: "A visual format.",
  archive_ids: ["ARC-1"],
  makes_visible: ["a selected feature"],
  simplifies: ["uncertainty"],
  cross_game: "The grammar travels, with qualifications.",
  related_lineage_ids: ["lineage-1"]
};

const comparisonFormats = [
  {
    ...format,
    id: "frame-data",
    name: "Frame data",
    makes_visible: ["timing"],
    simplifies: ["spacing"]
  },
  {
    ...format,
    id: "build-order",
    name: "Build order",
    makes_visible: ["sequence"],
    simplifies: ["adaptation"]
  },
  {
    ...format,
    id: "callout-map",
    name: "Callout map",
    makes_visible: ["locations"],
    simplifies: ["intent"]
  }
];

const game = {
  id: "game-1",
  name: "Fixture <game>",
  scope_label: "Fixture <scope>",
  genre: "test & strategy",
  play_problem: "Reading <danger> & timing.",
  player_question: "What <now>?",
  reduction: "fixture reduction",
  supported_action: "Choose & respond.",
  interpretive_synthesis: true,
  archive_ids: ["ARC-1"],
  related_lineage_ids: ["lineage-1"],
  related_format_ids: ["format-1"]
};

const data = {
  archive: [archive],
  corpus: {
    capture_window: "June–July 2026",
    item_count: 62,
    platform_count: 7,
    selection_criteria: ["Public, attributable material"],
    exclusion_criteria: ["Private material"],
    reflexive_note: "The author shaped this purposive corpus."
  },
  lineages: [
    lineage,
    relatedLineage,
    {
      ...lineage,
      id: "surnex-playertype",
      name: "Surnex to Player Type",
      connections: [],
      dispute_ids: []
    }
  ],
  formats: [format, ...comparisonFormats],
  disputes: [dispute],
  games: [game],
  index: {
    archive: new Map([["ARC-1", archive]]),
    lineages: new Map([
      ["lineage-1", lineage],
      ["lineage-2", relatedLineage],
      ["surnex-playertype", {
        ...lineage,
        id: "surnex-playertype",
        name: "Surnex to Player Type",
        connections: [],
        dispute_ids: []
      }]
    ]),
    formats: new Map([[format.id, format], ...comparisonFormats.map(item => [item.id, item])]),
    disputes: new Map([["DIS-1", dispute]]),
    games: new Map([[game.id, game]])
  }
};

async function loadCanonicalRenderData() {
  const [archiveDocument, lineageDocument, formatDocument, disputeDocument, gameDocument] = await Promise.all([
    "archive_index.json",
    "lineages.json",
    "formats.json",
    "disputes.json",
    "games.json"
  ].map(async file => JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), "utf8"))));
  const archiveRecords = archiveDocument.records;
  const lineages = lineageDocument.lineages;
  const formats = formatDocument.formats;
  const disputes = disputeDocument.disputes;
  const games = gameDocument.games;
  return {
    archive: archiveRecords,
    corpus: archiveDocument.corpus,
    lineages,
    formats,
    disputes,
    games,
    index: {
      archive: new Map(archiveRecords.map(record => [record.id, record])),
      lineages: new Map(lineages.map(record => [record.id, record])),
      formats: new Map(formats.map(record => [record.id, record])),
      disputes: new Map(disputes.map(record => [record.id, record])),
      games: new Map(games.map(record => [record.id, record]))
    }
  };
}

test("the shared render fixture exposes games and its game index", () => {
  assert.equal(data.games.length, 1);
  assert.equal(data.index.games.get("game-1").name, "Fixture <game>");
});

test("canonical render data loads games and its game index", async () => {
  const canonical = await loadCanonicalRenderData();
  assert.equal(canonical.games.length, 5);
  assert.equal(canonical.index.games.get("cross-game-classification").name, "Cross-game classification");
});

test("games render semantic, escaped and qualified evidence cards", () => {
  const html = renderGames(data);

  assert.equal((html.match(/<article\b/gu) ?? []).length, 1);
  assert.match(html, /<h3>Fixture &lt;game&gt;<\/h3>/u);
  assert.match(html, /Fixture &lt;scope&gt;/u);
  assert.match(html, /test &amp; strategy/u);
  assert.match(html, /Frontier interpretive synthesis/u);
  assert.match(html, /Reading &lt;danger&gt; &amp; timing\./u);
  assert.match(html, /What &lt;now&gt;\?/u);
  assert.match(html, /Choose &amp; respond\./u);
  assert.match(html, /<figure\b/u);
  assert.match(html, /alt="A meaningful &lt;capture&gt; description"/u);
  assert.match(html, /Creator &amp; contributors/u);
  assert.match(html, /Source date:\s*2024-03-01/u);
  assert.match(html, /Capture date:\s*2026-07-25/u);
  assert.match(
    html,
    /<\/figure>\s*<p class="qualification">This capture documents a version, not an origin claim\.<\/p>/u
  );
  assert.match(html, /href="#entry\/lineage\/lineage-1"/u);
  assert.match(html, /href="#entry\/format\/format-1"/u);
});

test("canonical games render five cases, both cross-game captures and conceptual Yomi context", async () => {
  const canonical = await loadCanonicalRenderData();
  const html = renderGames(canonical);

  assert.equal((html.match(/<article\b[^>]*class="[^"]*game-card/gu) ?? []).length, 5);
  assert.equal((html.match(/Frontier interpretive synthesis/gu) ?? []).length, 5);
  for (const record of canonical.games) {
    assert.match(html, new RegExp(`id="game-${record.id}"`, "u"));
    for (const archiveId of record.archive_ids) {
      const archiveRecord = canonical.index.archive.get(archiveId);
      assert.match(html, new RegExp(archiveRecord.capture_path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
      const escapedQualification = archiveRecord.qualification_note
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
      assert.match(html, new RegExp(escapedQualification.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    }
  }
  assert.equal((html.match(/assets\/captures\/surnex-diagram\.png/gu) ?? []).length, 1);
  assert.equal((html.match(/assets\/captures\/player-type-methodology\.png/gu) ?? []).length, 1);
  assert.match(
    html,
    /href="#entry\/lineage\/yomi-reads"[^>]*>[^<]*(?:conceptual)[^<]*(?:interpretive)|href="#entry\/lineage\/yomi-reads"[^>]*>[^<]*(?:interpretive)[^<]*(?:conceptual)/iu
  );
});

test("overview cards expose escaped evidence, visual credit, dates and trade-offs", () => {
  const html = renderOverviewCard(lineage, "lineage", data);

  assert.match(html, /Lineage &lt;one&gt;/u);
  assert.doesNotMatch(html, /Lineage <one>/u);
  assert.match(html, /src="\.\/assets\/captures\/example\.png"/u);
  assert.match(html, /alt="A meaningful &lt;capture&gt; description"/u);
  assert.match(html, /Creator &amp; contributors/u);
  assert.match(html, /Source date/u);
  assert.match(html, /2024-03-01/u);
  assert.match(html, /Capture date/u);
  assert.match(html, /2026-07-25/u);
  assert.doesNotMatch(html, /class="card-status"/u);
  assert.doesNotMatch(html, /Documented evidence/u);
  assert.match(html, /Makes visible/u);
  assert.match(html, /Simplifies/u);
  assert.match(html, /href="#entry\/lineage\/lineage-1"/u);
  assert.doesNotMatch(html, /\bid="lineage-1-(?:visible|simplifies)"/u);
});

test("lineage detail shows provenance, qualified connections, versions and disputes", () => {
  const html = renderEntryDetail({ entryType: "lineage", record: lineage }, data);
  const visibleText = html.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");

  assert.match(html, /Provenance/u);
  assert.match(html, /Earlier documented use/u);
  assert.match(html, /Documented evidence/u);
  assert.match(html, /Connections and qualifications/u);
  assert.match(html, /Possible relation/u);
  assert.match(html, /Interpretive claim/u);
  assert.match(html, /No direct influence is claimed/u);
  assert.match(html, /Selected history and comparisons/u);
  assert.doesNotMatch(html, /Documented version history/u);
  assert.match(html, /Community dispute and reuse/u);
  assert.match(html, /A viewer disputes &lt;certainty&gt;/u);
  assert.match(html, /class="dispute-excerpt"/u);
  assert.doesNotMatch(html, /<q>A viewer disputes/iu);
  assert.match(html, /Paraphrased/u);
  assert.match(html, /Anonymised/u);
  assert.match(visibleText, /Community source date:\s*Not established/u);
  assert.match(visibleText, /Community source\/capture window:\s*2026-07-25/u);
  assert.match(visibleText, /Local netnography capture date:\s*2026-07-25/u);
  assert.match(html, /Source date/u);
  assert.match(html, /Capture date/u);
  assert.match(html, /Creator &amp; contributors/u);
});

test("only non-paraphrased dispute excerpts use quotation markup", () => {
  const directQuote = { ...dispute, paraphrased: false };
  const directData = {
    ...data,
    disputes: [directQuote],
    index: {
      ...data.index,
      disputes: new Map([[directQuote.id, directQuote]])
    }
  };
  const html = renderEntryDetail({ entryType: "lineage", record: lineage }, directData);

  assert.match(html, /<q>A viewer disputes &lt;certainty&gt;\.<\/q>/u);
  assert.doesNotMatch(html, /class="dispute-excerpt"/u);
});

test("format detail shows its source visual, cross-game reading and related lineage", () => {
  const html = renderEntryDetail({ entryType: "format", record: format }, data);

  assert.match(html, /Cross-game reading/u);
  assert.match(html, /The grammar travels/u);
  assert.match(html, /Related lineages/u);
  assert.match(html, /href="#entry\/lineage\/lineage-1"/u);
  assert.match(html, /src="\.\/assets\/captures\/example\.png"/u);
  assert.match(html, /Creator &amp; contributors/u);
});

test("curated comparison includes all five stable analytical prompts", () => {
  const html = renderComparison(data);

  assert.match(
    html,
    /<div\s+class="table-scroll"\s+tabindex="0"\s+role="region"\s+aria-label="Curated comparison table">/u
  );

  for (const prompt of [
    "What kind of skill is externalised?",
    "What appears authoritative?",
    "What must the viewer already know?",
    "What uncertainty is removed?",
    "What action is the viewer invited to take?"
  ]) {
    assert.match(html, new RegExp(prompt.replace(/[?]/gu, "\\?"), "u"));
  }
  for (const name of ["Surnex to Player Type", "Frame data", "Build order", "Callout map"]) {
    assert.match(html, new RegExp(name, "u"));
  }
});

test("approved in-product visual evidence is reachable through games, lineage and format routes", async () => {
  const canonical = await loadCanonicalRenderData();
  const rendered = [
    ...canonical.lineages.map(record => renderOverviewCard(record, "lineage", canonical)),
    ...canonical.formats.map(record => renderOverviewCard(record, "format", canonical)),
    ...canonical.lineages.map(record => renderEntryDetail({ entryType: "lineage", record }, canonical)),
    ...canonical.formats.map(record => renderEntryDetail({ entryType: "format", record }, canonical)),
    renderGames(canonical)
  ].join("\n");

  for (const record of canonical.archive.filter(item => !item.id.startsWith("ARC-A1-"))) {
    assert.match(rendered, new RegExp(record.capture_path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), `${record.capture_path} is not reachable`);
  }

  const surnex = canonical.index.lineages.get("surnex-playertype");
  const lineageHtml = renderEntryDetail({ entryType: "lineage", record: surnex }, canonical);
  for (const capture of [
    "surnex-diagram.png",
    "player-type-methodology.png",
    "micro-macro-teamliquid.png",
    "yomi-sirlin.png"
  ]) {
    assert.equal(
      lineageHtml.match(new RegExp(`assets/captures/${capture.replace(".", "\\.")}`, "gu"))?.length,
      1,
      `${capture} should appear once in the Surnex/Player Type lineage gallery`
    );
  }
});

test("fatal errors render as an accessible alert rather than a blank route", () => {
  const html = renderFatalError({
    status: "error",
    role: "alert",
    heading: "Frontier could not load its archive",
    message: "Failed to load <resource>"
  });

  assert.match(html, /role="alert"/u);
  assert.match(html, /Frontier could not load its archive/u);
  assert.match(html, /Failed to load &lt;resource&gt;/u);
});

test("index loads app.js as its only module entry point", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const modules = [...html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>/giu)]
    .map(match => match[1]);

  assert.deepEqual(modules, ["./js/app.js"]);
});

test("the games grid is the only new data-driven route host", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /\bid=["']games-grid["']/iu);
  assert.doesNotMatch(html, /\bdata-(?:archive|about)-host\b/iu);
});
