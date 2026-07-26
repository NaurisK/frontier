import assert from "node:assert/strict";
import { test } from "node:test";

const navModule = await import("../js/nav.js");

function eventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, listener) {
      const group = listeners.get(type) ?? [];
      group.push(listener);
      listeners.set(type, group);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) ?? []).filter(item => item !== listener));
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    }
  };
}

function fixture() {
  const attributes = new Map([["aria-expanded", "false"]]);
  const classes = new Set();
  const links = [eventTarget(), eventTarget()];
  let focusCount = 0;
  const toggle = eventTarget({
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    focus: () => { focusCount += 1; }
  });
  const nav = {
    classList: {
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    querySelectorAll: selector => selector === "a" ? links : []
  };
  const documentRef = eventTarget({
    getElementById(id) {
      if (id === "nav-toggle") return toggle;
      if (id === "primary-nav") return nav;
      return null;
    }
  });
  return { attributes, classes, documentRef, focusCount: () => focusCount, links, nav, toggle };
}

test("mobile navigation module exports its public helpers", () => {
  assert.equal(typeof navModule.setNavigationOpen, "function");
  assert.equal(typeof navModule.initMobileNavigation, "function");
});

test("the toggle opens and closes the controlled navigation", () => {
  const view = fixture();
  const stop = navModule.initMobileNavigation({ documentRef: view.documentRef });

  view.toggle.dispatch("click");
  assert.equal(view.attributes.get("aria-expanded"), "true");
  assert.equal(view.nav.classList.contains("is-open"), true);

  view.toggle.dispatch("click");
  assert.equal(view.attributes.get("aria-expanded"), "false");
  assert.equal(view.nav.classList.contains("is-open"), false);

  stop();
});

test("following a navigation link closes the compact menu", () => {
  const view = fixture();
  navModule.initMobileNavigation({ documentRef: view.documentRef });
  view.toggle.dispatch("click");
  view.links[0].dispatch("click");
  assert.equal(view.attributes.get("aria-expanded"), "false");
  assert.equal(view.nav.classList.contains("is-open"), false);
});

test("Escape closes the menu and returns focus to its toggle", () => {
  const view = fixture();
  navModule.initMobileNavigation({ documentRef: view.documentRef });
  view.toggle.dispatch("click");
  view.documentRef.dispatch("keydown", { key: "Escape" });
  assert.equal(view.attributes.get("aria-expanded"), "false");
  assert.equal(view.nav.classList.contains("is-open"), false);
  assert.equal(view.focusCount(), 1);
});
