import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const [css, appSource] = await Promise.all([
  readFile(new URL("../css/main.css", import.meta.url), "utf8"),
  readFile(new URL("../js/app.js", import.meta.url), "utf8")
]);

function count(pattern) {
  return [...html.matchAll(pattern)].length;
}

function openingTag(tagName, attributePattern = "") {
  const expression = new RegExp(`<${tagName}\\b[^>]*${attributePattern}[^>]*>`, "iu");
  return html.match(expression)?.[0] ?? "";
}

test("document shell has one main landmark, one fallback H1 and a skip link", () => {
  assert.equal(count(/<main\b/giu), 1);
  assert.equal(count(/<h1\b/giu), 1);
  assert.match(html, /<a\b[^>]*class=["'][^"']*skip-link[^"']*["'][^>]*href=["']#main["'][^>]*>/iu);
});

test("the route host is focusable and contains a reusable entry-detail host", () => {
  const main = openingTag("main", "data-route-host");
  assert.match(main, /\bid=["']main["']/iu);
  assert.match(main, /\btabindex=["']-1["']/iu);
  assert.match(html, /<section\b[^>]*data-screen=["']entry["'][^>]*data-entry-host\b[^>]*>/iu);
});

test("all principal route screen hosts are present", () => {
  for (const screen of ["home", "games", "lineages", "atlas", "compare", "workspace"]) {
    assert.match(html, new RegExp(`<section\\b[^>]*data-screen=["']${screen}["'][^>]*>`, "iu"), `${screen} screen host is missing`);
  }
  assert.doesNotMatch(html, /data-screen=["'](?:method|about)["']/iu);
});

test("navigation has six ordered hash anchors and no removed coursework routes", () => {
  const navigation = html.match(/<nav\b[^>]*id=["']primary-nav["'][^>]*>([\s\S]*?)<\/nav>/iu)?.[1] ?? "";
  const hrefs = [...navigation.matchAll(/<a\b[^>]*href=["'](#[^"']+)["']/giu)].map(match => match[1]);
  assert.deepEqual(hrefs, ["#home", "#games", "#lineages", "#atlas", "#compare", "#workspace"]);
  for (const route of ["home", "games", "lineages", "atlas", "compare", "workspace"]) {
    assert.match(html, new RegExp(`<a\\b[^>]*href=["']#${route}["'][^>]*>`, "iu"), `${route} navigation link is missing`);
  }
  assert.doesNotMatch(navigation, /href=["']#(?:method|about)["']/iu);
  assert.match(html, /<section\b[^>]*(?:id=["']compare["'][^>]*data-screen=["']compare["']|data-screen=["']compare["'][^>]*id=["']compare["'])[^>]*>/iu);
  assert.match(html, /\bid=["']comparison-host["']/iu);
});

test("Games is immediately after Home with an accessible routed heading and one population call", () => {
  const homeIndex = html.indexOf('data-screen="home"');
  const gamesIndex = html.indexOf('data-screen="games"');
  const lineagesIndex = html.indexOf('data-screen="lineages"');
  assert.ok(homeIndex >= 0 && homeIndex < gamesIndex && gamesIndex < lineagesIndex);
  const gamesSection = html.match(/<section\b[^>]*data-screen=["']games["'][^>]*>([\s\S]*?)<\/section>/iu)?.[1] ?? "";
  assert.match(gamesSection, /<h2\b[^>]*data-route-heading[^>]*tabindex=["']-1["'][^>]*>Games<\/h2>/iu);
  assert.match(gamesSection, /\bid=["']games-grid["'][^>]*class=["'][^"']*game-grid/iu);
  assert.match(appSource, /games:\s*["']Games[^"']*Frontier["']/u);
  assert.equal((appSource.match(/getElementById\(["']games-grid["']\)/gu) ?? []).length, 1);
  assert.equal((appSource.match(/renderGames\(data\)/gu) ?? []).length, 1);
});

test("lineage heading distinguishes documented evidence from interpretation", () => {
  assert.doesNotMatch(html, /Three frameworks and their documented connections/iu);
  assert.match(html, /Three frameworks and their documented and interpretive connections/iu);
});

test("small-screen navigation has an accessible working-control contract", () => {
  const toggle = openingTag("button", "id=[\"']nav-toggle[\"']");
  assert.match(toggle, /\btype=["']button["']/iu);
  assert.match(toggle, /\baria-controls=["']primary-nav["']/iu);
  assert.match(toggle, /\baria-expanded=["']false["']/iu);
  assert.match(html, /<nav\b[^>]*id=["']primary-nav["'][^>]*>/iu);
  assert.match(html, /<script\b[^>]*type=["']module["'][^>]*src=["']\.\/js\/app\.js["'][^>]*>/iu);
  assert.match(css, /\.nav-toggle\s*\{[^}]*display\s*:\s*none/iu);
  assert.match(css, /nav\.main\.is-open\s*\{[^}]*display\s*:\s*flex/iu);
  assert.match(css, /@media\s*\(max-width\s*:\s*720px\)[\s\S]*?\.nav-toggle\s*\{[^}]*display\s*:\s*inline-flex/iu);
});

test("workspace exposes its tray, matrix, working controls and polite status", () => {
  for (const id of ["ws-tray", "ws-matrix", "ws-export", "ws-clear"]) {
    assert.match(html, new RegExp(`\\bid=["']${id}["']`, "iu"), `${id} is missing`);
  }
  const status = openingTag("p", "id=[\"']ws-status[\"']");
  assert.match(status, /\brole=["']status["']/iu);
  assert.match(status, /\baria-live=["']polite["']/iu);
  assert.match(status, /\baria-atomic=["']true["']/iu);
});

test("primary interface does not advertise unavailable controls", () => {
  assert.doesNotMatch(html, /\b(?:disabled|aria-disabled)\s*=/iu);
  assert.doesNotMatch(html, /class=["'][^"']*\bplanned\b[^"']*["']/iu);
  assert.doesNotMatch(html, />\s*(?:export image|embed\s*\/\s*fork)\s*</iu);
});

test("repository assets and scripts use GitHub Pages-safe relative paths", () => {
  assert.match(html, /<link\b[^>]*href=["']\.\/css\/main\.css["']/iu);
  const localPaths = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/giu)]
    .map(match => match[1])
    .filter(value => /^(?:css|js|data|assets)\//u.test(value) || /^\/(?:css|js|data|assets)\//u.test(value));
  assert.deepEqual(localPaths, [], `local paths must begin with ./: ${localPaths.join(", ")}`);
  assert.match(html, /<script\b[^>]*src=["']\.\/js\/(?:router|app)\.js["'][^>]*>/iu);
});

test("the product states its research question and intended audiences", () => {
  assert.match(html, /research question/iu);
  assert.match(html, /How might a connective visual atlas make the provenance, adaptation and omissions/iu);
  assert.match(html, /primary audience/iu);
  assert.match(html, /community guide creators|wiki contributors|coaches and analysts/iu);
  assert.match(html, /secondary audience/iu);
});

test("coursework method, limitations and completion gates live outside the product", () => {
  assert.doesNotMatch(html, /Assessment 1 continuity|Methods brought into the interface|Human completion gates/iu);
  assert.doesNotMatch(html, /800-word contextual (?:text|statement)|human user test|submission deadline/iu);
  assert.match(html, /Expanded method, source credits and AI declaration:\s*<a href="\.\/README\.md">README<\/a>/iu);
});
