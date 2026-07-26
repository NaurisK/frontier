export const DATA_PATHS = Object.freeze({
  archive: "./data/archive_index.json",
  lineages: "./data/lineages.json",
  formats: "./data/formats.json",
  disputes: "./data/disputes.json",
  games: "./data/games.json"
});

export async function loadJson(path, fetchFn = globalThis.fetch) {
  if (typeof fetchFn !== "function") {
    throw new TypeError("A fetch function is required to load Frontier data.");
  }
  const response = await fetchFn(path);
  if (!response?.ok) {
    const status = response?.status ?? "unknown";
    const statusText = response?.statusText ? ` ${response.statusText}` : "";
    throw new Error(`Failed to load ${path}: ${status}${statusText}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse ${path}: ${error.message}`, { cause: error });
  }
}

function indexRecords(records) {
  return new Map(records.map(record => [record.id, record]));
}

export async function loadAllData(fetchFn = globalThis.fetch) {
  const [archiveDocument, lineageDocument, formatDocument, disputeDocument, gameDocument] =
    await Promise.all([
      loadJson(DATA_PATHS.archive, fetchFn),
      loadJson(DATA_PATHS.lineages, fetchFn),
      loadJson(DATA_PATHS.formats, fetchFn),
      loadJson(DATA_PATHS.disputes, fetchFn),
      loadJson(DATA_PATHS.games, fetchFn)
    ]);

  const archive = archiveDocument.records ?? [];
  const lineages = lineageDocument.lineages ?? [];
  const formats = formatDocument.formats ?? [];
  const disputes = disputeDocument.disputes ?? [];
  const games = gameDocument.games ?? [];

  return {
    schema_version: archiveDocument.schema_version,
    corpus: archiveDocument.corpus ?? {},
    archive,
    lineages,
    formats,
    disputes,
    games,
    index: {
      archive: indexRecords(archive),
      lineages: indexRecords(lineages),
      formats: indexRecords(formats),
      disputes: indexRecords(disputes),
      games: indexRecords(games)
    }
  };
}
