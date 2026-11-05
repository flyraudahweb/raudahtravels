# Nusuk-inspired Raudah interface

Implemented locally on 5 November 2026. Based on the supplied screenshots and the earlier public-site research. No deployment, migration or production settings change.

## What changed

- Homepage: white split hero, existing indigo/orange brand colours, existing headline and service copy, rounded photography panel and quieter surfaces. The primary search appears first on smaller screens.
- Header imagery: existing slideshow, pause, image selection, reduced-motion handling and independently configurable aircraft visibility remain connected to the same admin settings.
- Search: a landing-page appearance for the existing flight/hotel form; the form's validation, pickers, query parameters and destination routes remain shared with the existing OTA experience.
- Packages: one reusable card for homepage and catalogue, visible price basis, separate details/booking links and expandable information retaining inclusions, availability and catalogue airline/departure details. Featured Hajj/Umrah filters use the existing public package endpoint.
- Catalogue: simpler surfaces and filter styling, accessible mobile filter sheet, recoverable request errors. Fixed the uncontrolled price slider and filter-panel remount so the slider resets alongside results.
- Detail: clear title/price header, rounded imagery, readable sections, sticky desktop booking panel and mobile booking action. Existing description, inclusions, schedule, price and deposit remain visible. Both action locations respect sold-out/registration-closed states and use the existing authentication return path.
- App promotion: branded phone illustration and a real `/app` entry point, with existing flights/hotels/trips content alongside. The illustration is decorative; it does not claim a native store release or introduce another booking backend.

Existing homepage testimonials, admin-configured statistics, consultancy content, support links and footer content are retained. No Nusuk accreditation, government branding, statistics or package data were copied into Raudah.

## Verification

- 158 tests passed across 15 suites, including the new public-design regressions and existing OTA payment, race/reconciliation, API, search, navigation and app coverage.
- The known separate Windows registration integration suite was excluded; this change does not touch that feature.
- Frontend TypeScript checking passed.
- Production frontend build passed; existing nonfatal environment, sourcemap and large-chunk warnings remain.
- Isolated browser checks inspected homepage, catalogue and detail at 1440px and 390px. No horizontal overflow or uncaught JavaScript exceptions were observed. Airport selector, date picker and mobile filter sheet opened successfully; app heading contrast and mobile illustration spacing were reviewed.
- Local visual inspection used intercepted read-only sample package responses, not production reservations. No customer account, payment, refund or support request was created. Hosted sign-in and a real purchase were not acceptance-tested in this UI change.

Tests reduce regression risk; this is not a guarantee that every possible device, account or live supplier state has been tested.

## Review locally

Run the existing frontend development command and open `/`, `/packages`, a real `/packages/:id` and `/app`. Reference captures and the disposable inspection script are in the ignored `scratch/nusuk-redesign/` folder. No visual fixtures are imported by application code.

## Booking visibility refinement

The landing search now has a clear booking heading, stronger brand outline/accent, tinted input surfaces and larger field labels/values. Desktop hero spacing was reduced so the search action is visible at the tested 1440x900 and 1280x800 viewports. Mobile retains search-first ordering. These typography rules apply only to the landing variant; existing app/results pickers and all search behaviour are preserved. Follow-up verification:21 focused regressions passed, typecheck/build passed, flight/hotel visual checks completed without overflow or uncaught exceptions.

## Full-width hero refinement

The latest user-approved presentation uses a full-bleed slideshow/aircraft background, centred copy and a white booking card overlapping its lower edge. The selected product tab has an indigo filled state. Large field text, existing picker behaviour, image settings, redesigned packages and the app section are retained. This supersedes the split hero/search-first presentation described above. Desktop, laptop and mobile were checked with isolated sample data;21 focused tests and frontend typecheck passed, and the production build completed with existing warnings. No push or deployment.
