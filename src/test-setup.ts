import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vite-plus/test";

// jsdom has no ResizeObserver, which OpenLayers uses to follow the map element's size.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom doesn't implement scrollTo, which the router calls on every navigation to restore the
// scroll position; without this each test logs "Not implemented".
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
