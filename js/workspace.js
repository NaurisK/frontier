const DEFAULT_SEED_KEYS = [
  "lineage:micro-macro",
  "lineage:yomi-reads",
  "format:frame-data"
];

const ATTRIBUTION_NOTE =
  "Built with Frontier. Preserve the source credits and attribution attached to each original archive entry when reusing this comparison.";

function clonePortableEntry(entry) {
  return {
    key: entry.key,
    type: entry.type,
    id: entry.id,
    name: entry.name,
    makes_visible: [...entry.makes_visible],
    simplifies: [...entry.simplifies]
  };
}

function portableEntry(record, type) {
  return {
    key: `${type}:${record.id}`,
    type,
    id: record.id,
    name: record.name,
    makes_visible: [...record.makes_visible],
    simplifies: [...record.simplifies]
  };
}

function normalizeKey(typeOrKey, id) {
  if (typeof typeOrKey === "object" && typeOrKey !== null) {
    return `${typeOrKey.type}:${typeOrKey.id}`;
  }
  return id === undefined ? String(typeOrKey) : `${typeOrKey}:${id}`;
}

export function createWorkspacePool(data) {
  return [
    ...(data.lineages ?? []).map(record => portableEntry(record, "lineage")),
    ...(data.formats ?? []).map(record => portableEntry(record, "format"))
  ];
}

export function seedWorkspace(pool, seedKeys = DEFAULT_SEED_KEYS) {
  const byKey = new Map(pool.map(entry => [entry.key, entry]));
  return seedKeys
    .map(key => byKey.get(normalizeKey(key)))
    .filter(Boolean)
    .map(clonePortableEntry);
}

export function addEntry(rows, pool, typeOrKey, id) {
  const key = normalizeKey(typeOrKey, id);
  const nextRows = rows.map(clonePortableEntry);
  if (nextRows.some(entry => entry.key === key)) return nextRows;

  const entry = pool.find(candidate => candidate.key === key);
  if (entry) nextRows.push(clonePortableEntry(entry));
  return nextRows;
}

export function removeEntry(rows, typeOrKey, id) {
  const key = normalizeKey(typeOrKey, id);
  return rows.filter(entry => entry.key !== key).map(clonePortableEntry);
}

export function clearWorkspace() {
  return [];
}

export function buildExportPayload(rows, { now = new Date() } = {}) {
  const generatedAt = now instanceof Date ? now : new Date(now);
  return {
    schema_version: "1.0",
    tool: "frontier-comparison",
    generated_at: generatedAt.toISOString(),
    attribution_note: ATTRIBUTION_NOTE,
    entries: rows.map(clonePortableEntry)
  };
}

export function announceStatus(statusNode, message) {
  if (!statusNode) return;
  statusNode.setAttribute?.("role", "status");
  statusNode.setAttribute?.("aria-live", "polite");
  statusNode.setAttribute?.("aria-atomic", "true");
  statusNode.textContent = message;
}

export function downloadWorkspaceJSON(rows, {
  documentRef = globalThis.document,
  BlobCtor = globalThis.Blob,
  urlApi = globalThis.URL,
  setTimer = globalThis.setTimeout?.bind(globalThis),
  statusNode = null,
  now = new Date()
} = {}) {
  if (!documentRef || !BlobCtor || !urlApi || !setTimer) {
    throw new Error("Browser download APIs are unavailable.");
  }

  const payload = buildExportPayload(rows, { now });
  const blob = new BlobCtor([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const objectUrl = urlApi.createObjectURL(blob);
  let failure = null;
  try {
    const link = documentRef.createElement("a");
    link.href = objectUrl;
    link.download = "frontier-comparison.json";
    try {
      documentRef.body.appendChild(link);
      link.click();
    } finally {
      link.remove?.();
    }
  } catch (error) {
    failure = error;
  }

  try {
    setTimer(() => urlApi.revokeObjectURL(objectUrl), 1000);
  } catch (error) {
    try {
      urlApi.revokeObjectURL(objectUrl);
    } finally {
      if (!failure) failure = error;
    }
  }
  if (failure) throw failure;
  announceStatus(statusNode, "Comparison exported as JSON.");
  return payload;
}

function appendTextCell(documentRef, row, text, className = "") {
  const cell = documentRef.createElement("td");
  if (className) cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}

export function createWorkspaceController({
  data,
  trayNode,
  matrixNode,
  exportButton,
  clearButton,
  statusNode,
  documentRef = globalThis.document,
  downloadOptions = {}
}) {
  if (!trayNode || !matrixNode || !exportButton || !clearButton || !documentRef) {
    throw new Error("Workspace controls are incomplete.");
  }

  const pool = createWorkspacePool(data);
  let rows = seedWorkspace(pool);
  let dynamicCleanups = [];

  function clearDynamicListeners() {
    dynamicCleanups.forEach(cleanup => cleanup());
    dynamicCleanups = [];
  }

  function render() {
    clearDynamicListeners();
    trayNode.replaceChildren();
    for (const entry of pool) {
      const inWorkspace = rows.some(row => row.key === entry.key);
      const button = documentRef.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = `+ ${entry.name}`;
      button.disabled = inWorkspace;
      button.setAttribute("aria-label", `Add ${entry.name} to comparison`);
      const onAdd = () => {
        rows = addEntry(rows, pool, entry.key);
        announceStatus(statusNode, `${entry.name} added to comparison.`);
        render();
      };
      button.addEventListener("click", onAdd);
      dynamicCleanups.push(() => button.removeEventListener("click", onAdd));
      trayNode.appendChild(button);
    }

    matrixNode.replaceChildren();
    if (rows.length === 0) {
      const empty = documentRef.createElement("p");
      empty.className = "matrix-empty";
      empty.textContent = "Empty comparison. Add frameworks or formats from the tray above.";
      matrixNode.appendChild(empty);
      return;
    }

    const table = documentRef.createElement("table");
    table.className = "matrix";
    const head = documentRef.createElement("thead");
    head.innerHTML = `<tr>
      <th scope="col">Entry</th>
      <th scope="col">Makes visible</th>
      <th scope="col">Simplifies / conceals</th>
      <th scope="col" aria-label="Remove entries"></th>
    </tr>`;
    table.appendChild(head);

    const body = documentRef.createElement("tbody");
    for (const entry of rows) {
      const row = documentRef.createElement("tr");
      const nameCell = appendTextCell(documentRef, row, entry.name, "name");
      const typeLabel = documentRef.createElement("span");
      typeLabel.className = "prov-meta";
      typeLabel.textContent = entry.type;
      nameCell.appendChild(documentRef.createElement("br"));
      nameCell.appendChild(typeLabel);
      appendTextCell(documentRef, row, entry.makes_visible.join(", "));
      appendTextCell(documentRef, row, entry.simplifies.join(", "));

      const actionCell = documentRef.createElement("td");
      const removeButton = documentRef.createElement("button");
      removeButton.type = "button";
      removeButton.className = "drop";
      removeButton.textContent = "remove";
      removeButton.setAttribute("aria-label", `Remove ${entry.name}`);
      const onRemove = () => {
        rows = removeEntry(rows, entry.key);
        announceStatus(statusNode, `${entry.name} removed from comparison.`);
        render();
      };
      removeButton.addEventListener("click", onRemove);
      dynamicCleanups.push(() => removeButton.removeEventListener("click", onRemove));
      actionCell.appendChild(removeButton);
      row.appendChild(actionCell);
      body.appendChild(row);
    }
    table.appendChild(body);
    matrixNode.appendChild(table);
  }

  function clear() {
    rows = clearWorkspace(rows);
    announceStatus(statusNode, "Comparison cleared.");
    render();
  }

  function exportRows() {
    return downloadWorkspaceJSON(rows, {
      ...downloadOptions,
      documentRef,
      statusNode
    });
  }

  function destroy() {
    clearDynamicListeners();
    clearButton.removeEventListener("click", clear);
    exportButton.removeEventListener("click", exportRows);
  }

  clearButton.addEventListener("click", clear);
  exportButton.addEventListener("click", exportRows);
  announceStatus(statusNode, "Workspace ready.");
  render();

  return {
    render,
    clear,
    exportRows,
    destroy,
    getRows: () => rows.map(clonePortableEntry)
  };
}

export function initWorkspace(data, {
  documentRef = globalThis.document,
  downloadOptions = {}
} = {}) {
  if (!documentRef) throw new Error("A document is required to initialise the workspace.");
  return createWorkspaceController({
    data,
    trayNode: documentRef.getElementById("ws-tray"),
    matrixNode: documentRef.getElementById("ws-matrix"),
    exportButton: documentRef.getElementById("ws-export"),
    clearButton: documentRef.getElementById("ws-clear"),
    statusNode: documentRef.getElementById("ws-status"),
    documentRef,
    downloadOptions
  });
}
