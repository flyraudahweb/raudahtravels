// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import AdminEhajj from "../../raudah-travels/src/pages/admin/AdminEhajj";

vi.mock("@clerk/react", () => ({
  useUser: () => ({ user: { id: "super" } }),
}));

it("shows HTTPS setup instead of fetching packages when the provider is unavailable", async () => {
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
  try {
    await act(async () =>
      root.render(
        createElement(
          QueryClientProvider,
          { client },
          createElement(AdminEhajj),
        ),
      ),
    );
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(container.textContent).toContain("Provider setup required");
    });
    expect(container.textContent).toContain("Booking to delivery");
    const packages = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Packages & pilgrims"),
    );
    expect(packages).toBeDefined();
    await act(async () => packages?.click());
    expect(container.textContent).toContain("Ask EHajj for its HTTPS API URL");
    expect(fetchApi.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/ehajj/access",
      "/api/admin/ehajj/settings",
    ]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    client.clear();
    vi.unstubAllGlobals();
  }
});
