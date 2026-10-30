# FlyRaudah mobile integration starter

Copy `flyraudah-client.ts` and `flyraudah-api.d.ts` together into your React Native/Expo TypeScript app. The declarations are generated from the same OTA OpenAPI contract shown in admin; do not edit them manually.

Install `openapi-fetch` in the mobile project. Configure Clerk with the same instance as the web app and obtain `getToken` inside your authenticated component/hook. Follow the official Clerk Expo setup and secure token-cache guidance linked in the Developer Centre. Never put a Duffel, Paystack, Clerk secret or server search key in the application.

```tsx
import { useAuth } from '@clerk/expo';
import { createFlyRaudahClient, retryAfterSeconds } from './flyraudah-client';

// Inside a component/custom hook. Memoize this client for the current auth context.
const { getToken } = useAuth();
const api = createFlyRaudahClient({
  baseUrl: 'https://flyraudah.com.ng/api/ota/v1',
  getToken,
});

const result = await api.POST('/me/bootstrap', { body: {} });
if (result.error) {
  if (result.response.status === 429) {
    const wait = retryAfterSeconds(result.response);
    // Show a countdown; do not retry a checkout/payment mutation automatically.
  }
  throw new Error(result.error.error);
}

const trips = await api.GET('/bookings', { params: { query: { offset: 0 } } });
if (trips.error) throw new Error(trips.error.error);
// Merge pages by booking.id; advance with trips.data.nextOffset until null.
```

The client obtains a fresh SDK session token per request, accepts caller cancellation signals, enforces HTTPS and a fixed OTA destination, rejects redirects, and times out normal calls at 65 seconds and completion at 180 seconds. It does not retry requests or declare payment success. Verify fetch/Request/AbortController/redirect behavior on the actual iOS and Android runtime; choose a platform fetch implementation supporting these features. A timeout or app termination does not cancel an already received server-side payment/reservation operation.

HTTP failures normally return `{error, fields?}` JSON through the typed `error` result; network, abort, invalid response JSON and gateway failures may throw. Catch both forms. Handle by HTTP status rather than parsing human-readable error messages. On 401, obtain a new Clerk session or sign in; do not loop retries. On 409 refresh and ask the customer to accept the new price. For failed or uncertain checkout/payment operations, recover the saved booking before another action. `Idempotency-Key` is not supported for checkout creation.

For paths such as `/bookings/{id}`, supply the raw identifier in `params.path`; openapi-fetch serializes path parameters. Do not pre-encode identifiers twice. The existing `/updates/{id}/read` endpoint requires encoded opaque notification IDs on the wire. Use integer NGN kobo amounts; preserve supplier decimal strings and date-only travel dates. Do not convert local airport times to UTC without their timezone.

The client is an integration starter, not a completed app. Configure native routing, secure account storage, application lifecycle handling, hosted browser payment return and release tests. The server's callback currently returns to the web booking page; arbitrary app deep-link callbacks are not supported. On resume, re-fetch the retained booking ID and trust the server state. Native push, multi-city, infants, ancillary sales and self-service exchanges/cancellations remain outside the current contract.

Import `flyraudah-ota.postman_collection.json` and `flyraudah-ota.postman_environment.json` for manual API exploration. Use an explicit staging base URL and local-only customer token. Public discovery works without secrets. Customer requests require a current session; customer POSTs are skipped until `allow_customer_writes=true`, and booking POSTs additionally require `allow_booking_writes=true`. Enabling these flags can create real customer state and charges/reservations when used against live services. Never run a collection against production casually or export tokens/passport data. The collection does not run any request just by importing it.

Read the complete `OTA_MOBILE_API.md` guide and the admin Developer Centre before implementing payment, hotel or trip-management screens. Required migrations/provider access/matching payment modes/funded balance and end-to-end staging purchase acceptance are deployment gates. Regenerate artifacts with `pnpm run docs:ota` in this repository.

## Hotel checkout example

After refreshing a prepaid quote, replace all sample values with the current API response and collect every required guest. In Postman, `hotel_total_kobo` is captured separately so hotel searches do not overwrite the flight sample's `expected_total_kobo`.

```json
{
  "kind": "hotel",
  "offerId": "quo_example123",
  "acceptedTerms": true,
  "expectedTotalKobo": 13447900,
  "contact": { "email": "traveller@example.com", "phone": "+2348012345678" },
  "travellers": [{ "given_name": "Example", "family_name": "Traveller" }]
}
```

Use the refreshed quote's actual `pricing.totalKobo`, never the illustrative amount. The Developer Centre's POST /bookings example selector provides both flight and hotel payloads. The generic Postman POST /bookings request starts with the flight payload; clone/edit it for hotels rather than running it unchanged after a hotel search.
