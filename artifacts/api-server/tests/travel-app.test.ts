// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  path: "/app",
  loaded: true,
  signedIn: false,
  navigate: vi.fn(),
  refetch: vi.fn(),
  error: false,
}));
vi.mock("wouter", () => ({
  useLocation: () => [state.path, state.navigate],
  Link: ({ href, children, ...props }: any) =>
    h("a", { href, ...props }, children),
}));
vi.mock("@clerk/react", () => ({
  useUser: () => ({
    isLoaded: state.loaded,
    isSignedIn: state.signedIn,
    user: state.signedIn ? { firstName: "Traveller" } : null,
  }),
  SignIn: ({ path, forceRedirectUrl }: any) =>
    h("div", {
      "data-auth": "login",
      "data-path": path,
      "data-return": forceRedirectUrl,
    }),
  SignUp: ({ path, forceRedirectUrl }: any) =>
    h("div", {
      "data-auth": "signup",
      "data-path": path,
      "data-return": forceRedirectUrl,
    }),
  UserButton: () => h("button", {}, "Account menu"),
}));
vi.mock("@workspace/api-client-react", () => ({
  useListPackages: () => ({
    isLoading: false,
    isError: state.error,
    refetch: state.refetch,
    data: {
      packages: [
        {
          id: "real-package",
          name: "Selected Umrah journey",
          type: "umrah",
          durationDays: 10,
          starRating: 4,
          price: 2400000,
        },
      ],
    },
  }),
}));
vi.mock("@/components/ota/TravelSearchForm", () => ({
  default: () => h("div", {}, "Travel search"),
}));
import TravelApp from "../../raudah-travels/src/pages/app/TravelApp";

let root: Root, container: HTMLDivElement;
async function render() {
  await act(async () => root.render(h(TravelApp)));
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  state.path = "/app";
  state.loaded = true;
  state.signedIn = false;
  state.error = false;
  state.navigate.mockReset();
  state.refetch.mockReset();
  window.scrollTo = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("keeps guest trip/account actions behind sign-in and renders actual package links", async () => {
  await render();
  const nav = container.querySelector(
    'nav[aria-label="App bottom navigation"]',
  )!;
  expect(
    Array.from(nav.querySelectorAll("a"))
      .filter((a) => /My trips|Account/.test(a.textContent || ""))
      .map((a) => a.getAttribute("href")),
  ).toEqual(["/app/login", "/app/login"]);
  expect(
    container.querySelector('a[href="/packages/real-package"]')?.textContent,
  ).toContain("Selected Umrah journey");
  expect(container.textContent).not.toContain("reservation is confirmed");
});
it("keeps auth verification subroutes on their app-specific Clerk flow and return URL", async () => {
  state.path = "/app/signup/verify-email-address";
  await render();
  expect(
    container.querySelector('[data-auth="signup"]')?.getAttribute("data-path"),
  ).toBe("/app/signup");
  expect(
    container
      .querySelector('[data-auth="signup"]')
      ?.getAttribute("data-return"),
  ).toBe("/app");
  state.path = "/app/login";
  state.loaded = false;
  await render();
  expect(container.querySelector('[role="status"]')?.textContent).toContain(
    "Preparing secure sign-in",
  );
  expect(container.querySelector('[data-auth="login"]')).toBeNull();
});
it("returns an authenticated customer from app login to app home", async () => {
  state.path = "/app/login";
  state.signedIn = true;
  await render();
  expect(state.navigate).toHaveBeenCalledWith("/app", { replace: true });
  expect(container.querySelector('[data-auth="login"]')).toBeNull();
});
it("shows supplier catalogue failures with a working retry instead of fabricated packages", async () => {
  state.error = true;
  await render();
  expect(
    container.querySelector('a[href="/packages/real-package"]'),
  ).toBeNull();
  const retry = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Try again",
  )!;
  await act(async () => retry.click());
  expect(state.refetch).toHaveBeenCalledOnce();
});
