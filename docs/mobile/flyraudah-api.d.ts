export interface paths {
    "/config": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read channel availability
         * @description Public feature switches, mode and support contacts. Hide disabled checkout and Stays actions.
         */
        get: operations["get_config"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/capabilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Discover mobile features & limits
         * @description Implemented features, active switches, limits and suggested foreground polling intervals. No supplier credentials are exposed.
         */
        get: operations["get_capabilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/exchange-rates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read selling & reference FX
         * @description sellingRates are operator-controlled NGN-per-unit selling rates. The separate reference object is a dated comparison feed and may be stale/unavailable; it never changes checkout prices.
         */
        get: operations["get_exchange_rates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read active travel profile
         * @description Customer session required; 403 if profile is absent/inactive. Use bootstrap for a new account.
         */
        get: operations["get_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create/reuse the signed-in profile
         * @description Idempotently links the verified Clerk session to a user profile. A new account requires a verified primary Clerk email. Identity/role fields from the request body are ignored; blocked accounts remain blocked.
         */
        post: operations["post_me_bootstrap"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/places": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Find cities & airports
         * @description Select an IATA code from returned places. A city result may represent all its airports. No customer login required.
         */
        get: operations["get_places"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/flights/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search one-way / return flights
         * @description Adults plus children cannot exceed 9. Returns up to 80 currently available offers, priced and sorted by totalKobo. Empty offers is a valid no-inventory response.
         */
        post: operations["post_flights_search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/flights/offers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Refresh an offer before checkout
         * @description Use a current off_ ID. Revalidates availability/expiry and returns server selling price. Keep passenger IDs and conditions from this refreshed offer.
         */
        get: operations["get_flights_offers__id_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/hotels/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Search prepaid Stays
         * @description Requires enabled Duffel Stays product. Uses a 10km radius and only supported instant/prepaid inventory; supplier access errors do not imply no hotels exist.
         */
        post: operations["post_hotels_search"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/hotels/rates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Retrieve all supported room rates
         * @description Use an srr_ search result ID. Returns accommodation.rooms[].rates[] after supported-prepaid filtering; an empty rate list is valid.
         */
        post: operations["post_hotels_rates__id_"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/hotels/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create final room quote
         * @description Signed-in customer only; search integration keys cannot access this endpoint. Quote creation does not reserve a room.
         */
        post: operations["post_hotels_quotes"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/hotels/quotes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Refresh the final hotel quote
         * @description Signed-in customer only. Use the quo_ ID from quote creation. Rechecks supported payment/guest rules and availability.
         */
        get: operations["get_hotels_quotes__id_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List the customer’s saved trips
         * @description Returns 50 newest owner records per page. Summary counts cover all the owner’s records, not only the page; pending excludes expired checkouts.
         */
        get: operations["get_bookings"];
        put?: never;
        /**
         * Save a customer checkout
         * @description Sales/product switches, modes and HTTPS callback must be configured. Fresh offer/quote, exact expectedTotalKobo and every traveller are revalidated. No supplier purchase occurs yet. Request has no Idempotency-Key support; recover history after a lost response.
         */
        post: operations["post_bookings"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings/{id}/pay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open hosted Paystack payment
         * @description Returns a validated Paystack HTTPS authorizationUrl using the booking’s stable reference. Callback is the configured web booking page; client-supplied callback URLs are not supported. A previously prepared redirect can be reused while the checkout is payable.
         */
        post: operations["post_bookings__id__pay"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Verify payment & claim fulfillment
         * @description Does not accept paid/status flags or amounts. Server verifies canonical Paystack proof and claims supplier creation once. May take over two minutes. Returns confirmed/review/processing/etc from the saved checkout. A repeated call cannot force automatic supplier repurchase.
         */
        post: operations["post_bookings__id__complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Recover the saved booking
         * @description The authenticated owner only. Someone else’s ID returns 404. Compare revision before replacing the current mobile snapshot.
         */
        get: operations["get_bookings__id_"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings/{id}/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Read latest supplier status
         * @description Owner only. Performs a read-only supplier refresh for a linked reservation; never creates or repeats a reservation. Do not poll this supplier action aggressively.
         */
        post: operations["post_bookings__id__refresh"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings/{id}/timeline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read customer lifecycle timeline
         * @description Up to 100 newest customer-safe lifecycle entries; raw audit details are private. Unknown/internal audit actions are not exposed.
         */
        get: operations["get_bookings__id__timeline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/bookings/{id}/service-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask support for a change/refund review
         * @description Saves a customer request; it does not itself cancel, exchange or refund anything. A later request replaces the current open message and is audited.
         */
        post: operations["post_bookings__id__service_request"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/updates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Read travel notification inbox
         * @description 20 newest owner OTA notifications, nextOffset and total unreadCount. No other customer’s/admin updates are returned.
         */
        get: operations["get_updates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/updates/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark one travel update read
         * @description URL-encode the whole opaque ota: notification ID. Owner-only; an unknown/unowned/non-OTA ID cannot be marked read.
         */
        post: operations["post_updates__id__read"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/updates/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Mark all customer travel updates read
         * @description Only OTA notifications of the authenticated owner are changed.
         */
        post: operations["post_updates_read_all"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Error: {
            /** @description Human-readable safe error message */
            error: string;
            fields?: string[];
        };
        /**
         * @example {
         *       "supplierKobo": 13447900,
         *       "markupKobo": 0,
         *       "feeKobo": 0,
         *       "totalKobo": 13447900,
         *       "currency": "NGN",
         *       "rate": 1344.79,
         *       "supplierCurrency": "USD",
         *       "supplierAmount": "100.00"
         *     }
         */
        Pricing: {
            /** @description Converted supplier price in kobo */
            supplierKobo?: number;
            /** @description Configured markup in kobo */
            markupKobo?: number;
            /** @description Configured service fee in kobo */
            feeKobo?: number;
            /** @description Total integer NGN price to show and submit as expectedTotalKobo */
            totalKobo: number;
            /**
             * @description Selling currency
             * @enum {string}
             */
            currency: "NGN";
            /** @description Configured NGN per supplier-currency unit */
            rate?: number;
            /** @description Supplier ISO currency */
            supplierCurrency: string;
            /** @description Supplier decimal amount; preserve as a string */
            supplierAmount: string;
        };
        Profile: {
            /** @description Internal profile ID */
            id: string;
            /**
             * Format: email
             * @description Verified account email
             */
            email: string;
            /** @description Account display name */
            fullName: string;
            /** @description Account contact phone */
            phone?: string | null;
            /** @description Existing account role; never accepted from a mobile client */
            role: string;
        };
        ProfileResponse: {
            profile: components["schemas"]["Profile"];
        };
        Contact: {
            /**
             * Format: email
             * @description Booking email
             */
            email: string;
            /** @description E.164 contact number */
            phone: string;
            /** @description Optional hotel accommodation request */
            specialRequests?: string;
        };
        Guest: {
            /** @description Given name */
            given_name: string;
            /** @description Family name */
            family_name: string;
            /**
             * Format: date
             * @description Optional date of birth for hotel guests
             */
            born_on?: string;
        };
        Passport: {
            /**
             * @description Document type
             * @enum {string}
             */
            type: "passport";
            /** @description Passport number */
            unique_identifier: string;
            /**
             * Format: date
             * @description Expiry must be current/future and valid through the final itinerary date
             */
            expires_on: string;
            /** @description Two-letter uppercase country code */
            issuing_country_code: string;
        };
        /**
         * @example {
         *       "id": "pas_example123",
         *       "given_name": "Example",
         *       "family_name": "Traveller",
         *       "born_on": "1990-01-01",
         *       "title": "mr",
         *       "gender": "m",
         *       "email": "traveller@example.com",
         *       "phone_number": "+2348012345678"
         *     }
         */
        FlightTraveller: {
            /** @description Exactly one matching pas_ ID from the selected offer */
            id: string;
            /** @description Given name */
            given_name: string;
            /** @description Family name */
            family_name: string;
            /**
             * Format: date
             * @description Must match the searched passenger type/age at departure
             */
            born_on: string;
            /**
             * @description Passenger title
             * @enum {string}
             */
            title: "mr" | "ms" | "mrs" | "miss" | "dr";
            /**
             * @description Provider gender code
             * @enum {string}
             */
            gender: "m" | "f";
            /**
             * Format: email
             * @description Passenger email
             */
            email: string;
            /** @description E.164 phone */
            phone_number: string;
            /** @description Required when the offer requires passenger identity documents */
            identity_documents?: components["schemas"]["Passport"][];
        };
        Segment: {
            /** @description Supplier segment ID */
            id?: string;
            /** @description Local departure timestamp as supplied; preserve timezone information */
            departing_at?: string;
            /** @description Local arrival timestamp as supplied */
            arriving_at?: string;
            origin?: {
                /** @description Departure IATA */
                iata_code?: string;
                /** @description Airport name */
                name?: string;
            };
            destination?: {
                /** @description Arrival IATA */
                iata_code?: string;
                /** @description Airport name */
                name?: string;
            };
            /** @description Departure terminal */
            origin_terminal?: string | null;
            /** @description Arrival terminal */
            destination_terminal?: string | null;
            marketing_carrier?: {
                /** @description Marketing carrier */
                name?: string;
                /** @description Carrier code */
                iata_code?: string;
            };
            operating_carrier?: {
                /** @description Operating carrier */
                name?: string;
            };
            /** @description Flight number */
            marketing_carrier_flight_number?: string;
            stops?: {
                [key: string]: unknown;
            }[];
            passengers?: ({
                /** @description Passenger ID */
                passenger_id?: string;
                /** @description Cabin */
                cabin_class?: string;
                baggages?: {
                    /** @description Baggage type */
                    type?: string;
                    /** @description Quantity */
                    quantity?: number;
                }[];
            } & {
                [key: string]: unknown;
            })[];
        } & {
            [key: string]: unknown;
        };
        Slice: {
            /** @description Supplier slice ID */
            id?: string;
            origin?: {
                /** @description Origin IATA */
                iata_code?: string;
                /** @description City */
                city_name?: string | null;
            };
            destination?: {
                /** @description Destination IATA */
                iata_code?: string;
                /** @description City */
                city_name?: string | null;
            };
            /** @description ISO 8601 duration, e.g. PT5H30M */
            duration?: string;
            segments?: components["schemas"]["Segment"][];
        } & {
            [key: string]: unknown;
        };
        /**
         * @example {
         *       "id": "off_example123",
         *       "total_amount": "100.00",
         *       "total_currency": "USD",
         *       "expires_at": "2026-10-30T13:05:18.905Z",
         *       "passengers": [
         *         {
         *           "id": "pas_example123",
         *           "type": "adult"
         *         }
         *       ],
         *       "owner": {
         *         "id": "arl_example123",
         *         "name": "Example airline"
         *       },
         *       "slices": [
         *         {
         *           "origin": {
         *             "iata_code": "LOS",
         *             "city_name": "Lagos"
         *           },
         *           "destination": {
         *             "iata_code": "JED",
         *             "city_name": "Jeddah"
         *           },
         *           "duration": "PT5H30M",
         *           "segments": [
         *             {
         *               "departing_at": "2026-12-14T10:00:00",
         *               "arriving_at": "2026-12-14T17:30:00",
         *               "origin": {
         *                 "iata_code": "LOS"
         *               },
         *               "destination": {
         *                 "iata_code": "JED"
         *               },
         *               "passengers": [
         *                 {
         *                   "passenger_id": "pas_example123",
         *                   "cabin_class": "economy",
         *                   "baggages": []
         *                 }
         *               ]
         *             }
         *           ]
         *         }
         *       ],
         *       "pricing": {
         *         "supplierKobo": 13447900,
         *         "markupKobo": 0,
         *         "feeKobo": 0,
         *         "totalKobo": 13447900,
         *         "currency": "NGN",
         *         "rate": 1344.79,
         *         "supplierCurrency": "USD",
         *         "supplierAmount": "100.00"
         *       }
         *     }
         */
        FlightOffer: {
            /** @description off_ ID */
            id: string;
            /** @description Supplier decimal total */
            total_amount?: string;
            /** @description Supplier ISO currency */
            total_currency?: string;
            /**
             * Format: date-time
             * @description Supplier offer expiry
             */
            expires_at?: string;
            owner?: {
                /** @description Airline ID */
                id?: string;
                /** @description Airline name */
                name?: string;
                /** @description Supplier logo URL */
                logo_symbol_url?: string | null;
            };
            passengers?: {
                /** @description pas_ ID */
                id?: string;
                /** @description adult or child */
                type?: string;
                /** @description Child age when provided */
                age?: number;
            }[];
            /** @description Requires passport data in every flight traveller */
            passenger_identity_documents_required?: boolean;
            slices?: components["schemas"]["Slice"][];
            conditions?: {
                [key: string]: unknown;
            };
            pricing?: components["schemas"]["Pricing"];
        } & {
            [key: string]: unknown;
        };
        HotelResult: {
            /** @description srr_ search result ID */
            id: string;
            accommodation?: {
                /** @description Property name */
                name?: string;
                /** @description Supplier star rating, not a customer review score */
                rating?: number;
                photos?: {
                    /** @description Property image URL */
                    url?: string;
                }[];
                location?: {
                    [key: string]: unknown;
                };
            } & {
                [key: string]: unknown;
            };
            pricing: components["schemas"]["Pricing"];
        } & {
            [key: string]: unknown;
        };
        HotelRate: {
            /** @description rat_ rate ID */
            id: string;
            /** @description Rate name */
            name?: string;
            /** @description Board basis when supplied */
            board_type?: string;
            /** @description Only supported prepaid rates are exposed */
            payment_type?: string;
            conditions?: ({
                /** @description Condition title */
                title?: string;
                /** @description Condition details */
                description?: string;
            } & {
                [key: string]: unknown;
            })[];
            cancellation_timeline?: ({
                /** @description Deadline */
                before?: string;
                /** @description Refund currency */
                currency?: string;
                /** @description Supplier refund decimal amount */
                refund_amount?: string;
            } & {
                [key: string]: unknown;
            })[];
            /** @description Separately payable extras; not included in the online total */
            due_at_accommodation_amount?: string;
            /** @description Currency of property extras */
            due_at_accommodation_currency?: string;
            pricing: components["schemas"]["Pricing"];
        } & {
            [key: string]: unknown;
        };
        HotelQuote: {
            /** @description quo_ final quote ID */
            id: string;
            /**
             * Format: date-time
             * @description Expiry when returned; revalidation is mandatory
             */
            expires_at?: string;
            /** @description Supplier decimal total */
            total_amount?: string;
            /** @description Supplier currency */
            total_currency?: string;
            guests?: ({
                /** @description Adult/child */
                type?: string;
                /** @description Child age when supplied */
                age?: number;
            } & {
                [key: string]: unknown;
            })[];
            accommodation?: {
                [key: string]: unknown;
            };
        } & {
            [key: string]: unknown;
        };
        /**
         * @example {
         *       "id": "41af391c-653c-4eb0-a168-cbd81d8e12d1",
         *       "reference": "OTA-example",
         *       "kind": "flight",
         *       "mode": "test",
         *       "status": "payment_pending",
         *       "revision": 0,
         *       "providerOfferId": "off_example123",
         *       "providerBookingId": null,
         *       "amountKobo": 13447900,
         *       "pricing": {
         *         "supplierKobo": 13447900,
         *         "markupKobo": 0,
         *         "feeKobo": 0,
         *         "totalKobo": 13447900,
         *         "currency": "NGN",
         *         "rate": 1344.79,
         *         "supplierCurrency": "USD",
         *         "supplierAmount": "100.00"
         *       },
         *       "offer": {
         *         "id": "off_example123",
         *         "total_amount": "100.00",
         *         "total_currency": "USD",
         *         "expires_at": "2026-10-30T13:05:18.905Z",
         *         "passengers": [
         *           {
         *             "id": "pas_example123",
         *             "type": "adult"
         *           }
         *         ],
         *         "owner": {
         *           "id": "arl_example123",
         *           "name": "Example airline"
         *         },
         *         "slices": [
         *           {
         *             "origin": {
         *               "iata_code": "LOS",
         *               "city_name": "Lagos"
         *             },
         *             "destination": {
         *               "iata_code": "JED",
         *               "city_name": "Jeddah"
         *             },
         *             "duration": "PT5H30M",
         *             "segments": [
         *               {
         *                 "departing_at": "2026-12-14T10:00:00",
         *                 "arriving_at": "2026-12-14T17:30:00",
         *                 "origin": {
         *                   "iata_code": "LOS"
         *                 },
         *                 "destination": {
         *                   "iata_code": "JED"
         *                 },
         *                 "passengers": [
         *                   {
         *                     "passenger_id": "pas_example123",
         *                     "cabin_class": "economy",
         *                     "baggages": []
         *                   }
         *                 ]
         *               }
         *             ]
         *           }
         *         ],
         *         "pricing": {
         *           "supplierKobo": 13447900,
         *           "markupKobo": 0,
         *           "feeKobo": 0,
         *           "totalKobo": 13447900,
         *           "currency": "NGN",
         *           "rate": 1344.79,
         *           "supplierCurrency": "USD",
         *           "supplierAmount": "100.00"
         *         }
         *       },
         *       "travellers": [
         *         {
         *           "id": "pas_example123",
         *           "given_name": "Example",
         *           "family_name": "Traveller",
         *           "born_on": "1990-01-01",
         *           "title": "mr",
         *           "gender": "m",
         *           "email": "traveller@example.com",
         *           "phone_number": "+2348012345678"
         *         }
         *       ],
         *       "contact": {
         *         "email": "traveller@example.com",
         *         "phone": "+2348012345678"
         *       },
         *       "expiresAt": "2026-10-30T13:05:18.905Z",
         *       "paidAt": null,
         *       "providerResult": null,
         *       "providerNotice": null,
         *       "issue": null,
         *       "serviceRequest": null,
         *       "refund": null
         *     }
         */
        Booking: {
            /**
             * Format: uuid
             * @description Saved checkout UUID
             */
            id: string;
            /** @description Stable OTA payment/reference identifier */
            reference: string;
            /**
             * @description Product
             * @enum {string}
             */
            kind: "flight" | "hotel";
            /**
             * @description Original checkout mode
             * @enum {string}
             */
            mode: "test" | "live";
            /**
             * @description Authoritative booking state
             * @enum {string}
             */
            status: "payment_pending" | "processing" | "confirmed" | "requires_review" | "cancelled" | "refunded";
            /** @description Monotonic material revision; ignore lower revisions for the same booking */
            revision: number;
            /** @description Saved total NGN minor units */
            amountKobo: number;
            /** @description Original off_ or quo_ ID */
            providerOfferId?: string;
            /** @description ord_ flight reservation or bok_ hotel booking ID */
            providerBookingId?: string | null;
            pricing?: components["schemas"]["Pricing"];
            offer?: {
                [key: string]: unknown;
            };
            travellers?: {
                [key: string]: unknown;
            }[];
            contact?: components["schemas"]["Contact"];
            providerResult?: ({
                documents?: {
                    [key: string]: unknown;
                }[];
            } & {
                [key: string]: unknown;
            }) | null;
            /** @description Supplier-facing customer notice */
            providerNotice?: string | null;
            /** @description Customer-safe review message */
            issue?: string | null;
            /** @description Current support request */
            serviceRequest?: string | null;
            refund?: {
                [key: string]: unknown;
            } | null;
            /** @description Hosted payment URL when initialised */
            authorizationUrl?: string | null;
            /**
             * Format: date-time
             * @description Saved checkout expiry
             */
            expiresAt?: string;
            /**
             * Format: date-time
             * @description Canonical payment verified at
             */
            paidAt?: string | null;
            /**
             * Format: date-time
             * @description Created at
             */
            createdAt?: string;
            /**
             * Format: date-time
             * @description Updated at
             */
            updatedAt?: string;
        } & {
            [key: string]: unknown;
        };
        /**
         * @example {
         *       "booking": {
         *         "id": "41af391c-653c-4eb0-a168-cbd81d8e12d1",
         *         "reference": "OTA-example",
         *         "kind": "flight",
         *         "mode": "test",
         *         "status": "payment_pending",
         *         "revision": 0,
         *         "providerOfferId": "off_example123",
         *         "providerBookingId": null,
         *         "amountKobo": 13447900,
         *         "pricing": {
         *           "supplierKobo": 13447900,
         *           "markupKobo": 0,
         *           "feeKobo": 0,
         *           "totalKobo": 13447900,
         *           "currency": "NGN",
         *           "rate": 1344.79,
         *           "supplierCurrency": "USD",
         *           "supplierAmount": "100.00"
         *         },
         *         "offer": {
         *           "id": "off_example123",
         *           "total_amount": "100.00",
         *           "total_currency": "USD",
         *           "expires_at": "2026-10-30T13:05:18.905Z",
         *           "passengers": [
         *             {
         *               "id": "pas_example123",
         *               "type": "adult"
         *             }
         *           ],
         *           "owner": {
         *             "id": "arl_example123",
         *             "name": "Example airline"
         *           },
         *           "slices": [
         *             {
         *               "origin": {
         *                 "iata_code": "LOS",
         *                 "city_name": "Lagos"
         *               },
         *               "destination": {
         *                 "iata_code": "JED",
         *                 "city_name": "Jeddah"
         *               },
         *               "duration": "PT5H30M",
         *               "segments": [
         *                 {
         *                   "departing_at": "2026-12-14T10:00:00",
         *                   "arriving_at": "2026-12-14T17:30:00",
         *                   "origin": {
         *                     "iata_code": "LOS"
         *                   },
         *                   "destination": {
         *                     "iata_code": "JED"
         *                   },
         *                   "passengers": [
         *                     {
         *                       "passenger_id": "pas_example123",
         *                       "cabin_class": "economy",
         *                       "baggages": []
         *                     }
         *                   ]
         *                 }
         *               ]
         *             }
         *           ],
         *           "pricing": {
         *             "supplierKobo": 13447900,
         *             "markupKobo": 0,
         *             "feeKobo": 0,
         *             "totalKobo": 13447900,
         *             "currency": "NGN",
         *             "rate": 1344.79,
         *             "supplierCurrency": "USD",
         *             "supplierAmount": "100.00"
         *           }
         *         },
         *         "travellers": [
         *           {
         *             "id": "pas_example123",
         *             "given_name": "Example",
         *             "family_name": "Traveller",
         *             "born_on": "1990-01-01",
         *             "title": "mr",
         *             "gender": "m",
         *             "email": "traveller@example.com",
         *             "phone_number": "+2348012345678"
         *           }
         *         ],
         *         "contact": {
         *           "email": "traveller@example.com",
         *           "phone": "+2348012345678"
         *         },
         *         "expiresAt": "2026-10-30T13:05:18.905Z",
         *         "paidAt": null,
         *         "providerResult": null,
         *         "providerNotice": null,
         *         "issue": null,
         *         "serviceRequest": null,
         *         "refund": null
         *       }
         *     }
         */
        BookingResponse: {
            booking: components["schemas"]["Booking"];
        };
        /**
         * @example {
         *       "kind": "flight",
         *       "offerId": "off_example123",
         *       "acceptedTerms": true,
         *       "expectedTotalKobo": 13447900,
         *       "contact": {
         *         "email": "traveller@example.com",
         *         "phone": "+2348012345678"
         *       },
         *       "travellers": [
         *         {
         *           "id": "pas_example123",
         *           "given_name": "Example",
         *           "family_name": "Traveller",
         *           "born_on": "1990-01-01",
         *           "title": "mr",
         *           "gender": "m",
         *           "email": "traveller@example.com",
         *           "phone_number": "+2348012345678"
         *         }
         *       ]
         *     }
         */
        BookingCreate: {
            /**
             * @description Product
             * @enum {string}
             */
            kind: "flight" | "hotel";
            /** @description Current off_ flight offer ID or quo_ hotel quote ID */
            offerId: string;
            /**
             * @description Explicit acceptance of the currently displayed terms
             * @enum {boolean}
             */
            acceptedTerms: true;
            /** @description Use the current server pricing.totalKobo; must match exactly */
            expectedTotalKobo: number;
            contact: components["schemas"]["Contact"];
            /** @description Flight: every offer passenger exactly once; hotel: one guest per quote guest */
            travellers: (components["schemas"]["FlightTraveller"] | components["schemas"]["Guest"])[];
        } & ({
            /** @enum {string} */
            kind: "flight";
            travellers?: components["schemas"]["FlightTraveller"][];
        } | {
            /** @enum {string} */
            kind: "hotel";
            travellers?: components["schemas"]["Guest"][];
        });
        TimelineEvent: {
            /** @description Event ID */
            id?: string;
            /** @description Customer-facing title */
            title?: string;
            /** @description Customer-safe description */
            message?: string;
            /**
             * Format: date-time
             * @description Event time
             */
            createdAt?: string;
            /** @description Needs traveller attention */
            urgent?: boolean;
            /** @description Customer-visible reply on a resolved support request */
            response?: string;
        } & {
            [key: string]: unknown;
        };
        TravelUpdate: {
            /** @description Opaque OTA notification ID; URL-encode when marking read */
            id: string;
            /** @description Notification title */
            title: string;
            /** @description Customer message */
            message: string;
            /** @description Read status */
            isRead: boolean;
            /** @description Notification type */
            type?: string;
            /** @description Relative web link, not a native app deep link */
            link?: string | null;
            /**
             * Format: date-time
             * @description Creation time
             */
            createdAt: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    get_config: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "flightsEnabled": true,
                     *       "hotelsEnabled": false,
                     *       "salesEnabled": false,
                     *       "mode": "test",
                     *       "supportEmail": "",
                     *       "supportPhone": ""
                     *     }
                     */
                    "application/json": {
                        /** @description Flight search enabled */
                        flightsEnabled: boolean;
                        /** @description Stays search enabled */
                        hotelsEnabled: boolean;
                        /** @description Online checkout enabled */
                        salesEnabled: boolean;
                        /**
                         * @description Mode
                         * @enum {string}
                         */
                        mode: "test" | "live";
                        /** @description Support email */
                        supportEmail: string;
                        /** @description Support phone */
                        supportPhone: string;
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_capabilities: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description 1 */
                        apiVersion: string;
                        /** @description test/live */
                        mode: string;
                        /** @description NGN */
                        currency: string;
                        features: {
                            /** @description Enabled flight search */
                            flightSearch?: boolean;
                            /** @description Enabled hotel search */
                            hotelSearch?: boolean;
                            /** @description Enabled checkout */
                            onlineCheckout?: boolean;
                            /** @description Implemented */
                            bookingHistory?: boolean;
                            /** @description Implemented */
                            bookingUpdates?: boolean;
                            /** @description Implemented */
                            supportRequests?: boolean;
                            /** @description False */
                            selfServiceCancellation?: boolean;
                            /** @description False */
                            selfServiceExchange?: boolean;
                            /** @description False */
                            multiCity?: boolean;
                            /** @description False */
                            infants?: boolean;
                            /** @description False */
                            ancillaries?: boolean;
                        };
                        limits: {
                            [key: string]: number;
                        };
                        polling: {
                            /** @description 5 */
                            processingSeconds?: number;
                            /** @description 30 */
                            settledSeconds?: number;
                        };
                        support: {
                            /** @description Support email */
                            email?: string;
                            /** @description Support phone */
                            phone?: string;
                        };
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_exchange_rates: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        sellingRates: {
                            [key: string]: number;
                        };
                        reference: {
                            /** @description Reference source */
                            provider?: string;
                            /** @description Publication frequency, e.g. daily */
                            frequency?: string;
                            /** @description current/stale/unavailable */
                            status?: string;
                            /** @description Stale reference */
                            stale?: boolean;
                            /**
                             * Format: date-time
                             * @description Fetch time
                             */
                            fetchedAt?: string | null;
                            rates?: {
                                [key: string]: {
                                    ngnPerUnit?: number;
                                    /**
                                     * Format: date
                                     * @description Source date
                                     */
                                    date?: string;
                                };
                            };
                        } & {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileResponse"];
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_me_bootstrap: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProfileResponse"];
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_places: {
        parameters: {
            query: {
                /** @example Lagos */
                q: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        places: ({
                            /** @description Supplier place ID */
                            id?: string;
                            /** @description Display name */
                            name?: string;
                            /** @description IATA code */
                            iata_code?: string | null;
                            /** @description city/airport */
                            type?: string;
                            /** @description City name */
                            city_name?: string | null;
                            airports?: {
                                [key: string]: unknown;
                            }[] | null;
                        } & {
                            [key: string]: unknown;
                        })[];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_flights_search: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "origin": "LOS",
                 *       "destination": "JED",
                 *       "departureDate": "2026-12-14",
                 *       "returnDate": "2026-12-21",
                 *       "adults": 1,
                 *       "childAges": [],
                 *       "cabinClass": "economy"
                 *     }
                 */
                "application/json": {
                    /** @description Uppercase origin IATA */
                    origin: string;
                    /** @description Different uppercase destination IATA */
                    destination: string;
                    /**
                     * Format: date
                     * @description Today or future
                     */
                    departureDate: string;
                    /**
                     * Format: date
                     * @description Optional; same day or after departure
                     */
                    returnDate?: string;
                    /** @description Adult passengers, ages 12+ */
                    adults: number;
                    /** @default [] */
                    childAges?: number[];
                    /**
                     * @description Cabin
                     * @default economy
                     * @enum {string}
                     */
                    cabinClass?: "economy" | "premium_economy" | "business" | "first";
                };
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "offers": [
                     *         {
                     *           "id": "off_example123",
                     *           "total_amount": "100.00",
                     *           "total_currency": "USD",
                     *           "expires_at": "2026-10-30T13:05:18.905Z",
                     *           "passengers": [
                     *             {
                     *               "id": "pas_example123",
                     *               "type": "adult"
                     *             }
                     *           ],
                     *           "owner": {
                     *             "id": "arl_example123",
                     *             "name": "Example airline"
                     *           },
                     *           "slices": [
                     *             {
                     *               "origin": {
                     *                 "iata_code": "LOS",
                     *                 "city_name": "Lagos"
                     *               },
                     *               "destination": {
                     *                 "iata_code": "JED",
                     *                 "city_name": "Jeddah"
                     *               },
                     *               "duration": "PT5H30M",
                     *               "segments": [
                     *                 {
                     *                   "departing_at": "2026-12-14T10:00:00",
                     *                   "arriving_at": "2026-12-14T17:30:00",
                     *                   "origin": {
                     *                     "iata_code": "LOS"
                     *                   },
                     *                   "destination": {
                     *                     "iata_code": "JED"
                     *                   },
                     *                   "passengers": [
                     *                     {
                     *                       "passenger_id": "pas_example123",
                     *                       "cabin_class": "economy",
                     *                       "baggages": []
                     *                     }
                     *                   ]
                     *                 }
                     *               ]
                     *             }
                     *           ],
                     *           "pricing": {
                     *             "supplierKobo": 13447900,
                     *             "markupKobo": 0,
                     *             "feeKobo": 0,
                     *             "totalKobo": 13447900,
                     *             "currency": "NGN",
                     *             "rate": 1344.79,
                     *             "supplierCurrency": "USD",
                     *             "supplierAmount": "100.00"
                     *           }
                     *         }
                     *       ]
                     *     }
                     */
                    "application/json": {
                        offers: components["schemas"]["FlightOffer"][];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_flights_offers__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "offer": {
                     *         "id": "off_example123",
                     *         "total_amount": "100.00",
                     *         "total_currency": "USD",
                     *         "expires_at": "2026-10-30T13:05:18.905Z",
                     *         "passengers": [
                     *           {
                     *             "id": "pas_example123",
                     *             "type": "adult"
                     *           }
                     *         ],
                     *         "owner": {
                     *           "id": "arl_example123",
                     *           "name": "Example airline"
                     *         },
                     *         "slices": [
                     *           {
                     *             "origin": {
                     *               "iata_code": "LOS",
                     *               "city_name": "Lagos"
                     *             },
                     *             "destination": {
                     *               "iata_code": "JED",
                     *               "city_name": "Jeddah"
                     *             },
                     *             "duration": "PT5H30M",
                     *             "segments": [
                     *               {
                     *                 "departing_at": "2026-12-14T10:00:00",
                     *                 "arriving_at": "2026-12-14T17:30:00",
                     *                 "origin": {
                     *                   "iata_code": "LOS"
                     *                 },
                     *                 "destination": {
                     *                   "iata_code": "JED"
                     *                 },
                     *                 "passengers": [
                     *                   {
                     *                     "passenger_id": "pas_example123",
                     *                     "cabin_class": "economy",
                     *                     "baggages": []
                     *                   }
                     *                 ]
                     *               }
                     *             ]
                     *           }
                     *         ]
                     *       },
                     *       "pricing": {
                     *         "supplierKobo": 13447900,
                     *         "markupKobo": 0,
                     *         "feeKobo": 0,
                     *         "totalKobo": 13447900,
                     *         "currency": "NGN",
                     *         "rate": 1344.79,
                     *         "supplierCurrency": "USD",
                     *         "supplierAmount": "100.00"
                     *       }
                     *     }
                     */
                    "application/json": {
                        offer: components["schemas"]["FlightOffer"];
                        pricing: components["schemas"]["Pricing"];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_hotels_search: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "latitude": 21.4225,
                 *       "longitude": 39.8262,
                 *       "checkIn": "2026-12-14",
                 *       "checkOut": "2026-12-21",
                 *       "rooms": 1,
                 *       "adults": 1,
                 *       "childAges": []
                 *     }
                 */
                "application/json": {
                    latitude: number;
                    longitude: number;
                    /**
                     * Format: date
                     * @description Current/future and within 330 days
                     */
                    checkIn: string;
                    /**
                     * Format: date
                     * @description 1–99 nights after check-in
                     */
                    checkOut: string;
                    /** @description At least one adult per room */
                    rooms: number;
                    /** @description Adult guests */
                    adults: number;
                    /** @default [] */
                    childAges?: number[];
                };
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        results: components["schemas"]["HotelResult"][];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_hotels_rates__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        result: {
                            accommodation?: {
                                /** @description Property name */
                                name?: string;
                                /** @description Property description */
                                description?: string;
                                rooms?: ({
                                    /** @description Room name */
                                    name?: string;
                                    rates?: components["schemas"]["HotelRate"][];
                                } & {
                                    [key: string]: unknown;
                                })[];
                            } & {
                                [key: string]: unknown;
                            };
                        } & {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_hotels_quotes: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "rateId": "rat_example123"
                 *     }
                 */
                "application/json": {
                    /** @description Current rat_ room rate ID */
                    rateId: string;
                };
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        quote: components["schemas"]["HotelQuote"];
                        pricing: components["schemas"]["Pricing"];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_hotels_quotes__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        quote: components["schemas"]["HotelQuote"];
                        pricing: components["schemas"]["Pricing"];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_bookings: {
        parameters: {
            query?: {
                /** @description Use the previous nextOffset. Records are newest first; deduplicate IDs when new records arrive. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        bookings: components["schemas"]["Booking"][];
                        /** @description Next page offset */
                        nextOffset: number | null;
                        summary: {
                            /** @description Confirmed count */
                            confirmed?: number;
                            /** @description Payable unexpired count */
                            pending?: number;
                            /** @description Processing/review/supplier-notice count */
                            attention?: number;
                        };
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_bookings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BookingCreate"];
            };
        };
        responses: {
            /** @description Successful response */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BookingResponse"];
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_bookings__id__pay: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /**
                         * Format: uri
                         * @description https://checkout.paystack.com/...
                         */
                        authorizationUrl: string;
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_bookings__id__complete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BookingResponse"];
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_bookings__id_: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BookingResponse"];
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_bookings__id__refresh: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BookingResponse"];
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_bookings__id__timeline: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        events: components["schemas"]["TimelineEvent"][];
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_bookings__id__service_request: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "message": "Please review whether I can change my departure date."
                 *     }
                 */
                "application/json": {
                    /** @description Support request */
                    message: string;
                };
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Saved */
                        success: boolean;
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    get_updates: {
        parameters: {
            query?: {
                /** @description Use the previous nextOffset. Records are newest first; deduplicate IDs when new records arrive. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        updates: components["schemas"]["TravelUpdate"][];
                        /** @description Next offset */
                        nextOffset: number | null;
                        /** @description All owner OTA unread notifications */
                        unreadCount: number;
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_updates__id__read: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Use the current identifier returned by the API; URL-encode it. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Read */
                        success: boolean;
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    post_updates_read_all: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description Successful response */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        /** @description Read */
                        success: boolean;
                    };
                };
            };
            /** @description Invalid input. Check error.fields when present. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Invalid input. Check error.fields when present."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Customer session or supplied integration key is missing/invalid/expired. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Customer session or supplied integration key is missing/invalid/expired."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Inactive account, incorrect role, integration scope or key mode. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Inactive account, incorrect role, integration scope or key mode."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Record not found or not owned by the customer. v1 unknown endpoints also return JSON 404."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Wrong HTTP method. Use the method documented for this endpoint and inspect Allow. */
            405: {
                headers: {
                    /** @description Supported HTTP methods for this endpoint */
                    Allow?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Wrong HTTP method. Use the method documented for this endpoint and inspect Allow."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Offer/price/state changed. Refresh the saved booking or current offer; do not silently accept a new price. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "The price has changed. Refresh the offer and review the new total before paying."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request body exceeds the API size limit. */
            413: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request body exceeds the API size limit."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Unsupported request encoding. Send JSON with Content-Type: application/json. */
            415: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Unsupported request encoding. Send JSON with Content-Type: application/json."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Request limit exceeded. Respect the Retry-After response header. */
            429: {
                headers: {
                    /** @description Seconds before retry; limits also apply at the edge */
                    "Retry-After"?: string;
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Request limit exceeded. Respect the Retry-After response header."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself. */
            502: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Supplier/payment request failed. A purchase may require reconciliation; never infer a refund or retry a supplier order yourself."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
            /** @description Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    /**
                     * @example {
                     *       "error": "Feature disabled, configuration unavailable or provider/storage unavailable. Saved paid bookings must remain recoverable."
                     *     }
                     */
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
