# FlyRaudah app starter

Implemented 30 October 2026 as a responsive web entry for the future OTA app.

## Routes

- `/app`: public Explore/home screen with the aircraft hero, flight/hotel search, package cards, booking steps, My Trips shortcut and support link.
- `/app/login`: app-styled Clerk sign-in. Verification/SSO subroutes remain under this path.
- `/app/signup`: app-styled Clerk sign-up. Verification/SSO subroutes remain under this path.
- Successful authentication returns to `/app`; a signed-in visitor to app authentication is redirected home.

The routes are lazy-loaded separately from the existing public homepage. The desktop layout has a sidebar; mobile uses a safe-area-aware bottom navigation. Existing website routes remain available.

## Existing integrations

- Uses the existing Clerk provider and account system; no second identity database or custom password handling was added.
- Reuses `TravelSearchForm` with an app-specific stacked layout, including existing airport, date, hotel-destination and traveller pickers. Its default website layout remains unchanged.
- Searches open the current `/flights/search` or `/hotels/search` flow, followed by the existing review, checkout and saved booking pages. These have not been reimplemented inside `/app` in this starting version.
- Packages come from the existing available-package API. The interface handles loading, request failure/retry and no available packages without fabricating offers.
- Signed-out My Trips/Account actions point to app login; signed-in actions open existing owner-scoped dashboard routes.
- Existing provider entitlement, online-sales switches and payment protections still govern booking. A new interface does not enable hotel access or payments.

## Verification

- Frontend TypeScript check and production build passed. Existing nonfatal Vite NODE_ENV, sourcemap and chunk-size warnings remain.
- 16 tests passed across app auth-state, search/navigation and travel-filter suites. New coverage checks verification-route handling, authenticated login redirects, guest action links and catalogue failure/retry behaviour.
- Headless browser inspection checked desktop home and exact 390px mobile home/login/signup. The three mobile routes reported document width equal to viewport width with no horizontal overflow. An initial screenshot cropped a larger browser viewport; exact viewport emulation confirmed the actual layout.
- Hero text contrast was corrected after visual inspection.
- The isolated browser did not finish loading Clerk, so visual checks of the actual hosted auth form and real sign-in/sign-up acceptance remain unverified. No account was created, session submitted, payment made or booking purchased.
- A temporary local preview relay forwarded only public catalogue/discovery GET requests. It is test tooling, not an application backend or a production configuration change.

## Scope

This is the first web app design and route foundation, not an installed native app or a replacement OTA engine. Native packaging, deep links, push notifications and app-specific results/checkout shells remain future work. Deploy the frontend before expecting `/app` on the public domain; no migration is required.
