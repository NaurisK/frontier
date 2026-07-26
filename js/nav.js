export function setNavigationOpen(toggle, nav, open) {
  const nextOpen = Boolean(open);
  toggle.setAttribute("aria-expanded", String(nextOpen));
  nav.classList.toggle("is-open", nextOpen);
  return nextOpen;
}

export function initMobileNavigation({ documentRef = globalThis.document } = {}) {
  if (!documentRef) return () => {};

  const toggle = documentRef.getElementById("nav-toggle");
  const nav = documentRef.getElementById("primary-nav");
  if (!toggle || !nav) return () => {};

  const close = () => setNavigationOpen(toggle, nav, false);
  const onToggle = () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    setNavigationOpen(toggle, nav, !open);
  };
  const onKeyDown = event => {
    if (event.key !== "Escape" || toggle.getAttribute("aria-expanded") !== "true") return;
    close();
    toggle.focus();
  };
  const links = [...nav.querySelectorAll("a")];

  toggle.addEventListener("click", onToggle);
  documentRef.addEventListener("keydown", onKeyDown);
  links.forEach(link => link.addEventListener("click", close));
  close();

  return () => {
    toggle.removeEventListener("click", onToggle);
    documentRef.removeEventListener("keydown", onKeyDown);
    links.forEach(link => link.removeEventListener("click", close));
  };
}
