import { loadAllData } from "./data.js";
import { initMobileNavigation } from "./nav.js";
import {
  renderComparison,
  renderEntryDetail,
  renderFatalError,
  renderGames,
  renderNotFound,
  renderOverviewCard
} from "./render.js";
import { initRouter } from "./router.js";
import { initWorkspace } from "./workspace.js";

const ROUTE_TITLES = Object.freeze({
  home: "Frontier — connective visual atlas",
  games: "Games — Frontier",
  lineages: "Framework lineages — Frontier",
  atlas: "Reduction atlas — Frontier",
  compare: "Curated comparison — Frontier",
  workspace: "Comparison workspace — Frontier",
  "not-found": "Page not found — Frontier"
});

export function createFatalErrorViewModel(error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    status: "error",
    role: "alert",
    heading: "Frontier could not load its archive",
    message
  };
}

export function initSkipLink({ documentRef = globalThis.document } = {}) {
  if (!documentRef) return () => {};

  const skipLink = documentRef.querySelector?.('.skip-link[href="#main"]');
  const main = documentRef.querySelector?.("[data-route-host]");
  if (!skipLink?.addEventListener || !main) return () => {};

  const onSkip = event => {
    event.preventDefault?.();
    const activeHeading = main.querySelector?.(
      "[data-screen]:not([hidden]) [data-route-heading]"
    );
    (activeHeading ?? main).focus?.();
  };

  skipLink.addEventListener("click", onSkip);
  return () => skipLink.removeEventListener?.("click", onSkip);
}

function setScreen(documentRef, screenName) {
  let active = null;
  for (const screen of documentRef.querySelectorAll("[data-screen]")) {
    const matches = screen.dataset.screen === screenName;
    screen.hidden = !matches;
    if (matches) active = screen;
  }
  return active;
}

function populateStaticViews(documentRef, data) {
  documentRef.getElementById("games-grid").innerHTML = renderGames(data);
  documentRef.getElementById("lineage-grid").innerHTML = data.lineages
    .map(lineage => renderOverviewCard(lineage, "lineage", data))
    .join("");
  documentRef.getElementById("format-grid").innerHTML = data.formats
    .map(format => renderOverviewCard(format, "format", data))
    .join("");
  documentRef.getElementById("comparison-host").innerHTML = renderComparison(data);
}

function renderRoute(documentRef, view, data) {
  const isEntryView = view.name === "entry" || view.name === "not-found";
  const active = setScreen(documentRef, isEntryView ? "entry" : view.name);

  if (view.name === "entry") {
    active.querySelector(".wrap").innerHTML = renderEntryDetail(view, data);
    documentRef.title = `${view.record.name} — Frontier`;
    return active;
  }

  if (view.name === "not-found") {
    active.querySelector(".wrap").innerHTML = renderNotFound(view);
    documentRef.title = ROUTE_TITLES["not-found"];
    return active;
  }

  documentRef.title = ROUTE_TITLES[view.name] ?? ROUTE_TITLES.home;
  return active;
}

export async function bootApp({
  documentRef = globalThis.document,
  windowObj = globalThis.window,
  fetchFn = globalThis.fetch
} = {}) {
  if (!documentRef || !windowObj) {
    throw new Error("Frontier requires a browser document and window.");
  }

  const stopMobileNavigation = initMobileNavigation({ documentRef });
  const stopSkipLink = initSkipLink({ documentRef });
  try {
    const data = await loadAllData(fetchFn);
    populateStaticViews(documentRef, data);
    const workspace = initWorkspace(data, { documentRef });
    const links = documentRef.querySelectorAll("#primary-nav a");
    const stopRouter = initRouter({
      windowObj,
      dataIndex: data,
      links,
      onRoute: view => renderRoute(documentRef, view, data)
    });
    return {
      data,
      workspace,
      stop() {
        workspace.destroy();
        stopRouter();
        stopSkipLink();
        stopMobileNavigation();
      }
    };
  } catch (error) {
    const view = createFatalErrorViewModel(error);
    const main = documentRef.querySelector("[data-route-host]");
    if (main) main.innerHTML = renderFatalError(view);
    documentRef.title = "Archive load error — Frontier";
    main?.querySelector?.("[data-route-heading]")?.focus?.();
    return {
      error: view,
      stop() {
        stopSkipLink();
        stopMobileNavigation();
      }
    };
  }
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  void bootApp();
}
