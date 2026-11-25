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
  FlightItinerary,
  TravelShell,
} from "../../raudah-travels/src/components/ota/TravelSearchPage";
import TravelCheckout from "../../raudah-travels/src/components/ota/TravelCheckout";
import TravelBooking from "../../raudah-travels/src/components/ota/TravelBooking";
import { OtaRequestError } from "../../raudah-travels/src/lib/ota";

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
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
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
  it("adds and removes multi-city fields and keeps the selected flights in the search URL", async () => {
    const { default: TravelSearchForm } = await vi.importActual<
      typeof import("../../raudah-travels/src/components/ota/TravelSearchForm")
    >("../../raudah-travels/src/components/ota/TravelSearchForm");
    client.setQueryData(["ota", "public-config"], { multiCityFlightSearchEnabled: true });
    const initial = new URLSearchParams([
      ["leg", "LOS,JED,2099-01-01"],
      ["leg", "MED,CAI,2099-01-06"],
    ]);
    await render(h(TravelSearchForm, { initial }));
    expect(container.querySelector<HTMLInputElement>('input[name="journey"]:checked')?.parentElement?.textContent).toBe("Multi-city");
    await act(async () => button("Add another flight").click());
    expect(container.textContent).toContain("Flight 3");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Remove flight 3"]')!.click());
    expect(container.textContent).not.toContain("Flight 3");

    const cabins = container.querySelectorAll<HTMLSelectElement>('select[aria-label="Cabin class for all flights"]');
    expect(cabins).toHaveLength(2);
    await act(async () => {
      cabins[1].value = "business";
      cabins[1].dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(cabins[0].value).toBe("business");
    expect(container.querySelector('button[aria-label="Travellers"]')).not.toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Swap airports for flight 2"]')!.click());

    await act(async () => button("Search flights").click());
    expect(state.navigate).toHaveBeenCalledOnce();
    const target = new URL(state.navigate.mock.calls[0][0], "https://example.test");
    expect(target.pathname).toBe("/flights/search");
    expect(target.searchParams.getAll("leg")).toEqual(["LOS,JED,2099-01-01", "CAI,MED,2099-01-06"]);
    expect(target.searchParams.get("cabinClass")).toBe("business");
    expect(target.searchParams.has("returnDate")).toBe(false);
  });
  it("preserves the shared trip and disables multi-city search when no supplier supports it", async () => {
    const { default: TravelSearchForm } = await vi.importActual<
      typeof import("../../raudah-travels/src/components/ota/TravelSearchForm")
    >("../../raudah-travels/src/components/ota/TravelSearchForm");
    client.setQueryData(["ota", "public-config"], { multiCityFlightSearchEnabled: false });
    await render(h(TravelSearchForm, {
      initial: new URLSearchParams("leg=LOS,JED,2099-01-01&leg=MED,CAI,2099-01-06"),
    }));
    expect(container.textContent).toContain("Multi-city search is currently unavailable.");
    expect(container.textContent).toContain("Flight 2");
    expect(container.querySelector<HTMLInputElement>('input[name="journey"]:checked')?.disabled).toBe(true);
    expect(button("Search flights").disabled).toBe(true);
    await act(async () => button("Search flights").click());
    expect(state.navigate).not.toHaveBeenCalled();
  });
  it("labels multi-city results and fare cards consistently", async () => {
    const { default: FlightResults } = await vi.importActual<
      typeof import("../../raudah-travels/src/components/ota/FlightResults")
    >("../../raudah-travels/src/components/ota/FlightResults");
    const flight = {
      origin: { iata_code: "LOS" },
      destination: { iata_code: "JED" },
      departing_at: "2099-01-01T08:00:00",
      arriving_at: "2099-01-01T12:20:00",
    };
    await render(h(FlightResults, {
      query: new URLSearchParams("leg=LOS,JED,2099-01-01&leg=MED,CAI,2099-01-06"),
      offers: [{ ...offer("multi").offer, pricing, slices: [
        { origin: flight.origin, destination: flight.destination, duration: "PT15600S", segments: [flight] },
      ] }],
      details: (selected) => h(FlightItinerary, { offer: selected }),
      onDate: vi.fn(),
    }));
    expect(container.textContent).toContain("Your multi-city options");
    expect(container.textContent).toContain("Multi-city · Economy");
    expect(container.textContent).not.toContain("One way");
    expect(container.querySelector("article details")?.textContent).toContain("4h 20m · Non-stop");
  });
  it("searches a shared multi-city URL with all legs in order", async () => {
    state.search = new URLSearchParams([
      ["leg", "LOS,JED,2099-01-01"],
      ["leg", "MED,CAI,2099-01-06"],
      ["leg", "CAI,LOS,2099-01-09"],
      ["adults", "2"],
      ["cabinClass", "business"],
    ]).toString();
    state.api.mockResolvedValue({ offers: [] });
    await render(h(TravelSearchPage, { kind: "flight" }));

    expect(state.api.mock.calls.find(([path]) => path === "/flights/search")?.[1]).toEqual({
      legs: [
        { origin: "LOS", destination: "JED", departureDate: "2099-01-01" },
        { origin: "MED", destination: "CAI", departureDate: "2099-01-06" },
        { origin: "CAI", destination: "LOS", departureDate: "2099-01-09" },
      ],
      adults: 2,
      childAges: [],
      cabinClass: "business",
    });
  });
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
  it("guides a customer back to the saved route when a fare changes before payment", async () => {
    const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    state.api.mockImplementation((path: string) => {
      if (path === "/bookings/a/pay")
        return Promise.reject(new OtaRequestError("Internal fare mismatch", "flight_fare_changed"));
      if (path === "/bookings/a") return Promise.resolve({
        booking: {
          ...booking("a"),
          offer: {
            cabin_class: "business",
            passengers: [{ type: "adult" }, { type: "child", age: 8 }],
            slices: [{ origin: { iata_code: "LOS" }, destination: { iata_code: "ABV" },
              segments: [{ departing_at: date + "T08:00:00" }] }],
          },
        },
      });
      return Promise.resolve({});
    });
    await render(h(TravelBooking, { bookingId: "a" }));
    expect(container.querySelector("h1")?.classList.contains("text-white")).toBe(true);
    await act(async () => button("Pay ₦").click());
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("The flight price has changed");
    expect(alert?.textContent).not.toContain("Internal fare mismatch");
    expect(document.activeElement).toBe(alert);
    const url = new URL(alert!.querySelector("a")!.href);
    expect(url.pathname).toBe("/flights/search");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      origin: "LOS", destination: "ABV", departureDate: date,
      cabinClass: "business", adults: "1", childAges: "8",
    });
    expect(button("I have paid")).toBeTruthy();
    expect(button("Pay ₦")).toBeUndefined();
  });

  it("shows a current fare and resumes payment on the saved checkout after approval", async () => {
    const save = deferred();
    const saved = {
      ...booking("a"), canRefreshFlightFare: true,
      offer: { slices: [], cabin_class: "economy" },
      contact: { email: "test@example.test" }, travellers: [{ id: "pas_a" }],
    };
    let payRequests = 0;
    state.api.mockImplementation((path: string) => {
      if (path === "/bookings/a") return Promise.resolve({ booking: saved });
      if (path === "/bookings/a/pay") return Promise.reject(++payRequests === 1
        ? new OtaRequestError("Fare changed", "flight_fare_changed")
        : new Error("Payment service is unavailable. Try again."));
      if (path === "/bookings/a/flight-fare") return Promise.resolve({
        offer: { id: "current-fare", cabin_class: "economy" },
        pricing: { totalKobo: 120000 }, revision: 0,
      });
      if (path === "/bookings") return save.promise;
      return Promise.resolve({});
    });
    await render(h(TravelBooking, { bookingId: "a" }));
    await act(async () => button("Pay ₦").click());
    expect(state.api.mock.calls.filter(([path]) => path === "/bookings/a/flight-fare")).toHaveLength(1);
    expect(container.textContent).toContain("Current total");
    expect(container.textContent).toContain("₦1,200.00");
    expect(payRequests).toBe(1);
    await act(async () => {
      button("Accept fare and pay").click();
      button("Accept fare and pay").click();
    });
    const checkoutSaves = state.api.mock.calls.filter(([path]) => path === "/bookings");
    expect(checkoutSaves).toHaveLength(1);
    expect(checkoutSaves[0][1]).toMatchObject({
      editBookingId: "a", editRevision: 0, refreshFlightFare: true, offerId: "current-fare",
      expectedTotalKobo: 120000, contact: saved.contact, travellers: saved.travellers,
    });
    await act(async () => save.resolve({ booking: { ...saved, amountKobo: 120000, revision: 1 } }));
    expect(payRequests).toBe(2);
    expect(button("Pay ₦1,200.00")).toBeTruthy();
    expect(container.textContent).toContain("Payment service is unavailable. Try again.");
  });

  it("refreshes a changed Nuitee fare without clearing the traveller form", async () => {
    const initial = offer("nfa_example");
    const updatedPricing = { ...pricing, totalKobo: 120000 };
    let priceChanged = false;
    state.api.mockImplementation((path: string) => {
      if (path === "/config") return Promise.resolve({ nuiteeFlightCheckoutEnabled: true });
      if (path === "/bookings") {
        if (priceChanged) return Promise.resolve({ booking: booking("renewed") });
        priceChanged = true;
        return Promise.reject(new OtaRequestError("Fare changed", "flight_fare_changed"));
      }
      return Promise.resolve(priceChanged ? { ...initial, pricing: updatedPricing } : initial);
    });
    await render(h(TravelCheckout, { kind: "flight", offerId: "nfa_example" }));
    const form = container.querySelector("form")!;
    const firstName = form.querySelector<HTMLInputElement>('[name="given_0"]')!;
    const terms = form.querySelector<HTMLInputElement>('[name="terms"]')!;
    firstName.value = "Umar";
    terms.checked = true;
    const submit = () => act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await submit();
    expect(state.navigate).not.toHaveBeenCalled();
    expect(firstName.value).toBe("Umar");
    expect(terms.checked).toBe(false);
    expect(button("Continue at ₦1,200.00")).toBeTruthy();
    terms.checked = true;
    await submit();
    expect(state.api.mock.calls.filter(([path]) => path === "/bookings").at(-1)?.[1]).toMatchObject({
      expectedTotalKobo: 120000, travellers: [{ given_name: "Umar" }],
    });
    expect(state.navigate).toHaveBeenCalledWith("/travel/bookings/renewed");
  });

  it("withholds itinerary downloads until the updated Nuitee schedule is verified", async () => {
    const confirmedOffer = { slices: [{ segments: [{ departing_at: "2099-01-01T08:00:00" }] }] };
    state.api.mockImplementation((path: string) => {
      if (path === "/bookings/under-review" || path === "/bookings/verified") return Promise.resolve({
        booking: { ...booking(path.split("/").at(-1)!, "confirmed"), supplier: "nuitee", offer: confirmedOffer,
          providerResult: { itineraryReview: path.endsWith("under-review") } },
      });
      return Promise.resolve({ events: [] });
    });
    await render(h(TravelBooking, { bookingId: "under-review" }));
    expect(button("Download itinerary PDF")).toBeUndefined();
    expect(button("Print itinerary / voucher")).toBeUndefined();
    await render(h(TravelBooking, { bookingId: "verified" }));
    expect(button("Download itinerary PDF")).toBeTruthy();
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
  it("uses first and last name labels and hides passport details for a fare that does not require them", async () => {
    state.api.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/config"
          ? { salesEnabled: true }
          : path === "/bookings"
            ? { booking: booking("saved") }
            : offer("off_a"),
      ),
    );
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_a" }));
    expect(container.querySelector('[name="given_0"]')?.closest("label")?.textContent).toBe("First Name");
    expect(container.querySelector('[name="family_0"]')?.closest("label")?.textContent).toBe("Last Name");
    const passport = container.querySelector<HTMLInputElement>('[name="passport_0"]')!;
    expect(passport.required).toBe(false);
    expect(container.querySelector('[name="country_0"]')).toBeNull();
    expect(container.querySelector('[name="expiry_0"]')).toBeNull();

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(passport, "A12345678");
      passport.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector<HTMLInputElement>('[name="country_0"]')?.required).toBe(true);
    expect(container.querySelector<HTMLInputElement>('[name="expiry_0"]')?.required).toBe(true);

    await act(async () => {
      setValue.call(passport, "");
      passport.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector('[name="country_0"]')).toBeNull();
    expect(container.querySelector('[name="expiry_0"]')).toBeNull();
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const save = state.api.mock.calls.find(([path]) => path === "/bookings");
    expect(save?.[1].travellers[0]).not.toHaveProperty("identity_documents");
  });
  it("keeps the full passport fields when the fare requires a passport", async () => {
    const result = offer("off_a");
    state.api.mockImplementation((path: string) =>
      Promise.resolve(path === "/config"
        ? { salesEnabled: true }
        : { ...result, offer: { ...result.offer, passenger_identity_documents_required: true } }),
    );
    await render(h(TravelCheckout, { kind: "flight", offerId: "off_a" }));
    for (const name of ["passport_0", "country_0", "expiry_0"])
      expect(container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.required).toBe(true);
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
