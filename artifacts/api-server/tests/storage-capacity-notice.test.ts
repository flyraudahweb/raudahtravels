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

it("opens on sign-in and reminds only the approved session after dismissal", async () => {
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

  try {
    await render();
    expect(popup()?.textContent).toContain(notice.title);
    expect(popup()?.querySelector("button")?.textContent).toBe("Remind me in 5 minutes");
    await dismiss();
    expect(popup()).toBeNull();

    await render(false);
    await render();
    await act(async () => { vi.advanceTimersByTime(299_999); });
    expect(popup()).toBeNull();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(popup()?.textContent).toContain(notice.title);

    await dismiss();
    auth.sessionId = null;
    await render();
    expect(popup()).toBeNull();

    auth.sessionId = "other-session";
    client.setQueryData(["account-storage-notice", auth.sessionId], { notice: null });
    await render();
    await act(async () => { vi.advanceTimersByTime(300_000); });
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
