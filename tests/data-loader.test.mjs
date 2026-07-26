import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { bootApp, createFatalErrorViewModel } from "../js/app.js";
import { DATA_PATHS, loadAllData, loadJson } from "../js/data.js";

function jsonResponse(body, { ok = true, status = 200, statusText = "OK" } = {}) {
  return {
    ok,
    status,
    statusText,
    async json() {
      return body;
    }
  };
}

test("loadJson rejects a non-OK response with its resource path and status", async () => {
  await assert.rejects(
    loadJson("./data/missing.json", async () => jsonResponse(null, {
      ok: false,
      status: 404,
      statusText: "Not Found"
    })),
    error => {
      assert.match(error.message, /\.\/data\/missing\.json/u);
      assert.match(error.message, /404/u);
      return true;
    }
  );
});

test("loadAllData requests each relative canonical JSON resource exactly once", async () => {
  const requests = [];
  const documents = {
    [DATA_PATHS.archive]: { schema_version: "1.0", corpus: {}, records: [] },
    [DATA_PATHS.lineages]: { schema_version: "1.0", lineages: [] },
    [DATA_PATHS.formats]: { schema_version: "1.0", formats: [] },
    [DATA_PATHS.disputes]: { schema_version: "1.0", disputes: [] },
    [DATA_PATHS.games]: { schema_version: "1.0", games: [] }
  };

  await loadAllData(async path => {
    requests.push(path);
    return jsonResponse(documents[path]);
  });

  assert.deepEqual(
    requests.sort(),
    Object.values(DATA_PATHS).sort()
  );
  assert.equal(new Set(requests).size, 5);
});

test("loadAllData returns collections and ID indexes for every record type", async () => {
  const documents = {
    [DATA_PATHS.archive]: {
      schema_version: "1.0",
      corpus: { item_count: 1 },
      records: [{ id: "ARC-1", title: "Archive record" }]
    },
    [DATA_PATHS.lineages]: {
      schema_version: "1.0",
      lineages: [{ id: "lineage-1", name: "Lineage" }]
    },
    [DATA_PATHS.formats]: {
      schema_version: "1.0",
      formats: [{ id: "format-1", name: "Format" }]
    },
    [DATA_PATHS.disputes]: {
      schema_version: "1.0",
      disputes: [{ id: "dispute-1", excerpt: "Dispute" }]
    },
    [DATA_PATHS.games]: {
      schema_version: "1.0",
      games: [{ id: "game-1", name: "Game" }]
    }
  };

  const data = await loadAllData(async path => jsonResponse(documents[path]));

  assert.equal(data.archive.length, 1);
  assert.equal(data.lineages.length, 1);
  assert.equal(data.formats.length, 1);
  assert.equal(data.disputes.length, 1);
  assert.equal(data.games.length, 1);
  assert.equal(data.corpus.item_count, 1);
  assert.equal(data.index.archive.get("ARC-1").title, "Archive record");
  assert.equal(data.index.lineages.get("lineage-1").name, "Lineage");
  assert.equal(data.index.formats.get("format-1").name, "Format");
  assert.equal(data.index.disputes.get("dispute-1").excerpt, "Dispute");
  assert.equal(data.index.games.get("game-1").name, "Game");
});

test("fatal load failures become a serializable accessible view model", () => {
  const view = createFatalErrorViewModel(
    new Error("Failed to load ./data/formats.json: 503 Service Unavailable")
  );

  assert.deepEqual(JSON.parse(JSON.stringify(view)), view);
  assert.equal(view.status, "error");
  assert.match(view.heading, /could not load/iu);
  assert.match(view.message, /\.\/data\/formats\.json/iu);
  assert.equal(view.role, "alert");
});

test("app owns mobile navigation boot and nav does not self-initialise", async () => {
  const appSource = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const navSource = await readFile(new URL("../js/nav.js", import.meta.url), "utf8");

  assert.doesNotMatch(navSource, /DOMContentLoaded|document\.readyState/gu);
  assert.match(appSource, /initMobileNavigation\s*\(/u);
  assert.match(appSource, /querySelectorAll\(["']#primary-nav a["']\)/u);
  assert.doesNotMatch(appSource, /#primary-nav a,\s*\.brand/u);
  assert.match(appSource, /workspace\.destroy\(\)/u);
});

test("a fatal archive load keeps the compact navigation functional and cleanable", async () => {
  const listeners = new Map();
  const attributes = new Map([["aria-expanded", "false"]]);
  const classes = new Set();
  const toggle = {
    addEventListener(type, listener) { listeners.set(`toggle:${type}`, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(`toggle:${type}`) === listener) listeners.delete(`toggle:${type}`);
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    focus() {}
  };
  const nav = {
    classList: {
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); }
    },
    querySelectorAll() { return []; }
  };
  const heading = { focus() {} };
  const main = {
    innerHTML: "",
    querySelector() { return heading; }
  };
  const documentRef = {
    title: "",
    body: {},
    getElementById(id) {
      if (id === "nav-toggle") return toggle;
      if (id === "primary-nav") return nav;
      return null;
    },
    querySelector(selector) {
      return selector === "[data-route-host]" ? main : null;
    },
    addEventListener(type, listener) { listeners.set(`document:${type}`, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(`document:${type}`) === listener) listeners.delete(`document:${type}`);
    }
  };

  const result = await bootApp({
    documentRef,
    windowObj: {},
    fetchFn: async () => jsonResponse(null, {
      ok: false,
      status: 503,
      statusText: "Service Unavailable"
    })
  });

  listeners.get("toggle:click")();
  assert.equal(attributes.get("aria-expanded"), "true");
  assert.equal(classes.has("is-open"), true);
  assert.equal(typeof result.stop, "function");

  result.stop();
  assert.equal(listeners.has("toggle:click"), false);
});
