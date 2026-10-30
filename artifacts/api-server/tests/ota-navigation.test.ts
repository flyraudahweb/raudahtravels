// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  path: "/flights/search",
  search: "",
  navigate: vi.fn(),
  api: vi.fn(),
  user: {
    id: "customer-a",
    primaryEmailAddress: { emailAddress: "test@example.test" },
  },
}));
vi.mock("wouter", () => ({
  useLocation: () => [state.path, state.navigate],
  useSearch: () => state.search,
  Link: ({ children, href, ...props }: any) =>
    h("a", { href, ...props }, children),
}));
vi.mock("@clerk/react", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: state.user }),
  SignInButton: ({ children }: any) => children,
}));
vi.mock("@workspace/api-client-react", () => ({
  useGetProfile: () => ({ data: { id: "profile-a" } }),
  getGetProfileQueryKey: () => ["profile"],
}));
vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => h("nav", {}, "Navigation"),
}));
vi.mock("@/components/layout/Footer", () => ({
  Footer: () => h("footer", {}, "Footer"),
}));
vi.mock("@/components/ota/TravelSearchForm", () => ({
  default: () => h("div", {}, "Search form"),
}));
vi.mock("@/components/ota/ExchangeRates", () => ({ default: () => null }));
vi.mock("@/components/ota/FlightResults", () => ({
  default: () => h("div", {}, "Available flight options"),
  SearchLoading: () => h("div", {}, "Searching"),
}));
vi.mock("@/lib/ota", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  ota: (...args: any[]) => state.api(...args),
}));

import TravelSearchPage, {
  TravelShell,
} from "../../raudah-travels/src/components/ota/TravelSearchPage";
import TravelCheckout from "../../raudah-travels/src/components/ota/TravelCheckout";
import TravelBooking from "../../raudah-travels/src/components/ota/TravelBooking";

function deferred<T = any>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const pricing = {
  totalKobo: 100000,
  supplierKobo: 100000,
  markupKobo: 0,
  feeKobo: 0,
  currency: "NGN",
};
const offer = (id: string) => ({
  offer: {
    id,
    passengers: [{ id: "pas_a" }],
    slices: [],
    expires_at: new Date(Date.now() + 600000).toISOString(),
  },
  pricing,
});
const booking = (id: string, status = "payment_pending", revision = 0) => ({
  id,
  kind: "flight",
  mode: "test",
  status,
  revision,
  amountKobo: 100000,
  reference: `OTA-${id}`,
  offer: { slices: [] },
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  pricing,
  contact: {},
  travellers: [],
});
let container: HTMLDivElement, root: Root, client: QueryClient;
async function render(element: any) {
  await act(async () =>
    root.render(h(QueryClientProvider, { client }, element)),
  );
}
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((item) =>
    item.textContent?.includes(text),
  )!;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.path = "/flights/search";
  state.search = "";
  state.navigate.mockReset();
  state.api.mockReset();
  state.user = {
    id: "customer-a",
    primaryEmailAddress: { emailAddress: "test@example.test" },
  };
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(0), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  vi.unstubAllGlobals();
});

describe("OTA navigation and pending actions", () => {
  it("reveals a failed search at the results section instead of leaving an offscreen error", async () => {
    state.search =
      "origin=LOS&destination=JED&departureDate=2099-01-01&adults=1";
    const search = deferred();
    state.api.mockImplementation((path: string) =>
      path === "/config" ? Promise.resolve({}) : search.promise,
    );
    await render(h(TravelSearchPage, { kind: "flight" }));
    await act(async () => search.reject(new Error("No supplier connection")));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(container.textContent).toContain("No supplier connection");
    expect(document.activeElement).toBe(
      container.querySelector('[aria-label="Flight search results"]'),
    );
  });
  it("does not reveal an old customer's booking after the account changes", async () => {
    const previous = deferred();
    state.api.mockImplementation((path: string) =>
      path === "/config"
        ? Promise.resolve({})
        : state.user.id === "customer-a"
          ? previous.promise
          : Promise.reject(new Error("Access denied")),
    );
    await render(h(TravelBooking, { bookingId: "a" }));
    state.user = { ...state.user, id: "customer-b" };
    await render(h(TravelBooking, { bookingId: "a" }));
    await act(async () =>
      previous.resolve({ booking: booking("a", "confirmed", 1) }),
    );
    expect(container.textContent).toContain("Access denied");
    expect(container.textContent).not.toContain(
      "Your reservation is confirmed",
    );
  });
  it("reports missing supplier traveller data without crashing checkout", async () => {
    state.api.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/config"
          ? { salesEnabled: true }
          : { offer: { id: "off_a", slices: [] }, pricing },
      ),
    );
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_a" }));
    expect(container.textContent).toContain(
      "Traveller information is unavailable",
    );
    expect(container.querySelector("form")).toBeNull();
  });
  it("resets scroll for a new travel page without scrolling ordinary rerenders", async () => {
    await render(h(TravelShell, {}, h("div", {}, "Results")));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    await render(h(TravelShell, {}, h("div", {}, "Updated results")));
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    state.path = "/flights/checkout/off_a";
    await render(h(TravelShell, {}, h("div", {}, "Checkout")));
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      left: 0,
      behavior: "instant",
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
  it("reveals the results section after search completes", async () => {
    state.search =
      "origin=LOS&destination=JED&departureDate=2099-01-01&adults=1";
    const search = deferred();
    state.api.mockImplementation((path: string) =>
      path === "/config" ? Promise.resolve({}) : search.promise,
    );
    await render(h(TravelSearchPage, { kind: "flight" }));
    expect(container.textContent).toContain("Searching");
    await act(async () => {
      search.resolve({ offers: [] });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const results = container.querySelector(
      '[aria-label="Flight search results"]',
    );
    expect(document.activeElement).toBe(results);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "instant",
    });
  });
  it("prevents duplicate checkout submits and ignores a saved checkout after navigation", async () => {
    const save = deferred();
    state.api.mockImplementation((path: string) =>
      path === "/config"
        ? Promise.resolve({ salesEnabled: true })
        : path === "/bookings"
          ? save.promise
          : Promise.resolve(offer(path.split("/").at(-1)!)),
    );
    state.path = "/flights/checkout/off_a";
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_a" }));
    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    expect(
      state.api.mock.calls.filter((args) => args[0] === "/bookings"),
    ).toHaveLength(1);
    state.path = "/flights/checkout/off_b";
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_b" }));
    expect(button("Save and continue").disabled).toBe(false);
    await act(async () => save.resolve({ booking: booking("old-saved") }));
    expect(state.navigate).not.toHaveBeenCalled();
  });
  it("does not display a stale offer error on the next checkout", async () => {
    const old = deferred();
    state.api.mockImplementation((path: string) =>
      path === "/config"
        ? Promise.resolve({ salesEnabled: true })
        : path.endsWith("off_a")
          ? old.promise
          : Promise.resolve(offer("off_b")),
    );
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_a" }));
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_b" }));
    await act(async () => old.reject(new Error("Previous offer expired")));
    expect(container.textContent).not.toContain("Previous offer expired");
    expect(button("Save and continue")).toBeTruthy();
  });
  it("keeps the next booking's pending action intact when a previous check fails", async () => {
    const old = deferred(),
      next = deferred();
    state.api.mockImplementation((path: string) =>
      path === "/config"
        ? Promise.resolve({})
        : path.endsWith("timeline")
          ? Promise.resolve({ events: [] })
          : path.endsWith("/complete")
            ? path.includes("/a/")
              ? old.promise
              : next.promise
            : Promise.resolve({ booking: booking(path.split("/").at(-1)!) }),
    );
    await render(h(TravelBooking, { bookingId: "a" }));
    await act(async () => {
      button("I have paid").click();
      button("I have paid").click();
    });
    expect(
      state.api.mock.calls.filter((args) => args[0] === "/bookings/a/complete"),
    ).toHaveLength(1);
    await render(h(TravelBooking, { bookingId: "b" }));
    await act(async () => button("I have paid").click());
    await act(async () => old.reject(new Error("Old booking error")));
    expect(container.textContent).not.toContain("Old booking error");
    expect(button("I have paid").disabled).toBe(true);
    await act(async () =>
      next.resolve({ booking: booking("b", "confirmed", 1) }),
    );
    expect(container.textContent).toContain("Your reservation is confirmed");
  });
});
