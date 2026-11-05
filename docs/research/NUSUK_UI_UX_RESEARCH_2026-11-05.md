# Nusuk Umrah UI/UX research for FlyRaudah

Reviewed 5 November 2026. Research and recommendations only; no application implementation or deployment.

## Recommendation

Use Nusuk as a reference for Raudah's Hajj and Umrah package experience. Build a shared visual system across Flights, Hotels and Packages while letting each product ask the questions relevant to it. Preserve Raudah's indigo/orange identity and existing booking capabilities.

This is a qualitative expert review, not a usability study with customers. Conversion improvements below are hypotheses to validate.

## Scope and evidence

Reviewed public homepage, package catalogue, one package detail, registration and support content. Rendered desktop pages at 1440 × 1050 and mobile homepage/registration at 390 × 950 in an isolated Chrome session. Screenshots are dated observations, not representations of every device or account state.

No registration, eligibility verification, support submission, payment or purchase was completed. Authenticated checkout, actual availability, refunds and booking recovery remain unverified. No performance benchmark or WCAG conformance audit was performed. Early captures contained loading overlays and unresolved icon glyphs; later captures settled. Those early states are not sufficient evidence of persistent website defects.

## Observed design and experience

### Homepage: calm, task-oriented presentation

The desktop composition pairs a large green heading with devotional imagery, generous white space and an overlapping search panel. Gold branding, pale surfaces, restrained borders and rounded images create a calm tone. Sampled CSS names IBM font families; the hero heading is 48px. Mobile places the stacked search form before the introduction. Registration and package browsing have separate entry points. The authority strip is specific to Nusuk's government status. [Homepage](https://umrah.nusuk.sa/)

**Interpretation:** A consistent hierarchy and clear first task do more for perceived professionalism than adding decoration. For Raudah, use verified business credentials and useful support details as trust signals. Only show endorsements or accreditations that Raudah can substantiate.

### Discovery: enough detail to narrow a pilgrimage trip

The catalogue uses image cards and a search/filter entry. Filter content includes residence, nationality, category, availability, nights, budget, provider and separate Makkah/Madinah hotel ratings. These choices connect package discovery to the traveller's circumstances. [Package catalogue](https://umrah.nusuk.sa/available-packages)

**Interpretation:** These are useful package dimensions, but presenting every filter at once can increase effort. Put the few most useful choices first, reveal advanced filters on request, and explain why eligibility information is needed. A filter's presence does not prove the underlying eligibility rules are correct.

### Detail: keep the decision and action connected

The reviewed detail page shows provider identity, per-person VAT wording, a gallery, accommodation, transport, itinerary, services and policies. A bottom booking bar remains visible in the two captured desktop scroll positions. The overview and insurance material are lengthy; the extracted content also contains spelling errors and an unresolved policy label, “Policy Msg 7”. [Reviewed package](https://umrah.nusuk.sa/available-packages/58140000-9749-56b2-a5ad-08df1fb95e61)

**Interpretation:** Keep price and booking action accessible, but make the information needed to approve that price much easier to scan. Editorial quality is part of transaction confidence.

### Registration and support

Registration asks for residence, nationality and email, with confirmation checkboxes. Legal acceptance and email updates are separate choices; a human-verification control appears in the mobile capture. [Registration](https://umrah.nusuk.sa/registration/signup)

The help page offers searchable guidance, chat, email, a call centre and a ticket form. Contact channels were inspected, not exercised. [Support](https://umrah.nusuk.sa/FAQ)

**Interpretation:** Preserve a traveller's chosen package when authentication becomes necessary. Explain required personal information in plain language. Show working support channels appropriate to the current booking stage.

## Proposed Raudah experience

The following are recommendations, not claims about current implementation completeness.

### 1. Homepage and search

- Keep Flights, Hotels and Packages together in the existing search area; make the selected product unmistakable.
- Make Packages reveal a curated catalogue directly below the search panel, with a clear route to all packages.
- Ask for destination, dates or travel month, and travellers first. Ask residence/nationality when needed for a package's actual rules.
- Use selectable suggestions with readable names and secondary details. Show popular choices before typing and search results after typing.
- Anchor desktop popovers to their fields. On phones, use accessible full-width sheets with an obvious heading, close control and confirmation button. Avoid moving the page unexpectedly.
- Make decorative hero imagery secondary to legible text and the search task. Respect reduced-motion preferences and retain admin image/slideshow controls.

### 2. Package cards and results

Each card should answer the same questions in the same order:

1. What trip is this? Name, relevant destination image and travel period.
2. How long? Total nights and Makkah/Madinah split.
3. What is included? Explicit flight, visa, hotel, meals and transfer status based on actual package data.
4. What hotel arrangement? Rating, room occupancy, and distance or transfer information where verified.
5. What will I pay? Currency, starting-price basis, taxes/fees and any required next step to obtain a final total.

Use a consistent image aspect ratio and card height. Give “View package” one clear visual priority. Add sorting by relevant price, duration and departure date only where the data supports it. Use selected-filter chips, reset, result count and useful empty states. Avoid showing invented savings, ratings, scarcity or availability.

### 3. Package detail and booking

Recommended section order:

1. Summary and gallery.
2. Dates, travellers and room occupancy.
3. Included / excluded / optional services.
4. Hotels and transport.
5. Itinerary.
6. Cancellation deadlines, fees and refund terms.
7. Price breakdown and booking review.

Use short summaries above expandable policy details. A desktop section navigation and mobile bottom action can reduce repeated scrolling. Keep the final total, currency and price basis visible. Revalidate availability and price before payment; require explicit acknowledgement of a changed total.

Distinguish “Book now” from “Request a quote”. A request-only package must clearly explain when staff will respond and must not imply immediate confirmation. After payment, show a truthful pending state until the booking is confirmed, with a booking reference, recovery path and support access.

### 4. Registration and mobile continuity

Allow exploration before account creation where the product permits. Reuse Raudah's existing authentication, preserve the selected trip through sign-in, and return customers to the same step. Collect passport details only when needed and explain their purpose. Keep marketing consent separate from required terms.

Use the same service names, booking statuses, money formatting and error messages across the website and `/app`. Both clients should reflect server-confirmed booking state. Interrupted sessions should reopen the booking rather than invite another payment.

## Proposed visual specification

These are starting design targets for Raudah, not measurements of Nusuk:

- Retain the existing indigo primary and orange action palette; verify contrast for every actual foreground/background pairing.
- Use a consistent spacing scale: 8, 16, 24, 32, 48 and 64px, with smaller increments for compact controls.
- Start with 16px body text, 24–32px section titles and responsive 32–56px hero headings. Use font weight and spacing for hierarchy.
- Standardise form heights around 48–56px and interactive target areas at least 44 × 44px as a usability target.
- Use restrained 12–20px corner radii and subtle borders. Reserve stronger visual emphasis for the next useful action.
- Standardise gallery ratios, icon weights, selected states, errors, disabled states and skeletons. Avoid embedding important price or itinerary text in images.
- Keep currency and occupancy wording adjacent to prices. Use unambiguous dates and label time zones where timing affects a booking or cancellation.

## Implementation order and acceptance criteria

### First: the complete package decision path

Implement catalogue/card consistency, package detail hierarchy, inclusion/exclusion data and clear book-versus-enquiry behaviour. Success means a customer can explain what they are buying, when they travel, what is excluded, what it costs and what cancellation would mean before continuing.

### Second: input and mobile behaviour

Standardise selectors, calendars, traveller/room controls and result loading across all three products. Verify keyboard operation, focus return, screen-reader names, date announcements, zoom, long labels, RTL readiness, reduced motion and mobile safe-area spacing. Fixed navigation/actions must never cover content or the onscreen keyboard.

Search should preserve inputs during loading, failure and retry. Reserve space for results, announce completion, and provide recovery for a slow or failed request. Avoid invented percentage progress.

### Third: validation and measurement

Test a family trip, an older traveller, a customer unsure about visa inclusion, a low-bandwidth phone and a returning customer recovering an interrupted booking. Measure search completion, package-detail-to-checkout progression, validation failures, authentication return success and payment-to-confirmation time. Establish baselines before setting numerical improvement targets.

## Reference captures

Desktop: [Homepage](nusuk/home-desktop.png), [Catalogue](nusuk/packages-desktop.png), [Package detail](nusuk/detail-desktop.png), [Detail after scrolling](nusuk/detail-desktop-below.png).

Mobile: [Homepage](nusuk/home-mobile.png), [Registration](nusuk/signup-mobile.png).

Primary sources are linked beside the observations they support. Recommendations are the reviewer's design judgement; they are not evidence of Nusuk's conversion performance or backend capabilities.
