import assert from "node:assert/strict";
import { test } from "node:test";

const workspace = await import("../js/workspace.js");

const DATA = {
  lineages: [
    {
      id: "micro-macro",
      name: "Micro / Macro",
      makes_visible: ["execution", "strategy"],
      simplifies: ["pressure"],
      provenance: [{ claim: "source-only metadata" }]
    },
    {
      id: "yomi-reads",
      name: "Yomi / Reads",
      makes_visible: ["prediction"],
      simplifies: ["execution"]
    }
  ],
  formats: [
    {
      id: "frame-data",
      name: "Frame data",
      makes_visible: ["timing"],
      simplifies: ["rhythm"],
      archive_ids: ["ARC-FRAME"]
    }
  ]
};

const PORTABLE_MICRO = {
  key: "lineage:micro-macro",
  type: "lineage",
  id: "micro-macro",
  name: "Micro / Macro",
  makes_visible: ["execution", "strategy"],
  simplifies: ["pressure"]
};

function requireExport(name) {
  assert.equal(typeof workspace[name], "function", `${name} must be exported`);
  return workspace[name];
}

test("workspace module exports the approved public API", () => {
  for (const name of [
    "createWorkspacePool",
    "seedWorkspace",
    "addEntry",
    "removeEntry",
    "clearWorkspace",
    "buildExportPayload",
    "announceStatus",
    "downloadWorkspaceJSON"
  ]) requireExport(name);
});

test("createWorkspacePool builds portable type/id keys without mutating source records", () => {
  const createWorkspacePool = requireExport("createWorkspacePool");
  const before = structuredClone(DATA);
  const pool = createWorkspacePool(DATA);

  assert.deepEqual(pool, [
    PORTABLE_MICRO,
    {
      key: "lineage:yomi-reads",
      type: "lineage",
      id: "yomi-reads",
      name: "Yomi / Reads",
      makes_visible: ["prediction"],
      simplifies: ["execution"]
    },
    {
      key: "format:frame-data",
      type: "format",
      id: "frame-data",
      name: "Frame data",
      makes_visible: ["timing"],
      simplifies: ["rhythm"]
    }
  ]);
  assert.deepEqual(DATA, before);

  pool[0].makes_visible.push("mutation");
  assert.deepEqual(DATA.lineages[0].makes_visible, ["execution", "strategy"]);
});

test("seed, add, remove and clear are immutable state transitions with no duplicates", () => {
  const pool = requireExport("createWorkspacePool")(DATA);
  const seedWorkspace = requireExport("seedWorkspace");
  const addEntry = requireExport("addEntry");
  const removeEntry = requireExport("removeEntry");
  const clearWorkspace = requireExport("clearWorkspace");

  const seeded = seedWorkspace(pool, ["lineage:micro-macro", "format:frame-data"]);
  assert.deepEqual(seeded, [PORTABLE_MICRO, pool[2]]);
  assert.notEqual(seeded[0], pool[0]);

  const added = addEntry(seeded, pool, "lineage:yomi-reads");
  assert.deepEqual(added.map(entry => entry.key), [
    "lineage:micro-macro",
    "format:frame-data",
    "lineage:yomi-reads"
  ]);
  assert.deepEqual(seeded.map(entry => entry.key), ["lineage:micro-macro", "format:frame-data"]);

  const duplicate = addEntry(added, pool, { type: "lineage", id: "micro-macro" });
  assert.deepEqual(duplicate, added);
  assert.notEqual(duplicate, added);

  const removed = removeEntry(duplicate, "format", "frame-data");
  assert.deepEqual(removed.map(entry => entry.key), ["lineage:micro-macro", "lineage:yomi-reads"]);
  assert.deepEqual(duplicate.map(entry => entry.key), [
    "lineage:micro-macro",
    "format:frame-data",
    "lineage:yomi-reads"
  ]);

  const cleared = clearWorkspace(removed);
  assert.deepEqual(cleared, []);
  assert.deepEqual(removed.map(entry => entry.key), ["lineage:micro-macro", "lineage:yomi-reads"]);
});

test("unknown keys are ignored without sharing mutable row objects", () => {
  const pool = requireExport("createWorkspacePool")(DATA);
  const rows = requireExport("seedWorkspace")(pool, ["lineage:micro-macro"]);
  const result = requireExport("addEntry")(rows, pool, "format:missing");
  assert.deepEqual(result, rows);
  assert.notEqual(result, rows);
  assert.notEqual(result[0], rows[0]);
});

test("buildExportPayload contains the exact visible rows and portable schema metadata", () => {
  const pool = requireExport("createWorkspacePool")(DATA);
  const rows = requireExport("seedWorkspace")(pool, ["lineage:micro-macro", "format:frame-data"]);
  const payload = requireExport("buildExportPayload")(rows, {
    now: new Date("2026-07-25T12:34:56.000Z")
  });

  assert.equal(payload.schema_version, "1.0");
  assert.equal(payload.tool, "frontier-comparison");
  assert.equal(payload.generated_at, "2026-07-25T12:34:56.000Z");
  assert.match(payload.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.match(payload.attribution_note, /source|credit|attribution/iu);
  assert.deepEqual(payload.entries, rows);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), payload);
  assert.deepEqual(Object.keys(payload.entries[0]), [
    "key",
    "type",
    "id",
    "name",
    "makes_visible",
    "simplifies"
  ]);

  payload.entries[0].makes_visible.push("mutation");
  assert.deepEqual(rows[0].makes_visible, ["execution", "strategy"]);
});

test("announceStatus establishes a polite atomic live-region contract", () => {
  const attributes = new Map();
  const node = {
    textContent: "",
    setAttribute(name, value) {
      attributes.set(name, String(value));
    }
  };

  requireExport("announceStatus")(node, "Micro / Macro added.");

  assert.equal(node.textContent, "Micro / Macro added.");
  assert.equal(attributes.get("role"), "status");
  assert.equal(attributes.get("aria-live"), "polite");
  assert.equal(attributes.get("aria-atomic"), "true");
});

test("workspace controller cleanup removes persistent control listeners", () => {
  function element() {
    const listeners = new Map();
    return {
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      replaceChildren(...children) { this.children = children; },
      setAttribute() {},
      addEventListener(type, listener) {
        const group = listeners.get(type) ?? [];
        group.push(listener);
        listeners.set(type, group);
      },
      removeEventListener(type, listener) {
        listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== listener));
      },
      listenerCount(type) { return (listeners.get(type) ?? []).length; },
      remove() {}
    };
  }

  const clearButton = element();
  const exportButton = element();
  const controller = requireExport("createWorkspaceController")({
    data: DATA,
    trayNode: element(),
    matrixNode: element(),
    exportButton,
    clearButton,
    statusNode: element(),
    documentRef: {
      createElement: () => element()
    }
  });

  assert.equal(clearButton.listenerCount("click"), 1);
  assert.equal(exportButton.listenerCount("click"), 1);
  assert.equal(typeof controller.destroy, "function");
  controller.destroy();
  assert.equal(clearButton.listenerCount("click"), 0);
  assert.equal(exportButton.listenerCount("click"), 0);
});

test("download starts before object URL cleanup and announces export", () => {
  const pool = requireExport("createWorkspacePool")(DATA);
  const rows = requireExport("seedWorkspace")(pool, ["lineage:micro-macro"]);
  const events = [];
  const timers = [];
  const statusNode = {
    textContent: "",
    setAttribute() {}
  };
  const anchor = {
    href: "",
    download: "",
    click() { events.push("click"); },
    remove() { events.push("remove"); }
  };
  const documentRef = {
    createElement(name) {
      assert.equal(name, "a");
      return anchor;
    },
    body: {
      appendChild(node) {
        assert.equal(node, anchor);
        events.push("append");
      }
    }
  };
  class FakeBlob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }
  const urlApi = {
    createObjectURL(blob) {
      assert.ok(blob instanceof FakeBlob);
      events.push("create-url");
      return "blob:frontier";
    },
    revokeObjectURL(url) {
      assert.equal(url, "blob:frontier");
      events.push("revoke-url");
    }
  };

  const payload = requireExport("downloadWorkspaceJSON")(rows, {
    documentRef,
    BlobCtor: FakeBlob,
    urlApi,
    statusNode,
    now: new Date("2026-07-25T12:34:56.000Z"),
    setTimer(callback, delay) {
      timers.push({ callback, delay });
      return 1;
    }
  });

  assert.deepEqual(events, ["create-url", "append", "click", "remove"]);
  assert.equal(anchor.href, "blob:frontier");
  assert.equal(anchor.download, "frontier-comparison.json");
  assert.equal(timers.length, 1);
  assert.ok(timers[0].delay > 0);
  assert.equal(statusNode.textContent, "Comparison exported as JSON.");
  assert.deepEqual(payload.entries, rows);

  timers[0].callback();
  assert.deepEqual(events, ["create-url", "append", "click", "remove", "revoke-url"]);
});
