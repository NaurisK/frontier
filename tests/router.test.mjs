import assert from "node:assert/strict";
import { test } from "node:test";

const router = await import("../js/router.js");

const STATIC_ROUTES = [
  "home",
  "games",
  "lineages",
  "atlas",
  "compare",
  "workspace"
];

const DATA_INDEX = {
  lineages: [
    { id: "micro-macro", name: "Micro / Macro" },
    { id: "yomi-reads", name: "Yomi / Reads" },
    { id: "surnex-playertype", name: "Surnex to Player Type" }
  ],
  formats: [
    { id: "taxonomy-diagram", name: "Taxonomy diagram" },
    { id: "frame-data", name: "Frame data" },
    { id: "build-order", name: "Build order" },
    { id: "callout-map", name: "Callout map" }
  ]
};

function requireExport(name) {
  assert.equal(typeof router[name], "function", `${name} must be exported`);
  return router[name];
}

function fakeLink(href) {
  const attributes = new Map([["href", href]]);
  const classes = new Set();
  return {
    classList: {
      add: value => classes.add(value),
      remove: value => classes.delete(value),
      contains: value => classes.has(value)
    },
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: name => attributes.delete(name)
  };
}

function fakeWindow(initialHash = "") {
  const listeners = new Map();
  return {
    location: { hash: initialHash },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) {
      listeners.get(type)?.();
    },
    listener(type) {
      return listeners.get(type);
    }
  };
}

test("router module exports the approved public API", () => {
  for (const name of [
    "parseRoute",
    "routeHref",
    "resolveRoute",
    "setCurrentNavigation",
    "focusRouteHeading",
    "initRouter"
  ]) requireExport(name);
});

test("empty and normalized home hashes resolve to home", () => {
  const parseRoute = requireExport("parseRoute");
  for (const hash of ["", "#", "#/", "#home", "#/home", "home", "/home/"]) {
    assert.deepEqual(parseRoute(hash), { name: "home" });
  }
});

test("all six named principal hashes parse without a page reload path", () => {
  const parseRoute = requireExport("parseRoute");
  for (const name of STATIC_ROUTES) {
    assert.deepEqual(parseRoute(`#${name}`), { name });
    assert.deepEqual(parseRoute(`#/${name}/`), { name });
  }
});

test("entry hashes parse lineage and format identifiers", () => {
  const parseRoute = requireExport("parseRoute");
  assert.deepEqual(parseRoute("#entry/lineage/micro-macro"), {
    name: "entry",
    entryType: "lineage",
    id: "micro-macro"
  });
  assert.deepEqual(parseRoute("#/entry/format/frame-data/"), {
    name: "entry",
    entryType: "format",
    id: "frame-data"
  });
});

test("generated hash-only links round-trip through the parser", () => {
  const parseRoute = requireExport("parseRoute");
  const routeHref = requireExport("routeHref");
  const routes = [
    ...STATIC_ROUTES.map(name => ({ name })),
    { name: "entry", entryType: "lineage", id: "yomi-reads" },
    { name: "entry", entryType: "format", id: "build-order" }
  ];
  for (const route of routes) {
    const href = routeHref(route);
    assert.match(href, /^#[^/]/u, "links must stay hash-only for GitHub Pages");
    assert.deepEqual(parseRoute(href), route);
  }
});

test("unknown route shapes parse to an accessible not-found route", () => {
  const parseRoute = requireExport("parseRoute");
  assert.deepEqual(parseRoute("#unknown/route"), {
    name: "not-found",
    requestedHash: "#unknown/route"
  });
  assert.deepEqual(parseRoute("#entry/archive/ARC-001"), {
    name: "not-found",
    requestedHash: "#entry/archive/ARC-001"
  });
  for (const removedRoute of ["method", "about"]) {
    assert.deepEqual(parseRoute(`#${removedRoute}`), {
      name: "not-found",
      requestedHash: `#${removedRoute}`
    });
  }
});

test("static routes resolve to ready view models", () => {
  const resolveRoute = requireExport("resolveRoute");
  for (const name of STATIC_ROUTES) {
    assert.deepEqual(resolveRoute({ name }, DATA_INDEX), {
      name,
      status: "ready"
    });
  }
});

test("entry routes resolve records from three lineages and four formats", () => {
  const resolveRoute = requireExport("resolveRoute");
  for (const record of DATA_INDEX.lineages) {
    const view = resolveRoute({ name: "entry", entryType: "lineage", id: record.id }, DATA_INDEX);
    assert.equal(view.status, "ready");
    assert.equal(view.record, record);
  }
  for (const record of DATA_INDEX.formats) {
    const view = resolveRoute({ name: "entry", entryType: "format", id: record.id }, DATA_INDEX);
    assert.equal(view.status, "ready");
    assert.equal(view.record, record);
  }
});

test("unknown entry IDs resolve to an accessible not-found view model", () => {
  const resolveRoute = requireExport("resolveRoute");
  const requestedRoute = { name: "entry", entryType: "lineage", id: "missing" };
  const view = resolveRoute(requestedRoute, DATA_INDEX);
  assert.equal(view.name, "not-found");
  assert.equal(view.status, "not-found");
  assert.equal(view.heading, "Entry not found");
  assert.match(view.message, /missing/u);
  assert.deepEqual(view.requestedRoute, requestedRoute);
});

test("unknown route types resolve to an accessible not-found view model", () => {
  const resolveRoute = requireExport("resolveRoute");
  const route = { name: "not-found", requestedHash: "#mystery" };
  const view = resolveRoute(route, DATA_INDEX);
  assert.equal(view.name, "not-found");
  assert.equal(view.status, "not-found");
  assert.equal(view.heading, "Page not found");
  assert.ok(view.message.length > 0);
});

test("navigation state follows static routes and entry parent routes", () => {
  const setCurrentNavigation = requireExport("setCurrentNavigation");
  const links = [
    fakeLink("#home"),
    fakeLink("#games"),
    fakeLink("#lineages"),
    fakeLink("#atlas"),
    fakeLink("#workspace")
  ];
  setCurrentNavigation(links, { name: "games" });
  assert.equal(links[1].classList.contains("active"), true);
  assert.equal(links[1].getAttribute("aria-current"), "page");
  assert.equal(links[0].getAttribute("aria-current"), null);

  setCurrentNavigation(links, { name: "entry", entryType: "format", id: "frame-data" });
  assert.equal(links[3].classList.contains("active"), true);
  assert.equal(links[3].getAttribute("aria-current"), "page");
  assert.equal(links[1].classList.contains("active"), false);
});

test("duplicate navigation destinations expose exactly one current page", () => {
  const setCurrentNavigation = requireExport("setCurrentNavigation");
  const links = [fakeLink("#lineages"), fakeLink("#lineages"), fakeLink("#games")];
  setCurrentNavigation(links, { name: "lineages" });
  assert.equal(links.filter(link => link.getAttribute("aria-current") === "page").length, 1);
  assert.equal(links.filter(link => link.classList.contains("active")).length, 1);
});

test("route heading focus prioritizes the annotated route heading", () => {
  const focusRouteHeading = requireExport("focusRouteHeading");
  const attributes = new Map();
  let focused = false;
  const heading = {
    hasAttribute: name => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, String(value)),
    focus: () => { focused = true; }
  };
  const persistentHeading = { focus: () => { throw new Error("persistent heading must not receive focus"); } };
  const selectors = [];
  const root = {
    querySelector(selector) {
      selectors.push(selector);
      if (selector === "[data-route-heading]") return heading;
      if (selector === "h1, h2") return persistentHeading;
      return null;
    }
  };
  assert.equal(focusRouteHeading(root), true);
  assert.equal(attributes.get("tabindex"), "-1");
  assert.equal(focused, true);
  assert.deepEqual(selectors, ["[data-route-heading]"]);
});

test("route heading focus falls back to an unannotated H1 or H2", () => {
  const focusRouteHeading = requireExport("focusRouteHeading");
  let focused = false;
  const heading = {
    hasAttribute: () => true,
    focus: () => { focused = true; }
  };
  const selectors = [];
  const root = {
    querySelector(selector) {
      selectors.push(selector);
      return selector === "h1, h2" ? heading : null;
    }
  };
  assert.equal(focusRouteHeading(root), true);
  assert.equal(focused, true);
  assert.deepEqual(selectors, ["[data-route-heading]", "h1, h2"]);
});

test("initRouter resolves direct loads and later hash changes", () => {
  const initRouter = requireExport("initRouter");
  const windowObj = fakeWindow("#entry/format/callout-map");
  const views = [];
  const stop = initRouter({
    windowObj,
    dataIndex: DATA_INDEX,
    onRoute: view => views.push(view)
  });
  assert.equal(views[0].record.id, "callout-map");
  assert.equal(typeof windowObj.listener("hashchange"), "function");

  windowObj.location.hash = "#games";
  windowObj.dispatch("hashchange");
  assert.equal(views.at(-1).name, "games");

  stop();
  assert.equal(windowObj.listener("hashchange"), undefined);
});

test("initRouter focuses the active screen returned by the route renderer", () => {
  const initRouter = requireExport("initRouter");
  const windowObj = fakeWindow("#lineages");
  let activeFocused = false;
  let fallbackQueried = false;
  const activeHeading = {
    hasAttribute: () => true,
    focus: () => { activeFocused = true; }
  };
  const activeScreen = {
    querySelector(selector) {
      return selector === "[data-route-heading]" ? activeHeading : null;
    }
  };
  const persistentMain = {
    querySelector() {
      fallbackQueried = true;
      throw new Error("the persistent main landmark must not choose route focus");
    }
  };

  const stop = initRouter({
    windowObj,
    dataIndex: DATA_INDEX,
    root: persistentMain,
    onRoute: () => activeScreen
  });

  assert.equal(activeFocused, true);
  assert.equal(fallbackQueried, false);
  stop();
});

test("importing router.js does not register browser listeners", async () => {
  const previousWindow = globalThis.window;
  let registrations = 0;
  globalThis.window = { addEventListener: () => { registrations += 1; } };
  try {
    await import(`../js/router.js?side-effect-check=${Date.now()}`);
    assert.equal(registrations, 0);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
