const STATIC_ROUTE_NAMES = new Set([
  "home",
  "games",
  "lineages",
  "atlas",
  "compare",
  "workspace"
]);

const ENTRY_COLLECTIONS = {
  lineage: "lineages",
  format: "formats"
};

function canonicalHash(hash) {
  const source = String(hash ?? "").trim();
  const withoutHash = source.startsWith("#") ? source.slice(1) : source;
  const path = withoutHash.replace(/^\/+|\/+$/gu, "");
  return path ? `#${path}` : "#home";
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

export function parseRoute(hash = "") {
  const normalizedHash = canonicalHash(hash);
  const segments = normalizedHash.slice(1).split("/").filter(Boolean);
  const routeName = segments[0]?.toLowerCase();

  if (segments.length === 1 && STATIC_ROUTE_NAMES.has(routeName)) {
    return { name: routeName };
  }

  if (routeName === "entry" && segments.length === 3) {
    const entryType = segments[1].toLowerCase();
    const id = decodeSegment(segments[2]);
    if (Object.hasOwn(ENTRY_COLLECTIONS, entryType) && id) {
      return { name: "entry", entryType, id };
    }
  }

  return { name: "not-found", requestedHash: normalizedHash };
}

export function routeHref(route) {
  if (route?.name === "entry" && Object.hasOwn(ENTRY_COLLECTIONS, route.entryType) && route.id) {
    return `#entry/${route.entryType}/${encodeURIComponent(route.id)}`;
  }
  if (STATIC_ROUTE_NAMES.has(route?.name)) return `#${route.name}`;
  return "#home";
}

function notFoundView(route, entry = false) {
  const subject = entry ? route.id : route.requestedHash;
  return {
    name: "not-found",
    status: "not-found",
    heading: entry ? "Entry not found" : "Page not found",
    message: entry
      ? `No ${route.entryType} entry named “${subject}” exists in this corpus.`
      : `Frontier has no route matching “${subject || "this address"}”.`,
    requestedRoute: route
  };
}

export function resolveRoute(route, dataIndex = {}) {
  if (STATIC_ROUTE_NAMES.has(route?.name)) {
    return { name: route.name, status: "ready" };
  }

  if (route?.name === "entry" && Object.hasOwn(ENTRY_COLLECTIONS, route.entryType)) {
    const collection = dataIndex[ENTRY_COLLECTIONS[route.entryType]];
    const record = Array.isArray(collection)
      ? collection.find(item => item?.id === route.id)
      : collection instanceof Map
        ? collection.get(route.id)
        : undefined;

    if (!record) return notFoundView(route, true);
    return { ...route, status: "ready", record };
  }

  return notFoundView(route, false);
}

function navigationRouteName(route) {
  if (route?.name !== "entry") return route?.name;
  if (route.entryType === "lineage") return "lineages";
  if (route.entryType === "format") return "atlas";
  return null;
}

export function setCurrentNavigation(links, route) {
  const activeName = navigationRouteName(route);
  let currentAssigned = false;
  for (const link of Array.from(links ?? [])) {
    const linkRoute = parseRoute(link.getAttribute?.("href") ?? "");
    const isCurrent = !currentAssigned && linkRoute.name === activeName;
    if (isCurrent) currentAssigned = true;
    link.classList?.[isCurrent ? "add" : "remove"]?.("active");
    if (isCurrent) link.setAttribute?.("aria-current", "page");
    else link.removeAttribute?.("aria-current");
  }
}

export function focusRouteHeading(root) {
  const heading = root?.querySelector?.("[data-route-heading]") ?? root?.querySelector?.("h1, h2");
  if (!heading?.focus) return false;
  if (!heading.hasAttribute?.("tabindex")) heading.setAttribute?.("tabindex", "-1");
  heading.focus();
  return true;
}

export function initRouter({
  windowObj = typeof window === "undefined" ? null : window,
  dataIndex = {},
  onRoute = () => {},
  links = [],
  root = null
} = {}) {
  if (!windowObj?.addEventListener || !windowObj?.location) {
    throw new TypeError("initRouter requires a window-like object");
  }

  const dispatch = () => {
    const route = parseRoute(windowObj.location.hash);
    const view = resolveRoute(route, dataIndex);
    setCurrentNavigation(links, route);
    const renderedRoot = onRoute(view, route);
    const focusRoot = renderedRoot?.querySelector ? renderedRoot : root;
    if (focusRoot) focusRouteHeading(focusRoot);
  };

  windowObj.addEventListener("hashchange", dispatch);
  dispatch();

  return () => windowObj.removeEventListener?.("hashchange", dispatch);
}
