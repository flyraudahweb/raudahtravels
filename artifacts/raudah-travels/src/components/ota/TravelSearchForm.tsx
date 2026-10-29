import { useEffect, useId, useState } from "react";
import { useLocation } from "wouter";
import { Plane, Building2, Search, ArrowRightLeft } from "lucide-react";
import { destinations, ota, travelInput, travelButton } from "@/lib/ota";

function Airport({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  const [query, setQuery] = useState(value),
    [places, setPlaces] = useState<any[]>([]),
    [error, setError] = useState("");
  const listId = useId();
  const [active, setActive] = useState(0);
  const choose = (place: any) => {
    onChange(place.iata_code);
    setQuery(place.iata_code);
    setPlaces([]);
  };
  useEffect(() => {
    if (value) setQuery(value);
  }, [value]);
  useEffect(() => {
    if (query.length < 2 || query === value) {
      setPlaces([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      ota(
        `/places?q=${encodeURIComponent(query)}`,
        undefined,
        undefined,
        controller.signal,
      )
        .then((data) => {
          setPlaces(data.places || []);
          setActive(0);
          setError("");
        })
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);
  return (
    <label className="relative block text-xs font-bold text-slate-600">
      {label}
      <input
        className={`${travelInput} mt-1.5`}
        value={query}
        autoComplete="off"
        placeholder="City, airport or IATA code"
        aria-controls={listId}
        role="combobox"
        aria-autocomplete="list"
        aria-activedescendant={
          places.length ? `${listId}-${active}` : undefined
        }
        aria-expanded={!!places.length}
        onBlur={() => setPlaces([])}
        onKeyDown={(e) => {
          if (!places.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive(
              (i) =>
                (i + (e.key === "ArrowDown" ? 1 : -1) + places.length) %
                places.length,
            );
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(places[active]);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setPlaces([]);
          }
        }}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          onChange(/^[a-z]{3}$/i.test(v) ? v.toUpperCase() : "");
        }}
        required
      />
      {places.length > 0 && (
        <div
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-white shadow-xl"
        >
          {places.map((p, index) => (
            <button
              type="button"
              key={p.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={active === index}
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              className={`block w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 ${active === index ? "bg-indigo-50" : ""}`}
              onClick={() => choose(p)}
            >
              {p.name} <span className="text-indigo-600">{p.iata_code}</span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <span className="mt-1 block text-xs font-normal text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
export default function TravelSearchForm({
  initialKind = "flight",
  initial,
  compact = false,
}: {
  initialKind?: "flight" | "hotel";
  initial?: URLSearchParams;
  compact?: boolean;
}) {
  const [, navigate] = useLocation(),
    [kind, setKind] = useState(initialKind);
  const [origin, setOrigin] = useState(initial?.get("origin") || "LOS"),
    [destination, setDestination] = useState(
      initial?.get("destination") || "JED",
    );
  const [city, setCity] = useState(initial?.get("city") || "0"),
    [roundTrip, setRoundTrip] = useState(!!initial?.get("returnDate"));
  const [departure, setDeparture] = useState(
      initial?.get("departureDate") || initial?.get("checkIn") || "",
    ),
    [returnDate, setReturnDate] = useState(
      initial?.get("returnDate") || initial?.get("checkOut") || "",
    );
  const [adults, setAdults] = useState(Number(initial?.get("adults") || 1)),
    [rooms, setRooms] = useState(Number(initial?.get("rooms") || 1));
  const [cabin, setCabin] = useState(initial?.get("cabinClass") || "economy"),
    [childAges, setChildAges] = useState(initial?.get("childAges") || "");
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div
      className={`rounded-3xl border border-slate-200 bg-white text-slate-900 ${compact ? "p-5" : "p-5 shadow-[0_20px_70px_-25px_rgba(25,30,100,0.35)] md:p-7"}`}
    >
      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
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
            }}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold ${kind === key ? "bg-[#2D3199] text-white" : "bg-slate-50 text-slate-600 hover:bg-indigo-50"}`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
        <a
          href="/packages"
          className="self-center px-4 text-sm font-semibold text-slate-500 hover:text-indigo-700"
        >
          Hajj & Umrah packages →
        </a>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          const ages = childAges.trim()
            ? childAges.split(",").map((v) => Number(v.trim()))
            : [];
          if (
            ages.some(
              (v) =>
                !Number.isInteger(v) ||
                v < (kind === "flight" ? 2 : 0) ||
                v > (kind === "flight" ? 11 : 17),
            )
          )
            return setError(
              kind === "flight"
                ? "Enter child ages from 2–11, separated by commas. Contact support for infants."
                : "Enter child ages from 0–17, separated by commas.",
            );
          if (
            kind === "flight" &&
            (!/^[A-Z]{3}$/.test(origin) ||
              !/^[A-Z]{3}$/.test(destination) ||
              origin === destination)
          )
            return setError("Choose different departure and arrival airports.");
          if (
            (kind === "hotel" && returnDate <= departure) ||
            (kind === "flight" && roundTrip && returnDate < departure)
          )
            return setError(
              "The return or check-out date must follow departure or check-in.",
            );
          const query = new URLSearchParams({
            adults: String(adults),
            childAges: ages.join(","),
          });
          if (kind === "flight") {
            query.set("origin", origin);
            query.set("destination", destination);
            query.set("departureDate", departure);
            query.set("cabinClass", cabin);
            if (roundTrip) query.set("returnDate", returnDate);
          } else {
            query.set("city", city);
            query.set("checkIn", departure);
            query.set("checkOut", returnDate);
            query.set("rooms", String(rooms));
          }
          navigate(
            `/${kind === "flight" ? "flights" : "hotels"}/search?${query}`,
          );
        }}
        className="space-y-4"
      >
        {kind === "flight" && (
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="journey"
                checked={!roundTrip}
                onChange={() => setRoundTrip(false)}
              />
              One way
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="journey"
                checked={roundTrip}
                onChange={() => setRoundTrip(true)}
              />
              Return
            </label>
          </div>
        )}
        <div
          className={`grid gap-3 sm:grid-cols-2 ${kind === "flight" && !roundTrip ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
        >
          {kind === "flight" ? (
            <>
              <Airport
                label="Flying from"
                value={origin}
                onChange={setOrigin}
              />
              <div className="relative">
                <Airport
                  label="Flying to"
                  value={destination}
                  onChange={setDestination}
                />
                <button
                  type="button"
                  aria-label="Swap departure and destination"
                  className="absolute right-2 top-0 text-indigo-600"
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                  }}
                >
                  <ArrowRightLeft size={14} />
                </button>
              </div>
            </>
          ) : (
            <label className="text-xs font-bold text-slate-600 sm:col-span-2">
              Destination
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={`${travelInput} mt-1.5`}
              >
                {destinations.map((c, i) => (
                  <option key={c.name} value={i}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs font-bold text-slate-600">
            {kind === "flight" ? "Departure" : "Check-in"}
            <input
              type="date"
              min={today}
              required
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
              className={`${travelInput} mt-1.5`}
            />
          </label>
          {(kind === "hotel" || roundTrip) && (
            <label className="text-xs font-bold text-slate-600">
              {kind === "hotel" ? "Check-out" : "Return"}
              <input
                type="date"
                min={departure || today}
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={`${travelInput} mt-1.5`}
              />
            </label>
          )}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-bold text-slate-600">
            Adults
            <select
              className={`${travelInput} mt-1.5`}
              value={adults}
              onChange={(e) => {
                const count = Number(e.target.value);
                setAdults(count);
                setRooms(Math.min(rooms, count));
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} adult{i ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Child ages, separated by commas
            <input
              value={childAges}
              onChange={(e) => setChildAges(e.target.value)}
              placeholder={
                kind === "flight"
                  ? "e.g. 5, 10 · ages 2–11"
                  : "e.g. 5, 10 · ages 0–17"
              }
              className={`${travelInput} mt-1.5`}
            />
          </label>
          {kind === "flight" ? (
            <label className="text-xs font-bold text-slate-600">
              Cabin
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value)}
                className={`${travelInput} mt-1.5`}
              >
                {["economy", "premium_economy", "business", "first"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c.replace("_", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : (
            <label className="text-xs font-bold text-slate-600">
              Rooms
              <select
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className={`${travelInput} mt-1.5`}
              >
                {Array.from({ length: Math.min(8, adults) }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className={`${travelButton} min-h-12 bg-[#FF3B00] hover:bg-[#dc3300]`}
          >
            <Search size={18} />
            Search {kind === "flight" ? "flights" : "hotels"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <p className="text-xs font-normal text-slate-500">
          Compare available options. Review the final price and booking
          conditions before payment.
        </p>
      </form>
    </div>
  );
}
