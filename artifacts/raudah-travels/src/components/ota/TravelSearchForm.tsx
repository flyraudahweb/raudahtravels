import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Plane,
  Building2,
  BriefcaseBusiness,
  Search,
  ArrowRightLeft,
  ChevronDown,
  Package,
  Plus,
  X,
} from "lucide-react";
import { ota, travelButton } from "@/lib/ota";
import { cabinNames, dateKey, MAX_MULTI_CITY_LEGS, readDate, readMultiCityLegs } from "@/lib/travelSearch";
import {
  AirportPicker,
  DatePicker,
  searchField,
  StayDestinationPicker,
  TravellerPicker,
} from "./SearchPickers";

type TripType = "one_way" | "round_trip" | "multi_city";
type EditableLeg = ReturnType<typeof readMultiCityLegs>[number] & {
  id: number;
  originLabel?: string;
  destinationLabel?: string;
};
const multiCityColumns =
  "grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]";
const desktopBookingControls =
  "lg:[&_:is([data-booking-field],[data-booking-submit])]:min-h-[68px] lg:[&_[data-booking-field]]:gap-2 lg:[&_[data-booking-field]]:px-3 lg:[&_[data-booking-field]]:py-1.5 lg:[&_[data-booking-field]]:leading-4 " +
  "lg:[&_[data-booking-label]]:mb-0.5 lg:[&_[data-booking-label]]:text-xs/4 lg:[&_[data-booking-value]]:text-[15px]/5 lg:[&_[data-booking-hint]]:text-[11px]/4";

export default function TravelSearchForm({
  initialKind = "flight",
  initial,
  compact = false,
  onSearchAgain,
  packagesSectionId,
  variant = "website",
}: {
  initialKind?: "flight" | "hotel";
  initial?: URLSearchParams;
  compact?: boolean;
  onSearchAgain?: () => void;
  packagesSectionId?: string;
  variant?: "website" | "app" | "landing";
}) {
  const [, navigate] = useLocation(),
    [kind, setKind] = useState(initialKind);
  const [origin, setOrigin] = useState(initial?.get("origin") || "LOS"),
    [destination, setDestination] = useState(
      initial?.get("destination") || "JED",
    );
  const [city, setCity] = useState(initial?.get("city") || "0");
  const [tripType, setTripType] = useState<TripType>(
    initial?.has("leg") ? "multi_city" : initial?.has("returnDate") ? "round_trip" : "one_way",
  );
  const [legs, setLegs] = useState<EditableLeg[]>(() =>
    readMultiCityLegs(initial ?? new URLSearchParams()).slice(0, MAX_MULTI_CITY_LEGS)
      .map((leg, id) => ({ ...leg, id })),
  );
  const nextLegId = useRef(MAX_MULTI_CITY_LEGS);
  const [guestNationality, setGuestNationality] = useState(
    initial?.get("guestNationality") || "NG",
  );
  const [originLabel, setOriginLabel] = useState(
      (initial?.get("originLabel") || "").slice(0, 80),
    ),
    [destinationLabel, setDestinationLabel] = useState(
      (initial?.get("destinationLabel") || "").slice(0, 80),
    );
  const [departure, setDeparture] = useState(
      initial?.get("departureDate") || initial?.get("checkIn") || "",
    ),
    [returnDate, setReturnDate] = useState(
      initial?.get("returnDate") || initial?.get("checkOut") || "",
    );
  const [adults, setAdults] = useState(Number(initial?.get("adults") || 1)),
    [rooms, setRooms] = useState(Number(initial?.get("rooms") || 1));
  const [cabin, setCabin] = useState(initial?.get("cabinClass") || "economy"),
    [ages, setAges] = useState<number[]>(
      (initial?.get("childAges") || "").split(",").filter(Boolean).map(Number),
    );
  const [error, setError] = useState("");
  const hotel = kind === "hotel";
  const multiCity = !hotel && tripType === "multi_city";
  const { data: otaConfig, isPending: loadingConfig } = useQuery({
    queryKey: ["ota", "public-config"],
    queryFn: () => ota<{ multiCityFlightSearchEnabled?: boolean }>("/config"),
    enabled: !hotel,
    staleTime: 30_000,
    retry: false,
  });
  const multiCityEnabled = otaConfig?.multiCityFlightSearchEnabled === true;
  const multiCityStatusId = useId();
  const flightGroupId = useId();
  const multiCityUnavailable = !hotel && !loadingConfig && !multiCityEnabled;
  const roundTrip = tripType === "round_trip";
  const appLayout = variant === "app";
  const landingLayout = variant === "landing";
  const landingTabClass =
    "flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] focus-visible:ring-inset sm:gap-2 sm:px-5 sm:text-base";
  const inactiveLandingTabClass =
    "text-slate-600 hover:bg-white/75 hover:text-[#2D3199]";
  const PackageIcon = landingLayout ? BriefcaseBusiness : Package;
  function changeTripType(next: TripType) {
    setError("");
    setTripType(next);
    if (next === "multi_city" && legs.length < 2) {
      setLegs([
        { id: 0, origin, destination, originLabel, destinationLabel, departureDate: departure },
        { id: 1, origin: destination, originLabel: destinationLabel, destination: "", departureDate: returnDate },
      ]);
    }
  }
  function updateLeg(id: number, values: Partial<EditableLeg>) {
    setLegs((current) => current.map((leg) => leg.id === id ? { ...leg, ...values } : leg));
  }
  return (
    <div
      role={landingLayout ? "region" : undefined}
      aria-label={landingLayout ? "Travel booking search" : undefined}
      className={`relative bg-white text-slate-900 ${landingLayout ? "rounded-3xl border border-slate-200 p-4 shadow-[0_18px_55px_-24px_rgba(28,31,102,0.35)] sm:p-6 md:p-7 max-lg:[&_[data-booking-field]]:min-h-[94px] [&_[data-booking-field]]:border-slate-200 [&_[data-booking-field]]:bg-white [&_[data-booking-field]]:px-4 [&_[data-booking-label]]:mb-1 [&_[data-booking-label]]:text-sm [&_[data-booking-label]]:font-semibold [&_[data-booking-label]]:text-slate-700 [&_[data-booking-value]]:text-lg [&_[data-booking-hint]]:text-xs [&_[data-booking-hint]]:text-slate-600" : `rounded-2xl border border-slate-200 ${appLayout ? "p-4 sm:p-6" : compact ? "p-4 shadow-sm md:p-5" : "p-4 shadow-[0_20px_70px_-25px_rgba(25,30,100,0.35)] md:p-6"}`}`}
    >
      <div
        className={
          landingLayout
            ? "-mx-4 -mt-4 mb-4 grid grid-cols-3 gap-1 rounded-t-[calc(1.5rem-1px)] border-b border-slate-200 bg-[#EEF0F8] p-1.5 sm:-mx-6 sm:-mt-6 sm:mb-5 sm:p-2 md:-mx-7 md:-mt-7"
            : `flex flex-wrap items-center gap-2 ${compact ? "mb-3" : "mb-4 border-b border-slate-100 pb-4"}`
        }
      >
        {landingLayout && <h2 className="sr-only">Book your next journey</h2>}
        {(
          [
            ["flight", "Flights", Plane],
            ["hotel", "Hotels", Building2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={kind === key}
            onClick={() => {
              setKind(key);
              setError("");
              if (key === "flight")
                setAges((current) =>
                  current
                    .slice(0, 9 - adults)
                    .map((age) => Math.min(11, Math.max(2, age))),
                );
            }}
            className={
              landingLayout
                ? `${landingTabClass} ${kind === key ? "bg-white text-[#2D3199] shadow-sm ring-1 ring-slate-200/80" : inactiveLandingTabClass}`
                : `flex items-center gap-2 font-semibold transition-colors ${compact ? "rounded-xl px-3 py-1.5 text-xs" : "rounded-xl px-3 py-2.5 text-sm sm:px-5"} ${kind === key ? "bg-[#2D3199] text-white shadow-sm" : "border-transparent text-slate-500 hover:bg-indigo-50 hover:text-[#2D3199]"}`
            }
          >
            <Icon size={19} className={landingLayout ? "h-4 w-4 shrink-0 sm:h-5 sm:w-5" : undefined} aria-hidden="true" />
            {label}
          </button>
        ))}
        <Link
          href="/packages"
          title="Browse Hajj & Umrah packages"
          onClick={(event) => {
            if (
              !packagesSectionId ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            const section = document.getElementById(packagesSectionId);
            if (!section) return;
            event.preventDefault();
            section.focus({ preventScroll: true });
            section.scrollIntoView({
              block: "start",
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
          }}
          className={
            landingLayout
              ? `${landingTabClass} ${inactiveLandingTabClass} active:bg-white active:text-[#2D3199]`
              : `flex items-center gap-2 rounded-xl font-bold text-slate-500 transition-colors hover:bg-indigo-50 hover:text-[#2D3199] ${compact ? "px-3 py-1.5 text-xs" : "px-3 py-2.5 text-sm sm:px-5"}`
          }
        >
          <PackageIcon size={19} className={landingLayout ? "h-4 w-4 shrink-0 sm:h-5 sm:w-5" : undefined} aria-hidden="true" />
          Packages
        </Link>
      </div>
      <form
        className={desktopBookingControls}
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const today = dateKey(new Date());
          if (multiCity) {
            if (!multiCityEnabled) return;
            if (legs.length < 2 || legs.some(({ origin, destination, departureDate }, index) =>
              !/^[A-Z]{3}$/.test(origin) || !/^[A-Z]{3}$/.test(destination) ||
              origin === destination || !readDate(departureDate) || departureDate < today ||
              (index > 0 && departureDate < legs[index - 1].departureDate)))
              return setError("Choose two different airports and a date for each flight. Put the flights in date order.");
          } else if (!readDate(departure) || departure < today)
            return setError(
              "Select a departure or check-in date from the calendar.",
            );
          if (
            !multiCity && (hotel || roundTrip) &&
            (!readDate(returnDate) ||
              (hotel ? returnDate <= departure : returnDate < departure))
          )
            return setError(
              hotel
                ? "Select a check-out date after check-in."
                : "Select a return date on or after departure.",
            );
          if (
            !hotel && !multiCity &&
            (!/^[A-Z]{3}$/.test(origin) ||
              !/^[A-Z]{3}$/.test(destination) ||
              origin === destination)
          )
            return setError("Choose different departure and arrival airports.");
          if (
            !Number.isInteger(adults) ||
            adults < 1 ||
            adults > 9 ||
            ages.some(
              (age) =>
                !Number.isInteger(age) ||
                age < (hotel ? 0 : 2) ||
                age > (hotel ? 17 : 11),
            ) ||
            (!hotel && adults + ages.length > 9)
          )
            return setError("Check your traveller numbers and child ages.");
          const query = new URLSearchParams({
            adults: String(adults),
            childAges: ages.join(","),
          });
          if (!hotel) {
            query.set("cabinClass", cabin);
            if (multiCity) {
              for (const leg of legs)
                query.append("leg", [leg.origin, leg.destination, leg.departureDate].join(","));
            } else {
              query.set("origin", origin);
              query.set("destination", destination);
              if (originLabel) query.set("originLabel", originLabel);
              if (destinationLabel) query.set("destinationLabel", destinationLabel);
              query.set("departureDate", departure);
              if (roundTrip) query.set("returnDate", returnDate);
            }
          } else {
            query.set("city", city);
            query.set("checkIn", departure);
            query.set("checkOut", returnDate);
            query.set("rooms", String(rooms));
            if (guestNationality !== "NG")
              query.set("guestNationality", guestNationality);
          }
          const path = `/${hotel ? "hotels" : "flights"}/search?${query}`;
          if (
            path === window.location.pathname + window.location.search &&
            onSearchAgain
          )
            onSearchAgain();
          else navigate(path);
        }}
      >
        {!hotel && (
          <fieldset className="mx-auto mb-4 w-full min-w-0 max-w-sm sm:mx-0">
            <legend className="sr-only">Journey type</legend>
            <div className="grid grid-cols-3 rounded-full border border-indigo-100 bg-indigo-50/70 p-1 text-center text-xs font-semibold sm:text-sm">
              {(
                [
                  ["round_trip", "Round trip"],
                  ["one_way", "One way"],
                  ["multi_city", "Multi-city"],
                ] as const
              ).map(([value, label]) => {
                const disabled = value === "multi_city" && !multiCityEnabled;
                return (
                  <label key={label} className={`relative min-w-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      type="radio"
                      name="journey"
                      className="peer sr-only"
                      checked={tripType === value}
                      disabled={disabled}
                      aria-describedby={disabled && multiCityUnavailable ? multiCityStatusId : undefined}
                      onChange={() => changeTripType(value)}
                    />
                    <span className="flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-1 text-slate-700 transition-colors peer-checked:bg-[#2D3199] peer-checked:text-white peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-600 peer-focus-visible:ring-offset-2 sm:px-2">
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        {multiCityUnavailable && (
          <p id={multiCityStatusId} role="status" className="mb-4 text-xs text-slate-600">
            Multi-city search is currently unavailable.
          </p>
        )}
        {multiCity && (
          <div className="mb-4 space-y-3 sm:space-y-4">
            {legs.map((leg, index) => (
              <div key={leg.id} role="group" aria-labelledby={`${flightGroupId}-${leg.id}`}>
                <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                  <h3 id={`${flightGroupId}-${leg.id}`} className="text-xs font-bold uppercase tracking-wide text-indigo-950">
                    Flight {index + 1}
                  </h3>
                  {legs.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove flight ${index + 1}`}
                      onClick={() => setLegs((current) => current.filter(({ id }) => id !== leg.id))}
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-[#2D3199]"
                    >
                      <X size={18} aria-hidden="true" />
                      Remove
                    </button>
                  )}
                </div>
                <div className={multiCityColumns}>
                  <div className="relative col-span-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] sm:gap-3 lg:col-span-3 lg:grid-cols-subgrid">
                    <AirportPicker
                      label="From"
                      value={leg.origin}
                      selectedLabel={leg.originLabel}
                      onChange={(code, name) => updateLeg(leg.id, { origin: code, originLabel: name })}
                    />
                    <button
                      type="button"
                      aria-label={`Swap airports for flight ${index + 1}`}
                      onClick={() => updateLeg(leg.id, {
                        origin: leg.destination,
                        originLabel: leg.destinationLabel,
                        destination: leg.origin,
                        destinationLabel: leg.originLabel,
                      })}
                      className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-indigo-100 bg-white text-[#2D3199] shadow-sm transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] sm:static sm:translate-y-0 sm:self-center"
                    >
                      <ArrowRightLeft size={17} aria-hidden="true" />
                    </button>
                    <AirportPicker
                      label="To"
                      value={leg.destination}
                      selectedLabel={leg.destinationLabel}
                      onChange={(code, name) => updateLeg(leg.id, { destination: code, destinationLabel: name })}
                    />
                  </div>
                  <DatePicker
                    departure={leg.departureDate}
                    returnDate=""
                    range={false}
                    hotel={false}
                    onChange={(date) => updateLeg(leg.id, { departureDate: date })}
                  />
                  <label
                    data-booking-field=""
                    className={`${searchField} relative min-w-0 cursor-pointer gap-1 focus-within:ring-2 focus-within:ring-[#2D3199]`}
                  >
                    <span className="min-w-0 flex-1" aria-hidden="true">
                      <span data-booking-label="" className="block text-[11px] font-medium text-slate-500">Cabin class</span>
                      <span data-booking-value="" className="block truncate text-sm font-bold text-slate-950">{cabinNames[cabin]}</span>
                      <span data-booking-hint="" className="block text-[10px] text-slate-500">All flights</span>
                    </span>
                    <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-slate-400" />
                    <select
                      aria-label="Cabin class for all flights"
                      value={cabin}
                      onChange={(event) => setCabin(event.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    >
                      {Object.entries(cabinNames).map(([key, name]) => (
                        <option key={key} value={key}>{name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        <div
          className={multiCity ? multiCityColumns : `grid gap-3 ${appLayout ? "sm:grid-cols-2" : compact ? "xl:grid-cols-[2fr_1.35fr_1fr_auto]" : "lg:grid-cols-[1.8fr_1.35fr_1fr_auto]"}`}
        >
          {multiCity && legs.length < MAX_MULTI_CITY_LEGS && (
            <button
              type="button"
              onClick={() => {
                const id = nextLegId.current++;
                setLegs((current) => [...current, { id, origin: "", destination: "", departureDate: "" }]);
              }}
              className="col-span-2 inline-flex min-h-11 items-center gap-2 self-center justify-self-start rounded-xl border border-dashed border-indigo-300 px-4 text-sm font-semibold text-[#2D3199] transition-colors hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] lg:col-span-4"
            >
              <Plus size={18} aria-hidden="true" /> Add another flight
            </button>
          )}
          {!multiCity && (hotel ? (
            <div className={appLayout ? "sm:col-span-2" : undefined}>
              <StayDestinationPicker value={city} onChange={setCity} />
            </div>
          ) : (
            <div
              className={`relative grid grid-cols-2 gap-2 ${appLayout ? "sm:col-span-2" : ""}`}
            >
              <AirportPicker
                label="Flying from"
                value={origin}
                selectedLabel={originLabel}
                onChange={(code, name) => {
                  setOrigin(code);
                  setOriginLabel(name);
                }}
              />
              <button
                type="button"
                aria-label="Swap departure and destination"
                onClick={() => {
                  setOrigin(destination);
                  setDestination(origin);
                  setOriginLabel(destinationLabel);
                  setDestinationLabel(originLabel);
                }}
                className="absolute left-1/2 top-1/2 z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-indigo-100 bg-white text-[#2D3199] shadow-sm transition hover:rotate-180 hover:bg-indigo-50"
              >
                <ArrowRightLeft size={15} />
              </button>
              <AirportPicker
                label="Flying to"
                value={destination}
                selectedLabel={destinationLabel}
                onChange={(code, name) => {
                  setDestination(code);
                  setDestinationLabel(name);
                }}
              />
            </div>
          ))}
          {!multiCity && <DatePicker
            departure={departure}
            returnDate={returnDate}
            range={hotel || roundTrip}
            hotel={hotel}
            onChange={(first, last) => {
              setDeparture(first);
              setReturnDate(last);
            }}
          />}
          <div className={multiCity ? "col-span-2 min-w-0 lg:col-span-1 lg:col-start-5" : "contents"}>
            <TravellerPicker
              kind={kind}
              adults={adults}
              ages={ages}
              rooms={rooms}
              cabin={cabin}
              showCabin={!multiCity}
              guestNationality={guestNationality}
              onGuestNationalityChange={setGuestNationality}
              onChange={(value) => {
                setAdults(value.adults);
                setAges(value.ages);
                setRooms(value.rooms);
                setCabin(value.cabin);
              }}
            />
          </div>
          <button
            type="submit"
            data-booking-submit=""
            disabled={multiCity && !multiCityEnabled}
            className={`${travelButton} min-h-[62px] bg-[#FF3B00] text-[15px] shadow-[0_6px_18px_-8px_rgba(255,59,0,0.5)] hover:bg-[#dc3300] ${multiCity ? "col-span-2 lg:col-span-1 lg:col-start-5" : appLayout ? "sm:col-span-2" : ""}`}
          >
            <Search size={21} />
            <span>Search {hotel ? "hotels" : "flights"}</span>
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
