// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  signedIn: false,
  error: false,
  loading: false,
  search: "",
  settings: { landing_hero: { slideshowEnabled: true, aircraftEnabled: true }, room_surcharges: {} as Record<string, number> },
  formFields: [] as Array<{ fieldName: string; enabled: boolean; required: boolean }>,
  packages: [] as any[],
  refetch: vi.fn(),
  createBooking: vi.fn(),
  paystackEnabled: true,
  savedBooking: null as any,
  payments: [] as any[],
}));
vi.mock("wouter", () => ({
  useSearch: () => state.search,
  useLocation: () => ["/dashboard/book/umrah-a", vi.fn()],
  useRoute: () => [true, { id: "umrah-a" }],
  Link: ({ href, children, ...props }: any) =>
    h("a", { href, ...props }, children),
}));
vi.mock("@clerk/react", () => ({
  useUser: () => ({
    isSignedIn: state.signedIn,
    user: state.signedIn ? { id: "customer-a", firstName: "Test", lastName: "Traveller" } : undefined,
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[0] === "admin-booking-form-fields" ? { fields: state.formFields }
      : queryKey[0] === "app-config" ? { paystackEnabled: state.paystackEnabled }
      : state.settings,
  }),
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
  useCreateBooking: () => ({ mutateAsync: state.createBooking }),
  useGetBooking: () => ({ data: state.savedBooking }),
  useListPayments: () => ({ data: { payments: state.payments } }),
  getListPaymentsQueryKey: () => ["payments"],
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
import Terms from "../../raudah-travels/src/pages/public/Terms";
import BookingWizard from "../../raudah-travels/src/pages/dashboard/BookingWizard";
import DashboardPayExisting from "../../raudah-travels/src/pages/dashboard/DashboardPayExisting";
import DashboardPayments from "../../raudah-travels/src/pages/dashboard/DashboardPayments";

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
  state.formFields = [];
  state.paystackEnabled = true;
  state.savedBooking = null;
  state.payments = [];
  state.settings = {
    landing_hero: { slideshowEnabled: true, aircraftEnabled: true },
    room_surcharges: {},
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
  state.createBooking.mockReset().mockResolvedValue({ id: "package-booking" });
  window.matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  window.scrollTo = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
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
it("lets package customers continue without entering passport expiry or issuing authority", async () => {
  state.signedIn = true;
  state.formFields = ["passportExpiry", "passportIssuingAuthority"].map((fieldName) => ({
    fieldName,
    enabled: true,
    required: true,
  }));
  await render(h(BookingWizard));
  expect(container.querySelector("#packageDepartureCity")).not.toBeNull();
  await act(async () => button("Continue").click());
  expect(container.querySelector("#passportNumber")).not.toBeNull();
  expect(container.querySelector("#passportIssueDate")).not.toBeNull();
  expect(container.querySelector("#passportExpiry, #passportIssuingAuthority")).toBeNull();

  await act(async () => button("Continue").click());
  expect(container.querySelector('label[for="firstName"]')?.textContent).toBe("First Name");
  expect(container.querySelector('label[for="lastName"]')?.textContent).toBe("Last Name");
});
it("collects package departure and room choices once and carries them into checkout", async () => {
  state.signedIn = true;
  state.settings.room_surcharges = { double: 150000 };
  state.packages[0].packageDates = [{
    id: "kano-flight", outbound: "2030-01-10", returnDate: "2030-01-20",
    outboundRoute: "KANO-JEDDAH", airline: "Example Airline",
  }];
  await render(h(BookingWizard));
  const select = async (id: string, text: string) => {
    await act(async () => container.querySelector(`#${id}`)!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ));
    const option = Array.from(document.querySelectorAll('[role="option"]'))
      .find((item) => item.textContent?.includes(text))!;
    await act(async () => option.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    ));
  };

  expect(container.querySelector("#packageDepartureCity")).toBeNull();
  await act(async () => button("✈ KANO").click());
  await select("packageDateId", "KANO-JEDDAH");
  await select("packageRoomPreference", "Double (2 persons)");

  for (let step = 0; step < 3; step++) await act(async () => button("Continue").click());
  expect(container.textContent).toContain("Contact & Address");
  expect(container.textContent).not.toContain("Departure City");
  expect(container.textContent).not.toContain("Room Preference");
  expect(container.querySelector("#specialRequests")).not.toBeNull();

  await act(async () => button("Continue").click());
  expect(container.textContent).toContain("Room surcharge (double)");
  expect(container.textContent).not.toContain("Bank Transfer");
  expect(container.textContent).not.toContain("Cash at Office");
  expect(container.textContent).not.toContain("Minimum Deposit");
  state.paystackEnabled = false;
  await render(h(BookingWizard));
  expect(button("Pay Online · ₦2,550,000").disabled).toBe(true);
  expect(container.textContent).toContain("Online payment is currently unavailable");

  state.paystackEnabled = true;
  await render(h(BookingWizard));
  const gateway = vi.fn().mockResolvedValueOnce(Response.json({ accessCode: "checkout-token" }))
    .mockResolvedValueOnce(Response.json({ bookingConfirmed: true }));
  const resumeTransaction = vi.fn();
  vi.stubGlobal("fetch", gateway);
  vi.stubGlobal("PaystackPop", class { resumeTransaction = resumeTransaction; });
  await act(async () => button("Pay Online · ₦2,550,000").click());
  const submit = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'))
    .find((item) => item.textContent?.trim() === "Continue to Paystack")!;
  await act(async () => submit.click());
  expect(state.createBooking).toHaveBeenCalledWith({ data: expect.objectContaining({
    departureCity: "KANO", packageDateId: "kano-flight", roomPreference: "double", expectedTotal: 2550000,
  }) });
  expect(gateway.mock.calls[0][0]).toBe("/api/payments/paystack/initialize");
  expect(JSON.parse(gateway.mock.calls[0][1].body).bookingId).toBe("package-booking");
  expect(resumeTransaction).toHaveBeenCalledWith("checkout-token", expect.any(Object));
  await act(async () => resumeTransaction.mock.calls[0][1].onSuccess({ reference: "RDH-test" }));
  expect(gateway.mock.calls[1][0]).toBe("/api/payments/paystack/verify");
  expect(container.textContent).toContain("Booking Confirmed!");
});
it("opens Paystack to pay an existing package balance and keeps historical payment records visible", async () => {
  state.signedIn = true;
  state.savedBooking = { status: "pending", pilgrimCount: 1, totalPrice: 2400000, amountPaid: 500000, package: fixture() };
  const gateway = vi.fn().mockResolvedValue(Response.json({ verified: true, reference: "RDH-existing" }));
  vi.stubGlobal("fetch", gateway);
  await render(h(DashboardPayExisting));
  expect(container.textContent).not.toContain("Bank Transfer");
  expect(container.textContent).not.toContain("Cash at Office");
  await act(async () => button("Pay Online · ₦1,900,000").click());
  expect(gateway).toHaveBeenCalledWith("/api/payments/paystack/initialize", expect.objectContaining({ method: "POST" }));
  expect(container.textContent).toContain("Payment Confirmed!");

  state.payments = [{ id: "legacy-payment", status: "verified", method: "bank_transfer", amount: 500000, createdAt: "2026-01-01" }];
  await render(h(DashboardPayments));
  expect(container.textContent).toContain("Bank Transfer");
  expect(button("Record Payment")).toBeUndefined();
  expect(container.querySelector('a[href="/dashboard/bookings"]')?.textContent).toContain("Pay Online");
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
it("uses the simpler homepage copy and preserves desktop imagery controls", async () => {
  await render(h(Home));
  expect(container.querySelector('a[href="/app"]')).toBeNull();
  expect(container.textContent).toContain("Raudah App coming soon");
  expect(
    container.querySelectorAll('[data-testid="home-hero-images"] img'),
  ).toHaveLength(5);
  expect(container.querySelector("#home-hero-heading")?.textContent).toBe(
    "Travel simply. Pray peacefully. Explore with confidence.",
  );
  expect(container.querySelector('[aria-labelledby="home-hero-heading"]')?.textContent).toBe(
    "Travel simply. Pray peacefully. Explore with confidence.Raudah Travel & Tours",
  );
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
    container.querySelectorAll('[data-testid="home-hero-images"] img'),
  ).toHaveLength(0);
});
it("uses the brand gradient without loading hero photography on mobile", async () => {
  window.matchMedia = vi.fn((query) => ({
    matches: query !== "(min-width: 768px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  await render(h(Home));
  const hero = container.querySelector('[aria-labelledby="home-hero-heading"]')!;
  expect(hero.classList.contains("bg-gradient-to-br")).toBe(true);
  expect(hero.querySelector("img")).toBeNull();
  expect(hero.textContent).toContain("Raudah Travel & Tours");
  expect(container.textContent).toContain("Travel search");
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
  const policy = container.querySelector("table")!;
  expect(policy.caption?.textContent).toBe("Package cancellation and refund rules");
  expect(policy.tBodies[0].rows).toHaveLength(4);
  expect(policy.textContent).toContain("You may be eligible for a partial refund.");
  expect(policy.textContent).toContain("The package is non-refundable.");
  expect(policy.textContent).toContain("Flights booked separately");
  expect(container.querySelector('a[href="/terms#package-cancellations"]')).not.toBeNull();
  expect(
    container.querySelectorAll(
      'a[href="/sign-in?redirect_url=/dashboard/book/umrah-a"]',
    ),
  ).toHaveLength(2);
  state.packages[0].isRegistrationClosed = true;
  await render(h(PackageDetail));
  expect(container.querySelector('a[href*="/dashboard/book/"]')).toBeNull();
  await render(h(Terms));
  expect(container.querySelector("table")?.textContent).toBe(policy.textContent);
});
