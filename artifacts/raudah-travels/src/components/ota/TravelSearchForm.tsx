import { useState } from "react";
import { useLocation } from "wouter";
import {
  Plane,
  Building2,
  Search,
  ArrowRightLeft,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { travelButton } from "@/lib/ota";
import { dateKey, readDate } from "@/lib/travelSearch";
import {
  AirportPicker,
  DatePicker,
  StayDestinationPicker,
  TravellerPicker,
} from "./SearchPickers";

export default function TravelSearchForm({
  initialKind = "flight",
  initial,
  compact = false,
  onSearchAgain,
}: {
  initialKind?: "flight" | "hotel";
  initial?: URLSearchParams;
  compact?: boolean;
  onSearchAgain?: () => void;
}) {
  const [, navigate] = useLocation(),
    [kind, setKind] = useState(initialKind);
  const [origin, setOrigin] = useState(initial?.get("origin") || "LOS"),
    [destination, setDestination] = useState(
      initial?.get("destination") || "JED",
    );
  const [city, setCity] = useState(initial?.get("city") || "0"),
    [roundTrip, setRoundTrip] = useState(!!initial?.get("returnDate"));
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
  return (
    <div
      className={`relative rounded-[22px] border border-slate-200 bg-white text-slate-900 ${compact ? "p-4 shadow-sm md:p-5" : "p-4 shadow-[0_20px_70px_-25px_rgba(25,30,100,0.35)] md:p-6"}`}
    >
      <div
        className={`flex items-center gap-2 ${compact ? "mb-3" : "mb-4 border-b border-slate-100 pb-4"}`}
      >
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
            className={`flex items-center gap-2 rounded-xl font-bold transition-colors ${compact ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm"} ${kind === key ? "bg-[#2D3199] text-white shadow-sm" : "text-slate-500 hover:bg-indigo-50 hover:text-[#2D3199]"}`}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
        <a
          href="/packages"
          className="ml-auto hidden items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#2D3199] sm:flex"
        >
          Hajj & Umrah packages
          <ChevronRight size={14} />
        </a>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          if (!readDate(departure) || departure < dateKey(new Date()))
            return setError(
              "Select a departure or check-in date from the calendar.",
            );
          if (
            (hotel || roundTrip) &&
            (!readDate(returnDate) ||
              (hotel ? returnDate <= departure : returnDate < departure))
          )
            return setError(
              hotel
                ? "Select a check-out date after check-in."
                : "Select a return date on or after departure.",
            );
          if (
            !hotel &&
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
            query.set("origin", origin);
            query.set("destination", destination);
            if (originLabel) query.set("originLabel", originLabel);
            if (destinationLabel)
              query.set("destinationLabel", destinationLabel);
            query.set("departureDate", departure);
            query.set("cabinClass", cabin);
            if (roundTrip) query.set("returnDate", returnDate);
          } else {
            query.set("city", city);
            query.set("checkIn", departure);
            query.set("checkOut", returnDate);
            query.set("rooms", String(rooms));
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
          <fieldset className="mb-4 flex items-center gap-5 text-xs font-medium sm:text-sm">
            <legend className="sr-only">Journey type</legend>
            {(
              [
                [false, "One way"],
                [true, "Round trip"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={label}
                className="flex cursor-pointer items-center gap-2"
              >
                <input
                  type="radio"
                  name="journey"
                  className="h-3.5 w-3.5 accent-[#2D3199]"
                  checked={roundTrip === value}
                  onChange={() => setRoundTrip(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <div
          className={`grid gap-3 ${compact ? "xl:grid-cols-[2fr_1.35fr_1fr_auto]" : "lg:grid-cols-[1.8fr_1.35fr_1fr_auto]"}`}
        >
          {hotel ? (
            <StayDestinationPicker value={city} onChange={setCity} />
          ) : (
            <div className="relative grid grid-cols-2 gap-2">
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
          )}
          <DatePicker
            departure={departure}
            returnDate={returnDate}
            range={hotel || roundTrip}
            hotel={hotel}
            onChange={(first, last) => {
              setDeparture(first);
              setReturnDate(last);
            }}
          />
          <TravellerPicker
            kind={kind}
            adults={adults}
            ages={ages}
            rooms={rooms}
            cabin={cabin}
            onChange={(value) => {
              setAdults(value.adults);
              setAges(value.ages);
              setRooms(value.rooms);
              setCabin(value.cabin);
            }}
          />
          <button
            type="submit"
            className={`${travelButton} min-h-[62px] bg-[#FF3B00] text-[15px] shadow-[0_6px_18px_-8px_rgba(255,59,0,0.5)] hover:bg-[#dc3300] ${compact ? "xl:min-h-[76px]" : ""}`}
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
        {!compact && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
            <p className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#2D3199]" />
              Compare available options. Review the final price before payment.
            </p>
            <span className="font-medium text-[#2D3199]">
              Your journey, thoughtfully arranged.
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
