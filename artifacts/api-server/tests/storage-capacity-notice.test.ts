// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StorageCapacityNotice } from "../../raudah-travels/src/components/StorageCapacityNotice";

const auth = vi.hoisted(() => ({ sessionId: "approved-session" as string | null }));
vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: Boolean(auth.sessionId), sessionId: auth.sessionId }),
}));

it("holds the notice for 30 seconds on each appearance for approved sessions", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const client = new QueryClient();
  const notice = { title: "FlyRaudah storage is 95% full", message: "Upgrade your storage soon." };
  client.setQueryData(["account-storage-notice", "approved-session"], { notice });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (showNotice = true) => act(async () => {
    root.render(createElement(QueryClientProvider, { client }, showNotice
      ? createElement(StorageCapacityNotice)
      : null));
  });
  const popup = () => document.querySelector('[role="alertdialog"]');
  const dismiss = () => act(async () => {
    popup()?.querySelector("button")?.click();
  });
  const advance = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });

  try {
    await render();
    expect(popup()?.textContent).toContain(notice.title);
    expect(popup()?.querySelector("button")?.textContent).toBe("Remind me in 30 seconds");
    expect(popup()?.textContent).toContain("You can continue in 30s.");
    expect(popup()?.querySelector("button")?.disabled).toBe(true);
    expect(container.getAttribute("aria-hidden")).toBe("true");
    await dismiss();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(popup()).not.toBeNull();
    await advance(29_999);
    expect(popup()?.textContent).toContain("You can continue in 1s.");
    expect(popup()?.querySelector("button")?.disabled).toBe(true);
    await advance(1);
    expect(popup()?.querySelector("button")?.disabled).toBe(false);
    await dismiss();
    expect(popup()).toBeNull();

    await render(false);
    await render();
    await advance(29_999);
    expect(popup()).toBeNull();
    await advance(1);
    expect(popup()?.textContent).toContain(notice.title);

    await dismiss();
    expect(popup()?.querySelector("button")?.disabled).toBe(true);
    auth.sessionId = null;
    await render();
    expect(popup()).toBeNull();

    auth.sessionId = "other-session";
    client.setQueryData(["account-storage-notice", auth.sessionId], { notice: null });
    await render();
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(popup()).toBeNull();

    auth.sessionId = "new-approved-session";
    client.setQueryData(["account-storage-notice", auth.sessionId], { notice });
    await render();
    expect(popup()?.textContent).toContain(notice.title);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    window.sessionStorage.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
