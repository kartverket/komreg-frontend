import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vite-plus/test";
import { App } from "./App";

function renderAt(path: string) {
  return render(<App history={createMemoryHistory({ initialEntries: [path] })} />);
}

describe("App", () => {
  it("renders the front page with the nav", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "KomReg" })).toBeVisible();
    expect(screen.getByRole("navigation")).toBeVisible();
  });

  it("opens the map full screen, without the nav, and goes back", async () => {
    renderAt("/");
    await userEvent.click(await screen.findByRole("link", { name: "Kart" }));
    expect(await screen.findByRole("region", { name: "Kart over Norge" })).toBeInTheDocument();
    // Visually hidden, but the page still has an h1 for screen readers.
    expect(screen.getByRole("heading", { level: 1, name: "Kart" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Forsiden" }));
    expect(await screen.findByRole("heading", { level: 1, name: "KomReg" })).toBeVisible();
  });

  it("shows a not-found page for an unknown path", async () => {
    renderAt("/finnes-ikke");
    expect(await screen.findByRole("heading", { name: "Fant ikke siden" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Gå til forsiden" })).toBeVisible();
  });

  it("shows our error page, with the nav, when a page throws", async () => {
    // OpenLayers creates its ResizeObserver when the map is built, so this makes /kart throw.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor() {
          throw new Error("kartet feilet");
        }
      },
    );
    // React logs every error an error boundary catches; keep the test output clean.
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAt("/kart");
    expect(await screen.findByRole("heading", { name: "Noe gikk galt" })).toBeVisible();
    expect(screen.getByRole("navigation")).toBeVisible();
    expect(screen.getByRole("button", { name: "Last inn siden på nytt" })).toBeVisible();
  });
});
