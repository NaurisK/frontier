import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import * as appModule from "../js/app.js";
import { focusRouteHeading, parseRoute, setCurrentNavigation } from "../js/router.js";

const root = new URL("../", import.meta.url);
const [html, css, archiveDocument, workspaceSource] = await Promise.all([
  readFile(new URL("index.html", root), "utf8"),
  readFile(new URL("css/main.css", root), "utf8"),
  readFile(new URL("data/archive_index.json", root), "utf8").then(JSON.parse),
  readFile(new URL("js/workspace.js", root), "utf8")
]);

function fakeLink(href) {
  const attributes = new Map([["href", href]]);
  const classes = new Set();
  return {
    classList: {
      add: name => classes.add(name),
      remove: name => classes.delete(name)
    },
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: name => attributes.delete(name)
  };
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [red, green, blue] = hexToRgb(hex).map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function customProperties(source) {
  return new Map(
    [...source.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-f]{6})\s*;/giu)]
      .map(([, name, value]) => [name, value.toLowerCase()])
  );
}

test("one navigation destination is current, including duplicate route links", () => {
  const links = [fakeLink("#home"), fakeLink("#games"), fakeLink("#games"), fakeLink("#atlas")];
  setCurrentNavigation(links, { name: "games" });

  assert.equal(links.filter(link => link.getAttribute("aria-current") === "page").length, 1);
});

test("route focus prefers the explicit routed heading", () => {
  let focused = false;
  const attributes = new Map();
  const heading = {
    focus: () => { focused = true; },
    hasAttribute: name => attributes.has(name),
    setAttribute: (name, value) => attributes.set(name, value)
  };
  const host = {
    querySelector: selector => selector === "[data-route-heading]" ? heading : null
  };

  assert.equal(focusRouteHeading(host), true);
  assert.equal(focused, true);
  assert.equal(attributes.get("tabindex"), "-1");
});

test("the skip target and compact navigation have accessible hooks", () => {
  assert.match(html, /<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#main["']/iu);
  assert.match(html, /<main\b[^>]*id=["']main["'][^>]*tabindex=["']-1["']/iu);
  assert.match(html, /<button\b[^>]*id=["']nav-toggle["'][^>]*aria-controls=["']primary-nav["'][^>]*aria-expanded=["']false["']/iu);
  assert.match(html, /<nav\b[^>]*id=["']primary-nav["']/iu);
});

test("visually hidden table labels cannot enlarge the document overflow area", () => {
  assert.doesNotMatch(html, /<style>[^<]*\.visually-hidden/iu);
  const declaration = css.match(/\.visually-hidden\s*\{([^}]*)\}/iu)?.[1] ?? "";

  for (const rule of [
    /position\s*:\s*absolute/iu,
    /width\s*:\s*1px/iu,
    /height\s*:\s*1px/iu,
    /padding\s*:\s*0/iu,
    /margin\s*:\s*-1px/iu,
    /overflow\s*:\s*hidden/iu,
    /clip\s*:\s*rect\(0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+0(?:px)?\)/iu,
    /clip-path\s*:\s*inset\(50%\)/iu,
    /white-space\s*:\s*nowrap/iu,
    /border\s*:\s*0/iu
  ]) {
    assert.match(declaration, rule);
  }

  assert.doesNotMatch(
    workspaceSource,
    /<span\s+class=["']visually-hidden["']>Remove<\/span>/iu
  );
  assert.match(
    workspaceSource,
    /<th\s+scope=["']col["']\s+aria-label=["']Remove entries["']><\/th>/iu
  );
});

test("the skip link focuses the active route without handing #main to the router", () => {
  assert.equal(parseRoute("#main").name, "not-found", "#main is not an application route");
  assert.equal(typeof appModule.initSkipLink, "function");

  let clickHandler;
  let focused = false;
  let prevented = false;
  const skipLink = {
    addEventListener(type, listener) { if (type === "click") clickHandler = listener; },
    removeEventListener(type, listener) {
      if (type === "click" && clickHandler === listener) clickHandler = undefined;
    }
  };
  const activeHeading = { focus() { focused = true; } };
  const main = {
    querySelector(selector) {
      return selector === "[data-screen]:not([hidden]) [data-route-heading]" ? activeHeading : null;
    }
  };
  const documentRef = {
    querySelector(selector) {
      if (selector === '.skip-link[href="#main"]') return skipLink;
      if (selector === "[data-route-host]") return main;
      return null;
    }
  };

  const stop = appModule.initSkipLink({ documentRef });
  clickHandler({ preventDefault() { prevented = true; } });

  assert.equal(prevented, true);
  assert.equal(focused, true);
  stop();
  assert.equal(clickHandler, undefined);
});

test("every local capture exposes non-empty alternative text and credit", () => {
  for (const record of archiveDocument.records) {
    assert.ok(record.alt?.trim(), `${record.id} needs alternative text`);
    assert.ok(record.credit?.trim(), `${record.id} needs a credit`);
  }
});

test("focus, reduced motion and responsive navigation remain explicit in CSS", () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline\s*:\s*(?:2|3)px\s+solid\s+var\(--signal\)/isu);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/iu);
  assert.match(css, /@media\s*\(max-width:\s*720px\)[\s\S]*?\.nav-toggle\s*\{[^}]*display\s*:\s*inline-flex/iu);
  assert.match(css, /nav\.main\.is-open\s*\{[^}]*display\s*:\s*flex/iu);
});

test("wide comparison content is contained instead of hidden at page level", () => {
  assert.match(css, /\.table-scroll\s*\{[^}]*max-width\s*:\s*100%[^}]*overflow-x\s*:\s*auto/isu);
  assert.match(css, /\.comparison-table\s*\{[^}]*min-width\s*:\s*\d+px/isu);
  assert.match(css, /\.matrix-wrap\s*\{[^}]*max-width\s*:\s*100%[^}]*overflow-x\s*:\s*auto/isu);
  assert.match(css, /\.matrix\s*\{[^}]*min-width\s*:\s*\d+px/isu);
  const matrixWrapper = html.match(/<div\b[^>]*id=["']ws-matrix["'][^>]*>/iu)?.[0] ?? "";
  assert.match(matrixWrapper, /class=["']matrix-wrap["']/iu);
  assert.match(matrixWrapper, /tabindex=["']0["']/iu);
  assert.match(matrixWrapper, /role=["']region["']/iu);
  assert.match(matrixWrapper, /aria-label=["'][^"']+["']/iu);
  assert.doesNotMatch(css, /(?:html|body)\s*\{[^}]*overflow-x\s*:\s*hidden/isu);
});

test("captures reflow within their content column", () => {
  assert.match(css, /\.capture\s+img\s*\{[^}]*max-width\s*:\s*100%/isu);
  assert.match(css, /\.capture\s+img\s*\{[^}]*height\s*:\s*auto/isu);
});

test("the Games grid has a 390px containment contract", () => {
  assert.match(css, /\.game-grid\s*\{[^}]*grid-template-columns\s*:\s*repeat\([^}]*minmax\(min\(100%,\s*[^)]+\),\s*1fr\)/isu);
  assert.match(css, /\.game-card\s*\{[^}]*min-width\s*:\s*0/isu);
  assert.match(css, /\.game-context\s*\{[^}]*overflow-wrap\s*:\s*anywhere/isu);
  assert.doesNotMatch(css, /(?:html|body)\s*\{[^}]*overflow-x\s*:\s*hidden/isu);
});

test("normal text and status colours meet 4.5:1 against their darkest used panel", () => {
  const colours = customProperties(css);
  const panel = colours.get("ink-3");
  const pairs = [
    ["paper", "ink"],
    ["paper-dim", "ink-3"],
    ["paper-faint", "ink-3"],
    ["signal", "ink-3"],
    ["ev-strong", "ink-3"],
    ["ev-mid", "ink-3"],
    ["ev-precedent", "ink-3"],
    ["ev-synth", "ink-3"],
    ["ev-weak", "ink-3"],
    ["visible", "ink-3"],
    ["simplifies", "ink-3"]
  ];

  assert.ok(panel, "ink-3 must be defined");
  for (const [foregroundName, backgroundName] of pairs) {
    const foreground = colours.get(foregroundName);
    const background = colours.get(backgroundName);
    assert.ok(foreground && background, `${foregroundName}/${backgroundName} must be defined`);
    assert.ok(
      contrast(foreground, background) >= 4.5,
      `${foregroundName} on ${backgroundName} is ${contrast(foreground, background).toFixed(2)}:1`
    );
  }
});

test("control boundaries and focus indicators meet 3:1 on raised panels", () => {
  const colours = customProperties(css);
  for (const foregroundName of ["line", "signal-dim", "signal"]) {
    const foreground = colours.get(foregroundName);
    const background = colours.get("ink-3");
    assert.ok(
      contrast(foreground, background) >= 3,
      `${foregroundName} on ink-3 is ${contrast(foreground, background).toFixed(2)}:1`
    );
  }
});

test("critical metadata uses the readable secondary-text token", () => {
  for (const selector of [
    ".capture-credit",
    ".capture-meta",
    ".prov-meta",
    ".qualification",
    ".metadata"
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const declaration = css.match(new RegExp(`${escaped}[^\\{]*\\{([^}]*)\\}`, "iu"))?.[1] ?? "";
    assert.match(declaration, /color\s*:\s*var\(--paper-dim\)/iu, `${selector} must use paper-dim`);
    assert.doesNotMatch(declaration, /paper-faint/iu, `${selector} must not use paper-faint`);
  }
});

test("dispute qualifications and workspace removal controls use readable text", () => {
  for (const selector of [".dispute .note", ".matrix .drop"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const declaration = css.match(new RegExp(`${escaped}[^\\{]*\\{([^}]*)\\}`, "iu"))?.[1] ?? "";
    assert.match(declaration, /color\s*:\s*var\(--paper-dim\)/iu, `${selector} must use paper-dim`);
    assert.doesNotMatch(declaration, /paper-faint/iu, `${selector} must not use paper-faint`);
  }

  const removeControl = css.match(/\.matrix\s+\.drop\s*\{([^}]*)\}/iu)?.[1] ?? "";
  assert.match(removeControl, /background(?:-color)?\s*:\s*var\(--ink-2\)/iu);
  assert.match(removeControl, /border\s*:\s*1px\s+solid\s+var\(--line\)/iu);
  assert.match(removeControl, /font\s*:\s*inherit/iu);
  assert.match(removeControl, /padding\s*:\s*[^;]+/iu);
});
