// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import AdminEhajj from "../../raudah-travels/src/pages/admin/AdminEhajj";

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: { id: "super" } }),
}));

it("opens the sole product's roster and lets staff reach later records", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const requested: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    const path = url.replace("/api/admin/ehajj", "");
    requested.push(path);
    if (path === "/access")
      return Response.json({ allowed: true, manage: true });
    if (path === "/settings") return Response.json({ enabled: true });
    if (path === "/products")
      return Response.json({
        products: [
          {
            id: 42,
            name: "Umrah programme",
            activity: "OUMRAH",
            edition: "2027",
            permissions: [],
          },
        ],
      });
    if (path === "/products/42/pilgrims")
      return Response.json({
        pilgrims: Array.from({ length: 26 }, (_, index) => ({
          id: index + 1,
          fields: { "First name": "Pilgrim " + (index + 1) },
        })),
      });
    throw new Error("Unexpected request " + path);
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  const button = (label: string) =>
    [...container.querySelectorAll("button")].find(
      ({ textContent }) => textContent?.trim() === label,
    );
  async function expectText(text: string) {
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.textContent).toContain(text);
    });
  }
  try {
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(AdminEhajj, { onExit: vi.fn() }),
        ),
      ),
    );
    await expectText("Browse packages");
    await act(async () => button("Browse packages")?.click());
    await expectText("Showing 1–25 of 26 registered pilgrims");
    expect(document.activeElement?.textContent).toBe("Packages & pilgrims");
    expect(requested).toContain("/products/42/pilgrims");
    await act(async () => button("Next")?.click());
    await expectText("Showing 26–26 of 26 registered pilgrims");
    await act(async () => button("Pilgrim 26#26")?.click());
    const summary = container.querySelector('[aria-label="Pilgrim summary"]');
    expect(summary?.textContent).toContain("Pilgrim 26");
    expect(document.activeElement).toBe(summary);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    vi.unstubAllGlobals();
  }
});

it("keeps the overview clear and the connection accessible while EHajj is disconnected", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const fetchApi = vi.fn(async (url: string) => {
    if (url.endsWith("/access"))
      return Response.json({ allowed: true, manage: true });
    if (url.endsWith("/settings"))
      return Response.json({
        baseUrl: null,
        enabled: false,
        saved: false,
        hasAgencyKey: true,
        encryptionReady: true,
      });
    throw new Error("Unexpected request " + url);
  });
  vi.stubGlobal("fetch", fetchApi);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  const onExit = vi.fn();
  try {
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(AdminEhajj, { onExit }),
        ),
      ),
    );
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.textContent).toContain("Booking to delivery");
    });
    expect(container.textContent).not.toContain("Provider setup required");
    const packages = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Packages & pilgrims"),
    );
    expect(packages).toBeDefined();
    await act(async () => packages?.click());
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.textContent).toContain("EHajj is disconnected.");
    });
    expect(container.textContent).toContain("Connection settings");
    expect(container.textContent).not.toContain(
      "Ask EHajj for its HTTPS API URL",
    );
    expect(fetchApi.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/ehajj/access",
      "/api/admin/ehajj/settings",
    ]);
    const exit = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Exit workspace"),
    );
    await act(async () => exit?.click());
    expect(onExit).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onExit).toHaveBeenCalledTimes(2);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    vi.unstubAllGlobals();
  }
});
