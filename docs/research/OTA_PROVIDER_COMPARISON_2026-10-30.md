# FlyRaudah: international, domestic and hotel API providers

Compiled 30 October 2026 from the earlier official-source comparisons in this chat. This is a consolidation, not a fresh commercial quote or live inventory test.

## Scope

38 distinct providers/platforms, including Duffel as the baseline, plus a focused comparison of nine Nigerian domestic integration paths. Domestic candidates that overlap the main catalogue are not counted twice. Some entries are affiliate services, connectivity layers or ticketing routes rather than interchangeable native-booking APIs.

Every catalogue entry includes a website/partner portal, product scope, access/pricing evidence, advantage, limitation and supporting documentation.

## Recommendations for FlyRaudah

1. Retain Duffel as the existing international-flight baseline and evaluate Duffel Stays before adding a separate hotel dependency.
2. For Nigerian domestic flights, assess Tiqwa technically and Wakanow's current airline coverage commercially, then evaluate GO7 Network for specialist coverage.
3. For hotel alternatives, compare Nuitée/LiteAPI, TBO Holidays and RateHawk if existing access, rates or margins are inadequate.
4. Add suppliers after real coverage, total cost, ticket issuance, servicing and settlement checks justify the operational work.
5. Mobile clients should call FlyRaudah's API; supplier credentials and booking orchestration belong in the backend.

These are evaluation priorities, not proof of lowest fares or guaranteed supplier approval.

## Meaning of the pricing labels

- **Free sandbox:** testing only; no implied production entitlement.
- **Free API/core workflow:** bookings, funding and extra endpoints can still cost money.
- **Free monthly quota:** overage charges can apply.
- **Pay as you go:** transaction/usage charges; search, FX and servicing may also be charged.
- **Quote required:** public zero-licence production terms were not verified.
- **Affiliate/redirect:** generally sends customers elsewhere to complete payment; not equivalent to native Paystack checkout and ticket issuance.

## Nigerian domestic flights: nine integration paths

### 1. Tiqwa

- **Priority:** First technical evaluation.
- **Evidence / advantage:** Official developer page publishes a REST booking API, sandbox examples and documentation; homepage advertises African local-airline inventory.
- **Limitation:** No primary-source current per-airline Nigerian inventory matrix or complete API-only pricing verified. Get credentials and commercial terms; do not infer API fees from Anchor platform plans.
- **Official sources:** [Source 1](https://www.tiqwa.com/developers), [Source 2](https://www.tiqwa.com/).

### 2. Wakanow

- **Priority:** First domestic coverage evaluation.
- **Evidence / advantage:** Alternative Airlines' 2023 partnership announcement explicitly describes Wakanow API content for Air Peace, Aero Contractors, United Nigeria and ValueJet, among others.
- **Limitation:** Historical evidence, not proof of current sellable routes. Get current airline list, API documentation, fees, funding and servicing terms. No immediate self-service production activation verified.
- **Official sources:** [Source 1](https://www.alternativeairlines.com/media-centre/alternative-airlines-partners-with-wakanow), [Source 2](https://affiliates.wakanow.com/).

### 3. GO7 / AeroCRS Network

- **Priority:** Strong specialist candidate.
- **Evidence / advantage:** Network API documents search, booking, payment and ticketing through one agreement. Pricing page lists 400,000 free requests/month, $0.001/request above that, and $0.70/booked passenger segment. GO7 documents a Green Africa PSS relationship.
- **Limitation:** PSS hosting does not establish distribution entitlement. Ask which Nigerian carriers your Network account can actually book. WorldTicket GDS products are distinct from AeroCRS Network.
- **Official sources:** [Source 1](https://docs.aerocrs.com/docs/aerocrs-network), [Source 2](https://docs.aerocrs.com/docs/pricing), [Source 3](https://go7.io/products/aerocrs/).

### 4. Travelstart

- **Priority:** Regional comparison.
- **Evidence / advantage:** Official API documents flight query, booking and payment, with production credentials after certification.
- **Limitation:** Confirm current Nigerian domestic carrier access; website retail availability is not proof of API entitlement. Documentation includes legacy SOAP workflows.
- **Official sources:** [Source 1](https://docs.travelstart.com/), [Source 2](https://docs.travelstart.com/api/).

### 5. Amadeus + authorised consolidator

- **Priority:** Ticketing setup required.
- **Evidence / advantage:** Ibom Air's published GDS policy names Amadeus and requires airline ticketing authority. Amadeus Self-Service requires a consolidator for ticket issuance.
- **Limitation:** Enterprise/GDS participation does not guarantee that the same airline offers appear in Self-Service or your account. Validate search, pricing and ticketing; more onboarding than a ready managed API.
- **Official sources:** [Source 1](https://www.ibomair.com/gds_policy/), [Source 2](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/).

### 6. Travu Africa

- **Priority:** Investigate before committing.
- **Evidence / advantage:** Nigerian provider publishes flight selection and tentative-booking endpoints plus test/live URLs; introduction advertises free API access.
- **Limitation:** Documentation labels the API beta and has old sections. Confirm current airline inventory, final ticket issuance and flight-specific fees; bus commission examples do not establish flight pricing.
- **Official sources:** [Source 1](https://docs.travu.africa/), [Source 2](https://docs.travu.africa/master-2/booking).

### 7. flyt.africa

- **Priority:** Exploratory lead.
- **Evidence / advantage:** Official API page describes JSON/HTTPS live fare search, price confirmation and booking, with credentials issued directly.
- **Limitation:** No current Nigerian carrier list, public full fee schedule or instant approval verified. Treat as a candidate, not confirmed domestic coverage.
- **Official sources:** [Source 1](https://www.flyt.africa/api).

### 8. GSUBZ

- **Priority:** Exploratory lead.
- **Evidence / advantage:** Published documentation describes NGN flight search, wallet-paid booking, order lookup and flight.order.updated notifications.
- **Limitation:** An Ibom Air example is illustrative, not proof of live inventory or ticketing authority. Independently verify supplier arrangements, refunds, support and commercials before funding.
- **Official sources:** [Source 1](https://www.gsubz.com/api_doc/).

### 9. Hahnair through a GDS/consolidator

- **Priority:** Distribution route, not direct substitute.
- **Evidence / advantage:** Official partner directory lists Nigerian carriers including Air Peace, United Nigeria and ValueJet.
- **Limitation:** Directory listing does not ensure availability for your market, account or route. Requires an appropriate GDS/consolidator integration and ticketing arrangement.
- **Official sources:** [Source 1](https://www.hahnair.com/en/partner-carriers).

## Consolidated catalogue: 38 distinct providers and platforms

“International” does not mean universal airline coverage or Nigerian domestic entitlement. Product availability depends on market, account and contract. Providers offering multiple products appear once below.

### 1. Duffel

- **Website / partner portal:** [Visit provider](https://duffel.com/).
- **Products:** Flights + hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Pay as you go.
- **Pricing and access evidence:** Flights $3/order + 1% Managed Content; $2/paid ancillary; excess searches $0.005 beyond 1,500:1; FX 2% when conversion applies. Stays profit share.
- **Advantage:** Clear public pricing and managed ticketing reduce startup complexity.
- **Disadvantage / restriction:** Search, ancillary, FX and content charges add up; Stays access/commercial terms need confirmation.
- **Fit for FlyRaudah:** Baseline.
- **Documentation / supporting sources:** [Official source 1](https://duffel.com/pricing).

### 2. Trip.com

- **Website / partner portal:** [Visit provider](https://www.trip.com/partners/index).
- **Products:** Hotels + affiliate travel.
- **Integration model:** Partner / redirect.
- **Access / pricing:** Free affiliate; API quote.
- **Pricing and access evidence:** Affiliate registration is free; Trip handles booking/payment. Hotel partner API exists, but free full native-booking access is not publicly established.
- **Advantage:** Recognised brand; easy affiliate monetisation.
- **Disadvantage / restriction:** Affiliate tools do not replace your Paystack checkout. Partner API credentials and entitlement require approval; supplier Connect API is a different product.
- **Fit for FlyRaudah:** Consider for affiliate revenue.
- **Documentation / supporting sources:** [Official source 1](https://www.trip.com/partners/help/faq/account), [Official source 2](https://apidoc.trip.com/apidoc).

### 3. Wakanow

- **Website / partner portal:** [Visit provider](https://affiliates.wakanow.com/).
- **Products:** Flights + hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Official affiliates site offers modular flight/hotel APIs. No public API price, free quota, deposit or production minimum was verified.
- **Advantage:** Useful regional supplier to assess for a Nigerian OTA; own custom solutions supported.
- **Disadvantage / restriction:** Obtain written fees, NGN settlement, carrier coverage and servicing terms. Free affiliate membership would not prove free API access.
- **Fit for FlyRaudah:** Nigeria shortlist.
- **Documentation / supporting sources:** [Official source 1](https://affiliates.wakanow.com/).

### 4. Nuitée / LiteAPI

- **Website / partner portal:** [Visit provider](https://liteapi.travel/).
- **Products:** Hotels + approved flights.
- **Integration model:** Native booking.
- **Access / pricing:** Free core; paid extras.
- **Pricing and access evidence:** Hotel core Rates–Prebook–Book endpoints free within fair use. Places $0.01/request; price index $0.05. Flight fee 1% TTV, €2–€10/booking; voluntary modification €25; excess searches €0.005 beyond 1,500:1.
- **Advantage:** Strong publicly documented hotel cost model; flight API provides another commercial benchmark.
- **Disadvantage / restriction:** Flights require separate approval; optional tools cost extra. Confirm supplier settlement/payment model and Nigerian entity eligibility.
- **Fit for FlyRaudah:** Priority shortlist.
- **Documentation / supporting sources:** [Official source 1](https://docs.liteapi.travel/reference/api-pricing-usage-costs), [Official source 2](https://docs.liteapi.travel/docs/getting-access-to-flights).

### 5. Amadeus Self-Service

- **Website / partner portal:** [Visit provider](https://developers.amadeus.com/).
- **Products:** Flights + hotels / travel APIs.
- **Integration model:** Native, product dependent.
- **Access / pricing:** Monthly free quota.
- **Pricing and access evidence:** Free monthly request quotas; production overages priced per API. Flight order production has special ticketing/consolidator requirements.
- **Advantage:** Accessible test environment; useful search APIs and a genuine free usage allowance.
- **Disadvantage / restriction:** Not an unlimited free production service. Flight ticket issuance needs a suitable consolidator arrangement; test data and production differ.
- **Fit for FlyRaudah:** Developer shortlist.
- **Documentation / supporting sources:** [Official source 1](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/pricing/), [Official source 2](https://admin.developers.amadeus.com/self-service/apis-docs/guides/developer-guides/faq/).

### 6. RateHawk / Emerging Travel Group

- **Website / partner portal:** [Visit provider](https://www.ratehawk.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Free access advertised.
- **Pricing and access evidence:** Official material advertises free hotel API access; obtain current commercial confirmation, funding and certification terms.
- **Advantage:** Hotel sourcing through your own booking interface.
- **Disadvantage / restriction:** Free access is not free accommodation; contract, payment and integration requirements apply. Do not assume portal flight products share these API terms.
- **Fit for FlyRaudah:** Hotel shortlist.
- **Documentation / supporting sources:** [Official source 1](https://www.ratehawk.com/lp/en-de/API/), [Official source 2](https://blog.ratehawk.com/connect-to-the-new-api-version-with-the-help-of-sdk/).

### 7. TBO Holidays

- **Website / partner portal:** [Visit provider](https://www.tboholidays.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** No API access fee advertised.
- **Pricing and access evidence:** Official hotel XML page says access costs nothing and you pay for bookings; confirm current agreement and settlement requirements.
- **Advantage:** Explicit no-access-fee hotel proposition; net-rate model suits a branded OTA.
- **Disadvantage / restriction:** Commercial onboarding and certification remain; XML integration. Hotel terms do not establish free access to TBO flights.
- **Fit for FlyRaudah:** Hotel shortlist.
- **Documentation / supporting sources:** [Official source 1](https://www.tboholidays.com/xml_api.aspx).

### 8. Hotelbeds / HBX

- **Website / partner portal:** [Visit provider](https://developer.hotelbeds.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Free evaluation; live contract.
- **Pricing and access evidence:** Free evaluation API key; production commercials and certification require confirmation.
- **Advantage:** Established hotel distribution API and evaluation access.
- **Disadvantage / restriction:** Evaluation does not demonstrate zero production fees, unrestricted limits or no deposit.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://developer.hotelbeds.com/register/), [Official source 2](https://developer.hotelbeds.com/documentation/getting-started/).

### 9. Expedia Rapid

- **Website / partner portal:** [Visit provider](https://developers.expediagroup.com/).
- **Products:** Lodging + other Rapid products.
- **Integration model:** Native, product dependent.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Partner approval, credentials and launch review required; no universal free production fee schedule verified.
- **Advantage:** Broad travel product platform with documented integration and launch workflow.
- **Disadvantage / restriction:** Commercial approval and production enablement take work; product availability and settlement depend on the agreement.
- **Fit for FlyRaudah:** Scale shortlist.
- **Documentation / supporting sources:** [Official source 1](https://developers.expediagroup.com/docs/products/rapid/setup/getting-started), [Official source 2](https://developers.expediagroup.com/rapid?locale=en_US).

### 10. Booking.com Demand

- **Website / partner portal:** [Visit provider](https://developers.booking.com/).
- **Products:** Stays + other approved products.
- **Integration model:** Native / redirect by scope.
- **Access / pricing:** Managed affiliate agreement.
- **Pricing and access evidence:** Requires managed affiliate contract, account manager and approved credentials.
- **Advantage:** Accommodation discovery and approved booking/post-booking integrations.
- **Disadvantage / restriction:** Not open self-service free access. Confirm exact booking scope and flight entitlement separately; do not presume a Duffel flight replacement.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://developers.booking.com/demand/docs/getting-started/prerequisites), [Official source 2](https://developers.booking.com/demand).

### 11. Agoda Demand

- **Website / partner portal:** [Visit provider](https://developer.agoda.com/).
- **Products:** Hotels.
- **Integration model:** Native / redirect by model.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Approved affiliate/MSE search, assisted fulfilment and full API models have different scopes.
- **Advantage:** Multiple integration depths, including booking and post-booking options.
- **Disadvantage / restriction:** Commercial onboarding and certification; confirm who charges customers and which API scopes are granted.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://developer.agoda.com/demand/docs/getting-started), [Official source 2](https://developer.agoda.com/demand/docs/faq).

### 12. WebBeds

- **Website / partner portal:** [Visit provider](https://www.webbeds.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** API onboarding follows commercial agreement and technical approval.
- **Advantage:** Hotel wholesale supply and native booking integration.
- **Disadvantage / restriction:** Contract plus hotel content/mapping work; free production API and credit terms not publicly established.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://www.webbeds.com/buyers/support/).

### 13. DidaTravel

- **Website / partner portal:** [Visit provider](https://www.didatravel.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Sales/NDA, test access, integration and UAT precede live deployment.
- **Advantage:** Documented wholesale hotel integration workflow.
- **Disadvantage / restriction:** Hotel mapping, certification and private commercial terms add work; taxes and local charges need careful presentation.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://apidoc.didatravel.com/).

### 14. Rakuten Travel Xchange

- **Website / partner portal:** [Visit provider](https://www.rakutentravelxchange.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Contract terms.
- **Pricing and access evidence:** API use governed by commercial contract, including look-to-book expectations.
- **Advantage:** Another hotel distribution source to compare for rates and availability.
- **Disadvantage / restriction:** No verified public free-production offer; usage, margin and settlement terms require review.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://agent.rakutentravelxchange.com/agent-contract).

### 15. Stuba

- **Website / partner portal:** [Visit provider](https://www.stuba.com/).
- **Products:** Hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Approval; quote required.
- **Pricing and access evidence:** Existing Stuba account, API registration and certification required; live URL after certification.
- **Advantage:** JSON and content APIs with a documented test-to-live process.
- **Disadvantage / restriction:** Account approval, IP allowlisting and agency-currency constraints; no public zero-fee production claim verified.
- **Fit for FlyRaudah:** Hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://developer.stuba.com/register/), [Official source 2](https://developer.stuba.com/hapi/getting-started/).

### 16. Hotelston

- **Website / partner portal:** [Visit provider](https://www.hotelston.com/).
- **Products:** Hotels.
- **Integration model:** Commercial API integration.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Official site lists a dedicated API integration team; public pricing and production entitlements not established.
- **Advantage:** Additional hotel supplier worth requesting a commercial comparison from.
- **Disadvantage / restriction:** Less public commercial detail; verify search, booking, cancellation and settlement capabilities before selecting.
- **Fit for FlyRaudah:** Additional hotel lead.
- **Documentation / supporting sources:** [Official source 1](https://www.hotelston.com/about/contacts.jsf).

### 17. AirGateway

- **Website / partner portal:** [Visit provider](https://airgateway.com/).
- **Products:** Flights / NDC.
- **Integration model:** Native booking.
- **Access / pricing:** Paid monthly + booking.
- **Pricing and access evidence:** Published API plan €100/month plus €1 issued booking, with selected airline waivers; confirm relevant plan and conditions.
- **Advantage:** Transparent alternative pricing; airline NDC booking and servicing.
- **Disadvantage / restriction:** Fails a strict no-monthly-fee requirement; coverage and ticketing arrangements must fit your routes.
- **Fit for FlyRaudah:** Volume benchmark.
- **Documentation / supporting sources:** [Official source 1](https://airgateway.com/pricing/?type=agw-api).

### 18. Verteil

- **Website / partner portal:** [Visit provider](https://www.verteil.com/).
- **Products:** Flights / NDC.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Commercial travel-seller API; no public universal free pricing verified.
- **Advantage:** Unified airline NDC shopping, booking and servicing.
- **Disadvantage / restriction:** Agency/accreditation arrangements, airline entitlements and fees must be agreed.
- **Fit for FlyRaudah:** Flight benchmark.
- **Documentation / supporting sources:** [Official source 1](https://www.verteil.com/product), [Official source 2](https://www.verteil.com/travel-seller).

### 19. Mystifly

- **Website / partner portal:** [Visit provider](https://mystifly.com/).
- **Products:** Flights.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Multisource airfare marketplace/platform; public no-licence pricing not verified.
- **Advantage:** Combines multiple content sources and post-sales workflows.
- **Disadvantage / restriction:** Onboarding, ticketing, support and commercial costs need a written quote.
- **Fit for FlyRaudah:** Flight benchmark.
- **Documentation / supporting sources:** [Official source 1](https://mystifly.com/).

### 20. Travelfusion

- **Website / partner portal:** [Visit provider](https://corporate.travelfusion.com/).
- **Products:** Flights / direct connect.
- **Integration model:** Native booking.
- **Access / pricing:** Paid licence agreement.
- **Pricing and access evidence:** Official XML API documentation explicitly says fees apply under a signed licence agreement.
- **Advantage:** Direct-connect flight search and booking while retaining your interface.
- **Disadvantage / restriction:** Not a verified free alternative; licence fees, servicing scope and supplier payments need review.
- **Fit for FlyRaudah:** Coverage benchmark.
- **Documentation / supporting sources:** [Official source 1](https://corporate.travelfusion.com/resources/xml-api).

### 21. TPConnects Iris

- **Website / partner portal:** [Visit provider](https://tpconnects.com/).
- **Products:** Flights.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Commercial API offering combining NDC, low-cost and GDS sources; no public free schedule verified.
- **Advantage:** Multisource flight distribution through a unified integration.
- **Disadvantage / restriction:** Commercial setup and operational requirements; obtain complete ticketing and after-sales fee schedule.
- **Fit for FlyRaudah:** Flight benchmark.
- **Documentation / supporting sources:** [Official source 1](https://tpconnects.com/).

### 22. PKFARE

- **Website / partner portal:** [Visit provider](https://www.pkfare.com/).
- **Products:** Flights + hotels.
- **Integration model:** Native booking.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Buyer solutions cover search, pricing, booking and ticketing; approval and agreement required.
- **Advantage:** Another multisource supply and fulfilment option.
- **Disadvantage / restriction:** Funding rails, refund handling and production fees need verification; do not assume Paystack receipts automatically fund bookings.
- **Fit for FlyRaudah:** Flight / hotel benchmark.
- **Documentation / supporting sources:** [Official source 1](https://www.pkfare.com/flight), [Official source 2](https://app.pkfare.com/en-us/solution/buyer).

### 23. Travelstart

- **Website / partner portal:** [Visit provider](https://www.travelstart.com/).
- **Products:** Flights.
- **Integration model:** Native / affiliate separately.
- **Access / pricing:** Quote required.
- **Pricing and access evidence:** Official API documents query, book and pay workflow; market-specific test access and certification. Affiliate tools are separate.
- **Advantage:** Relevant regional flight partner to benchmark for an Africa-focused OTA.
- **Disadvantage / restriction:** Confirm current onboarding, markets, API version, live fees and local support; documentation includes legacy SOAP workflows.
- **Fit for FlyRaudah:** Africa shortlist.
- **Documentation / supporting sources:** [Official source 1](https://docs.travelstart.com/), [Official source 2](https://docs.travelstart.com/api/).

### 24. Travelport

- **Website / partner portal:** [Visit provider](https://www.travelport.com/).
- **Products:** Flights / GDS travel.
- **Integration model:** Native booking.
- **Access / pricing:** Trial; production contract.
- **Pricing and access evidence:** Trip Services trial available; production requires commercial arrangements. Legacy Universal API is not the default new-customer path.
- **Advantage:** Established travel distribution and agency workflows.
- **Disadvantage / restriction:** Trial is not free production; higher contract and implementation complexity for a small OTA.
- **Fit for FlyRaudah:** Enterprise, later.
- **Documentation / supporting sources:** [Official source 1](https://my.travelport.com/v2/get-trial), [Official source 2](https://support.travelport.com/webhelp/uapi/Content/New_Customer_Path/NewCustomer_Trial.htm).

### 25. Sabre

- **Website / partner portal:** [Visit provider](https://developer.sabre.com/).
- **Products:** Flights / GDS travel.
- **Integration model:** Native booking.
- **Access / pricing:** Test access; live contract.
- **Pricing and access evidence:** Developer access covers selected test APIs; live use needs contracted credentials and entitlements.
- **Advantage:** Extensive agency distribution and booking tooling.
- **Disadvantage / restriction:** No general free production entitlement; commercial and agency setup adds complexity.
- **Fit for FlyRaudah:** Enterprise, later.
- **Documentation / supporting sources:** [Official source 1](https://developer.sabre.com/guide/get-token/get-token), [Official source 2](https://developer.sabre.com/product-collection/sabre-sandbox).

### 26. Skyscanner

- **Website / partner portal:** [Visit provider](https://www.partners.skyscanner.net/).
- **Products:** Flight / hotel / car search.
- **Integration model:** Search / redirect.
- **Access / pricing:** Approval; affiliate model.
- **Pricing and access evidence:** Commercial Travel API selection; contact page states minimum 100K monthly active users. Widget terms are a different access offer.
- **Advantage:** Comparison/search experience and referral monetisation.
- **Disadvantage / restriction:** High access threshold; not your ticket issuer or native payment/booking system.
- **Fit for FlyRaudah:** Affiliate, not core checkout.
- **Documentation / supporting sources:** [Official source 1](https://www.partners.skyscanner.net/contact/travel-api), [Official source 2](https://developers.skyscanner.net/docs/intro).

### 27. Aviasales / Travelpayouts

- **Website / partner portal:** [Visit provider](https://www.travelpayouts.com/).
- **Products:** Flight discovery / search.
- **Integration model:** Search / redirect.
- **Access / pricing:** Free data; gated live search.
- **Pricing and access evidence:** Cached Data API accessible with account/token. Live Search API requires verified 50,000 monthly active users.
- **Advantage:** Low-cost fare discovery and affiliate revenue.
- **Disadvantage / restriction:** Cached prices may be 2–7 days old; not authoritative checkout fares. Live access is gated and bookings hand off.
- **Fit for FlyRaudah:** Affiliate, not core checkout.
- **Documentation / supporting sources:** [Official source 1](https://support.travelpayouts.com/hc/en-us/articles/203956083-Requirements-for-Aviasales-data-API-access), [Official source 2](https://support.travelpayouts.com/hc/en-us/articles/210995808-How-to-get-access-to-the-Aviasales-Search-API).

### 28. Kiwi.com Tequila

- **Website / partner portal:** [Visit provider](https://www.kiwi.com/).
- **Products:** Flights.
- **Integration model:** Approved partner scope.
- **Access / pricing:** Invitation-only partnerships.
- **Pricing and access evidence:** Official announcement changed new B2B partnerships to invitation-only.
- **Advantage:** Potential flight distribution option if invited and commercially approved.
- **Disadvantage / restriction:** Old open/free Tequila tutorials are not evidence of current signup availability.
- **Fit for FlyRaudah:** Do not assume open access.
- **Documentation / supporting sources:** [Official source 1](https://media.kiwi.com/articles-and-interviews/better-for-business-kiwi-com-takes-a-new-approach-to-partnerships/).

### 29. KAYAK Affiliate APIs

- **Website / partner portal:** [Visit provider](https://affiliates.kayak.com/).
- **Products:** Flight / hotel / car search.
- **Integration model:** Search / affiliate.
- **Access / pricing:** Sandbox offered; approval.
- **Pricing and access evidence:** API partner application offers sandbox access; production depends on approved use case.
- **Advantage:** Travel search integration without sourcing all inventory yourself.
- **Disadvantage / restriction:** Sandbox does not prove free production; affiliate/search tools do not provide your own ticket issuance.
- **Fit for FlyRaudah:** Affiliate, not core checkout.
- **Documentation / supporting sources:** [Official source 1](https://affiliates.kayak.com/apis).

### 30. Wego

- **Website / partner portal:** [Visit provider](https://company.wego.com/).
- **Products:** Flight / hotel comparison.
- **Integration model:** Search / redirect.
- **Access / pricing:** Current terms require quote.
- **Pricing and access evidence:** Affiliate integration offers API/link options; current zero-fee production API terms not verified.
- **Advantage:** Travel comparison and completed-referral monetisation.
- **Disadvantage / restriction:** Customer generally continues to a booking partner; obtain current access and pricing terms rather than relying on old API posts.
- **Fit for FlyRaudah:** Affiliate, not core checkout.
- **Documentation / supporting sources:** [Official source 1](https://company.wego.com/affiliate-program), [Official source 2](https://agents.wego.com/overview/).

### 31. Stay22

- **Website / partner portal:** [Visit provider](https://www.stay22.com/).
- **Products:** Accommodation affiliate tools.
- **Integration model:** Affiliate / redirect.
- **Access / pricing:** Free redirect tools; API paused.
- **Pricing and access evidence:** Free Allez redirect endpoint. Direct API documentation says new API signups paused as of 16 October 2026.
- **Advantage:** Easy accommodation referral monetisation for travel content.
- **Disadvantage / restriction:** New direct API access currently restricted; referral tools do not replace a native hotel checkout.
- **Fit for FlyRaudah:** Not a new direct API option.
- **Documentation / supporting sources:** [Official source 1](https://dev.stay22.com/docs/allez), [Official source 2](https://dev.stay22.com/docs/api).

### 32. Travelgate Hotel-X

- **Website / partner portal:** [Visit provider](https://travelgate.com/).
- **Products:** Hotel connectivity.
- **Integration model:** Connectivity layer.
- **Access / pricing:** Buyer commercial terms.
- **Pricing and access evidence:** Hotel buyer API connects supply partners; seller pricing and commissions governed by agreements.
- **Advantage:** Useful for aggregating multiple hotel suppliers through one connectivity layer.
- **Disadvantage / restriction:** Not free hotel inventory or a complete supplier/merchant service. Supplier free-integration claims do not establish buyer pricing.
- **Fit for FlyRaudah:** Infrastructure, later.
- **Documentation / supporting sources:** [Official source 1](https://travelgate.com/apis), [Official source 2](https://docs.travelgate.com/kb/faqs/faqs-price/price-commission-binding/).

### 33. Tiqwa

- **Website / partner portal:** [Visit provider](https://www.tiqwa.com/).
- **Products:** Flights / Nigerian domestic candidate.
- **Integration model:** Native booking candidate.
- **Access / pricing:** Commercial terms require confirmation.
- **Pricing and access evidence:** Official developer page publishes a REST booking API, sandbox examples and documentation; homepage advertises African local-airline inventory.
- **Advantage:** First technical evaluation
- **Disadvantage / restriction:** No primary-source current per-airline Nigerian inventory matrix or complete API-only pricing verified. Get credentials and commercial terms; do not infer API fees from Anchor platform plans.
- **Fit for FlyRaudah:** Domestic shortlist.
- **Documentation / supporting sources:** [Official source 1](https://www.tiqwa.com/developers), [Official source 2](https://www.tiqwa.com/).

### 34. GO7 / AeroCRS Network

- **Website / partner portal:** [Visit provider](https://go7.io/).
- **Products:** Flights / Nigerian domestic candidate.
- **Integration model:** Native booking candidate.
- **Access / pricing:** Free request allowance + segment fee.
- **Pricing and access evidence:** Network API documents search, booking, payment and ticketing through one agreement. Pricing page lists 400,000 free requests/month, $0.001/request above that, and $0.70/booked passenger segment. GO7 documents a Green Africa PSS relationship.
- **Advantage:** Strong specialist candidate
- **Disadvantage / restriction:** PSS hosting does not establish distribution entitlement. Ask which Nigerian carriers your Network account can actually book. WorldTicket GDS products are distinct from AeroCRS Network.
- **Fit for FlyRaudah:** Domestic shortlist.
- **Documentation / supporting sources:** [Official source 1](https://docs.aerocrs.com/docs/aerocrs-network), [Official source 2](https://docs.aerocrs.com/docs/pricing), [Official source 3](https://go7.io/products/aerocrs/).

### 35. Travu Africa

- **Website / partner portal:** [Visit provider](https://travu.africa/).
- **Products:** Flights / Nigerian domestic candidate.
- **Integration model:** Native booking candidate.
- **Access / pricing:** Free API advertised; confirm flight terms.
- **Pricing and access evidence:** Nigerian provider publishes flight selection and tentative-booking endpoints plus test/live URLs; introduction advertises free API access.
- **Advantage:** Investigate before committing
- **Disadvantage / restriction:** Documentation labels the API beta and has old sections. Confirm current airline inventory, final ticket issuance and flight-specific fees; bus commission examples do not establish flight pricing.
- **Fit for FlyRaudah:** Investigate before committing.
- **Documentation / supporting sources:** [Official source 1](https://docs.travu.africa/), [Official source 2](https://docs.travu.africa/master-2/booking).

### 36. flyt.africa

- **Website / partner portal:** [Visit provider](https://www.flyt.africa/).
- **Products:** Flights / Nigerian domestic candidate.
- **Integration model:** Native booking candidate.
- **Access / pricing:** Commercial terms require confirmation.
- **Pricing and access evidence:** Official API page describes JSON/HTTPS live fare search, price confirmation and booking, with credentials issued directly.
- **Advantage:** Exploratory lead
- **Disadvantage / restriction:** No current Nigerian carrier list, public full fee schedule or instant approval verified. Treat as a candidate, not confirmed domestic coverage.
- **Fit for FlyRaudah:** Exploratory lead.
- **Documentation / supporting sources:** [Official source 1](https://www.flyt.africa/api).

### 37. GSUBZ

- **Website / partner portal:** [Visit provider](https://www.gsubz.com/).
- **Products:** Flights / Nigerian domestic candidate.
- **Integration model:** Native booking candidate.
- **Access / pricing:** Commercial terms require confirmation.
- **Pricing and access evidence:** Published documentation describes NGN flight search, wallet-paid booking, order lookup and flight.order.updated notifications.
- **Advantage:** Exploratory lead
- **Disadvantage / restriction:** An Ibom Air example is illustrative, not proof of live inventory or ticketing authority. Independently verify supplier arrangements, refunds, support and commercials before funding.
- **Fit for FlyRaudah:** Exploratory lead.
- **Documentation / supporting sources:** [Official source 1](https://www.gsubz.com/api_doc/).

### 38. Hahnair through a GDS/consolidator

- **Website / partner portal:** [Visit provider](https://www.hahnair.com/).
- **Products:** Flights / Nigerian domestic candidate.
- **Integration model:** GDS/consolidator distribution route.
- **Access / pricing:** Commercial terms require confirmation.
- **Pricing and access evidence:** Official partner directory lists Nigerian carriers including Air Peace, United Nigeria and ValueJet.
- **Advantage:** Distribution route, not direct substitute
- **Disadvantage / restriction:** Directory listing does not ensure availability for your market, account or route. Requires an appropriate GDS/consolidator integration and ticketing arrangement.
- **Fit for FlyRaudah:** Distribution route, not direct substitute.
- **Documentation / supporting sources:** [Official source 1](https://www.hahnair.com/en/partner-carriers).

## Important distinctions

- Duffel supports hotel search and booking through Stays; a second hotel supplier is optional. [Duffel Stays](https://duffel.com/stays).
- Duffel's public charges include search, ancillary and conditional FX costs as well as flight order/Managed Content fees. [Pricing](https://duffel.com/pricing).
- Duffel's public airline directory does not establish comprehensive Nigerian domestic coverage; missing direct names do not prove all indirect content is unavailable. [Directory](https://duffel.com/flights/airlines).
- Trip.com's free affiliate registration is different from a free, open, full native-booking API, which was not verified. Its hotel partner API and supplier Connect product are separate offerings. [Affiliate FAQ](https://www.trip.com/partners/help/faq/account), [Partner API](https://apidoc.trip.com/apidoc), [Supplier Connect](https://connect.trip.com/).
- Wakanow has documented third-party Nigerian airline API distribution, but the cited 2023 announcement is historical. Get current coverage and commercial terms. [Announcement](https://www.alternativeairlines.com/media-centre/alternative-airlines-partners-with-wakanow).
- Ibom Air's Amadeus GDS participation does not guarantee availability in Amadeus Self-Service or your account. [Airline policy](https://www.ibomair.com/gds_policy/).
- API documentation examples, including named airlines, are not proof of live inventory, ticketing authority or operational reliability.

## Supplier comparison and acceptance checklist

1. Current airline-by-airline search, price and ticketing coverage, especially Nigerian domestic carriers.
2. Setup/licence/monthly, search, booking, passenger/segment, ancillary, FX and servicing fees, quotas and contractual minimums.
3. Nigerian business eligibility, sandbox availability, production approval and certification.
4. Funding/deposit, top-up turnaround, settlement currency, credit terms and refund destination. Paystack customer collection and supplier settlement are separate.
5. Issued ticket/reservation retrieval, repricing, expiration, duplicate requests, concurrent attempts, failed issuance and unknown booking outcomes.
6. Refunds, exchanges, cancellations, schedule-change notifications, support hours and escalation commitments.
7. Mobile distribution rights and permission to use your own customer-facing checkout.
8. Like-for-like final prices: matching passengers, fare families, bags, taxes, rooms, meal plans and cancellation terms.

Suggested domestic benchmark routes: Lagos–Abuja, Lagos–Port Harcourt, Abuja–Kano, Lagos–Enugu and Lagos–Uyo where the tested airline currently operates. International test targets: Lagos/Abuja to Jeddah, Madinah, Riyadh, Dubai and London. These are proposed test cases, not claims that every provider or airline operates each route. Compare Makkah/Madinah hotel supply with exact room and cancellation conditions.

## Research state

Completed: broad provider research, Nigerian domestic investigation, and consolidation of 38 unique entries with nine focused domestic integration paths.

Not completed: supplier outreach, commercial quotes, account approval, credentials, live rate/coverage tests, funded purchases, or new supplier integrations. No universal winner was established.

Recommended next action: obtain Tiqwa and Wakanow API-only onboarding packages and current carrier matrices while validating existing Duffel flight/Stays workflows. Preserve the original supplier on every booking and reconcile uncertain outcomes before retrying.
