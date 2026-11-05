// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signedIn: false,
  error: false,
  loading: false,
  search: "",
  settings: { landing_hero: { slideshowEnabled: true, aircraftEnabled: true } },
  packages: [] as any[],
  refetch: vi.fn(),
}));
vi.mock("wouter", () => ({
  useSearch: () => state.search,
  useRoute: () => [true, { id: "umrah-a" }],
  Link: ({ href, children, ...props }: any) =>
    h("a", { href, ...props }, children),
}));
vi.mock("@clerk/react", () => ({
  useUser: () => ({ isSignedIn: state.signedIn }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: state.settings }),
}));
vi.mock("@workspace/api-client-react", () => ({
  useListPackages: (params: any) => ({
    data: {
      packages: state.packages.filter(
        (p) => !params.type || p.type === params.type,
      ),
    },
    isLoading: state.loading,
    isError: state.error,
    refetch: state.refetch,
  }),
  getListPackagesQueryKey: (params: any) => ["packages", params],
  useGetPackage: () => ({ data: state.packages[0], isLoading: state.loading }),
  getGetPackageQueryKey: () => ["package"],
}));
vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => h("nav", {}, "Navigation"),
}));
vi.mock("@/components/layout/Footer", () => ({
  Footer: () => h("footer", {}, "Footer"),
}));
vi.mock("@/components/ota/OtaSearchWidget", () => ({
  default: () => h("div", {}, "Travel search"),
}));
vi.mock("@/components/ota/ExchangeRates", () => ({
  default: () => h("div", {}, "Exchange rates"),
}));
import PackageCard from "../../raudah-travels/src/components/packages/PackageCard";
import Home from "../../raudah-travels/src/pages/public/Home";
import Packages from "../../raudah-travels/src/pages/public/Packages";
import PackageDetail from "../../raudah-travels/src/pages/public/PackageDetail";

let container: HTMLDivElement, root: Root;
const fixture = (overrides = {}) =>
  ({
    id: "umrah-a",
    name: "Raudah Umrah Journey",
    type: "umrah",
    category: "premium",
    season: "Ramadan",
    description: "Our unchanged package description",
    price: 2400000,
    agentDiscount: 100000,
    depositAmount: 400000,
    durationDays: 10,
    departureDate: "2030-01-10",
    returnDate: "2030-01-20",
    departureCities: ["Lagos", "Abuja"],
    airlines: ["Example Airline"],
    maxCapacity: 30,
    currentBookings: 8,
    inclusions: [
      "Hotel accommodation",
      "Visa processing",
      "Transfers",
      "Guidance",
    ],
    imageUrl: null,
    starRating: 4,
    countdownEnabled: false,
    isRegistrationClosed: false,
    ...overrides,
  }) as any;
async function render(element: any) {
  await act(async () => root.render(element));
}
const button = (text: string) =>
  Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim() === text,
  )!;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.signedIn = false;
  state.error = false;
  state.loading = false;
  state.search = "";
  state.settings = {
    landing_hero: { slideshowEnabled: true, aircraftEnabled: true },
  };
  state.packages = [
    fixture(),
    fixture({
      id: "hajj-b",
      name: "Raudah Hajj Journey",
      type: "hajj",
      category: "standard",
    }),
  ];
  state.refetch.mockReset();
  window.matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  window.scrollTo = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("preserves card content and guest booking destination without nested links", async () => {
  await render(h(PackageCard, { pkg: fixture(), detailed: true }));
  expect(
    container.querySelector(
      'a[href="/sign-in?redirect_url=/dashboard/book/umrah-a"]',
    )?.textContent,
  ).toBe("Book Now");
  expect(container.querySelector("a a")).toBeNull();
  for (const text of [
    "2,400,000",
    "per person",
    "10 Days",
    "22 spots left",
    "Example Airline",
    "Lagos, Abuja",
    "Visa processing",
    "+1 more inclusions",
    "Agent: ₦2,300,000",
  ])
    expect(container.textContent).toContain(text);
  expect(container.textContent).not.toContain("VAT");
});
it("keeps signed-in booking links and disables sold-out or closed bookings", async () => {
  state.signedIn = true;
  await render(h(PackageCard, { pkg: fixture() }));
  expect(
    container.querySelector('a[href="/dashboard/book/umrah-a"]'),
  ).not.toBeNull();
  await render(h(PackageCard, { pkg: fixture({ currentBookings: 30 }) }));
  expect(button("Sold Out").disabled).toBe(true);
  expect(
    container.querySelector('a[href="/dashboard/book/umrah-a"]'),
  ).toBeNull();
  await render(
    h(PackageCard, { pkg: fixture({ isRegistrationClosed: true }) }),
  );
  expect(button("Registration Closed").disabled).toBe(true);
  expect(container.querySelector('a[href="/packages/umrah-a"]')).not.toBeNull();
});
it("preserves catalogue filtering and resets the controlled price slider", async () => {
  await render(h(Packages));
  await act(async () => button("premium").click());
  expect(container.querySelectorAll("article")).toHaveLength(1);
  const slider = container.querySelector('[role="slider"]')!;
  await act(async () =>
    slider.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    ),
  );
  expect(container.textContent).toContain("No packages found");
  await act(async () => button("Clear filters").click());
  expect(container.querySelectorAll("article")).toHaveLength(2);
  expect(
    container.querySelector('[role="slider"]')?.getAttribute("aria-valuenow"),
  ).toBe("10000000");
});
it("keeps the homepage app link, featured type filters and image settings", async () => {
  await render(h(Home));
  expect(container.querySelector('a[href="/app"]')?.textContent).toContain(
    "Open Raudah App",
  );
  expect(
    container.querySelectorAll('[aria-label="Raudah travel photography"] img'),
  ).toHaveLength(5);
  await act(async () => button("Hajj").click());
  expect(container.querySelectorAll("article")).toHaveLength(1);
  expect(container.querySelector("article")?.textContent).toContain(
    "Raudah Hajj Journey",
  );
  state.settings.landing_hero = {
    slideshowEnabled: false,
    aircraftEnabled: false,
  };
  await render(h(Home));
  expect(
    container.querySelectorAll('[aria-label="Raudah travel photography"] img'),
  ).toHaveLength(0);
  expect(container.textContent).toContain("Every check-in is a new beginning");
});
it("provides retry on catalogue errors and preserves deposit and booking routes on detail", async () => {
  state.error = true;
  await render(h(Packages));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Unable to load packages",
  );
  await act(async () => button("Try again").click());
  expect(state.refetch).toHaveBeenCalledOnce();
  state.error = false;
  await render(h(PackageDetail));
  expect(container.textContent).toContain("Our unchanged package description");
  expect(container.textContent).toContain("Required Deposit: ₦400,000");
  expect(
    container.querySelectorAll(
      'a[href="/sign-in?redirect_url=/dashboard/book/umrah-a"]',
    ),
  ).toHaveLength(2);
  state.packages[0].isRegistrationClosed = true;
  await render(h(PackageDetail));
  expect(container.querySelector('a[href*="/dashboard/book/"]')).toBeNull();
});
