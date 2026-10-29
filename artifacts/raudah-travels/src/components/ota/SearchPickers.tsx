import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  MapPin,
  Minus,
  Plane,
  Plus,
  Search,
  Users,
  X,
  Building2,
} from "lucide-react";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import SearchPopoverContent from "./SearchPopoverContent";
const Calendar = lazy(() =>
  import("@/components/ui/calendar").then((module) => ({
    default: module.Calendar,
  })),
);
import { destinations, ota, travelButton } from "@/lib/ota";
import {
  airportTitle,
  cabinNames,
  dateKey,
  popularAirports,
  readDate,
} from "@/lib/travelSearch";

const panel =
  "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-2xl border-slate-200 bg-white p-0 text-slate-900 shadow-[0_20px_65px_-15px_rgba(28,31,102,0.3)]";
export const searchField =
  "flex min-h-[76px] w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-[#2D3199]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] data-[state=open]:border-[#2D3199] data-[state=open]:bg-indigo-50/40";
function ClosePanel({ close }: { close: () => void }) {
  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close selection"
      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
    >
      <X size={18} />
    </button>
  );
}
export function AirportPicker({
  label,
  value,
  onChange,
  selectedLabel,
}: {
  label: string;
  value: string;
  onChange: (code: string, name: string) => void;
  selectedLabel?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [places, setPlaces] = useState<any[]>([]),
    [resultQuery, setResultQuery] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [selection, setSelection] = useState<{
      code: string;
      name: string;
    } | null>(null),
    [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null),
    listId = useId();
  const local = popularAirports.filter((p) =>
    `${p.code} ${p.city} ${p.name}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const options =
    query.trim().length >= 2
      ? resultQuery === query.trim()
        ? places
        : []
      : local.map((p) => ({
          id: p.code,
          iata_code: p.code,
          name: p.city,
          detail: p.name,
        }));
  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setPlaces([]);
      setLoading(false);
      setError("");
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setPlaces([]);
    const timer = setTimeout(() => {
      ota(
        `/places?q=${encodeURIComponent(query.trim())}`,
        undefined,
        undefined,
        abort.signal,
      )
        .then((data) => {
          if (!abort.signal.aborted) {
            setPlaces((data.places || []).filter((p: any) => p.iata_code));
            setResultQuery(query.trim());
            setActive(0);
          }
        })
        .catch((e) => {
          if (!abort.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [open, query]);
  function choose(place: any) {
    const name = place.city_name || place.city?.name || place.name;
    onChange(place.iata_code, name);
    setSelection({
      code: place.iata_code,
      name,
    });
    setOpen(false);
    setQuery("");
  }
  const known = popularAirports.find((p) => p.code === value);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${selection?.code === value ? selection.name : selectedLabel || airportTitle(value)}`}
          className={searchField}
        >
          <MapPin
            className="hidden shrink-0 text-[#2D3199] sm:block"
            size={20}
          />
          <span className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[11px] font-medium text-slate-500">
              {label}
            </span>
            <span className="block truncate text-[15px] font-bold text-slate-950">
              {selection?.code === value
                ? selection.name
                : selectedLabel || airportTitle(value) || "Choose a city"}
            </span>
            <span className="hidden truncate text-[10px] text-slate-500 sm:block">
              {known?.name ||
                (value ? "City or airport" : "Select your airport")}
            </span>
            <span className="block text-[10px] text-slate-500 sm:hidden">
              {value || "Select airport"}
            </span>
          </span>
          <span className="hidden rounded-md bg-indigo-50 px-1.5 py-1 text-[11px] font-bold text-[#2D3199] sm:block">
            {value || "—"}
          </span>
        </button>
      </PopoverTrigger>
      <SearchPopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className={`${panel} w-[min(440px,calc(100vw-24px))]`}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          input.current?.focus();
        }}
      >
        <div className="border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">{label}</h3>
            <ClosePanel close={() => setOpen(false)} />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50/40 px-3">
            <Search size={17} className="text-[#2D3199]" />
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search city, airport or airport code"
              aria-label={`Search ${label.toLowerCase()}`}
              role="combobox"
              aria-expanded={true}
              aria-controls={listId}
              aria-activedescendant={
                options[active] ? `${listId}-${active}` : undefined
              }
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) =>
                    options.length
                      ? (i +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          options.length) %
                        options.length
                      : 0,
                  );
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (options[active]) choose(options[active]);
                }
              }}
            />
          </div>
        </div>
        <div
          id={listId}
          role="listbox"
          aria-label={`${label} destinations`}
          className="max-h-[min(390px,55dvh)] overflow-y-auto overscroll-contain p-3"
        >
          {query.trim().length < 2 ? (
            <>
              {[...new Set(local.map((p) => p.region))].map((region) => (
                <div key={region} className="mb-4">
                  <p className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {region}
                  </p>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                    {local
                      .filter((p) => p.region === region)
                      .map((p) => {
                        const index = options.findIndex(
                          (o) => o.iata_code === p.code,
                        );
                        return (
                          <button
                            type="button"
                            key={p.code}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={value === p.code}
                            onClick={() =>
                              choose({ iata_code: p.code, name: p.city })
                            }
                            className="rounded-xl px-3 py-3 text-left text-sm hover:bg-indigo-50 focus-visible:bg-indigo-50 focus-visible:outline-none"
                          >
                            <span className="block font-semibold">
                              {p.city}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {p.code}
                            </span>
                            {value === p.code && (
                              <Check
                                size={12}
                                className="inline text-[#2D3199]"
                              />
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {loading && (
                <p role="status" className="p-5 text-sm text-slate-500">
                  Finding airports…
                </p>
              )}
              {error && (
                <p role="alert" className="p-4 text-sm text-red-700">
                  {error}
                </p>
              )}
              {!loading && !error && !options.length && (
                <p className="p-5 text-sm text-slate-500">
                  No matching airports. Try another city or airport code.
                </p>
              )}
              {options.map((p: any, index: number) => (
                <button
                  type="button"
                  key={p.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(p)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-indigo-50 ${index === active ? "bg-indigo-50" : ""}`}
                >
                  <Plane size={17} className="shrink-0 text-[#2D3199]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {p.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {p.type === "city"
                        ? "All airports"
                        : p.city_name || p.city?.name || "Airport"}
                    </span>
                  </span>
                  <span className="text-xs font-bold text-[#2D3199]">
                    {p.iata_code}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
        <div className="rounded-b-2xl border-t bg-slate-50 px-4 py-3 text-[11px] text-slate-500">
          Choose a popular destination or search worldwide.
        </div>
      </SearchPopoverContent>
    </Popover>
  );
}

export function StayDestinationPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={searchField}>
          <Building2 size={21} className="text-[#2D3199]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-slate-500">
              Where are you staying?
            </span>
            <span className="block truncate text-[15px] font-bold">
              {destinations[Number(value)]?.name || "Choose a destination"}
            </span>
            <span className="text-[10px] text-slate-500">
              Explore our destinations
            </span>
          </span>
          <ChevronDown size={15} />
        </button>
      </PopoverTrigger>
      <SearchPopoverContent
        align="start"
        collisionPadding={12}
        className={`${panel} w-[min(440px,calc(100vw-24px))]`}
      >
        <div className="border-b p-4">
          <h3 className="mb-3 font-bold">Choose your destination</h3>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search hotel destinations"
            placeholder="Search a city or country"
            className="w-full rounded-xl border px-3 py-3 text-sm outline-indigo-300"
          />
        </div>
        <div className="grid max-h-80 grid-cols-2 gap-1 overflow-y-auto p-3">
          {destinations
            .map((d, index) => ({ d, index }))
            .filter(({ d }) =>
              d.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map(({ d, index }) => (
              <button
                type="button"
                key={d.name}
                onClick={() => {
                  onChange(String(index));
                  setOpen(false);
                }}
                className={`rounded-xl p-3 text-left text-sm hover:bg-indigo-50 ${Number(value) === index ? "bg-indigo-50 text-[#2D3199]" : ""}`}
              >
                <span className="block font-semibold">
                  {d.name.split(",")[0]}
                </span>
                <span className="text-xs text-slate-500">
                  {d.name.split(",").slice(1).join(",")}
                </span>
              </button>
            ))}
        </div>
      </SearchPopoverContent>
    </Popover>
  );
}

export function DatePicker({
  departure,
  returnDate,
  range,
  hotel,
  onChange,
}: {
  departure: string;
  returnDate: string;
  range: boolean;
  hotel: boolean;
  onChange: (departure: string, returnDate: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [selecting, setSelecting] = useState<"departure" | "return">("departure"),
    [wide, setWide] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const format = (value: string) =>
    readDate(value)?.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }) || "Select date";
  const first = readDate(departure),
    last = readDate(returnDate);
  const selected = [first, ...(range ? [last] : [])].filter(Boolean) as Date[];
  function select(date: Date | undefined) {
    if (!date) return;
    const value = dateKey(date);
    if (selecting === "departure" || !range) {
      onChange(
        value,
        returnDate && (hotel ? returnDate <= value : returnDate < value)
          ? ""
          : returnDate,
      );
      if (range) setSelecting("return");
      else setOpen(false);
    } else {
      onChange(departure, value);
      setOpen(false);
    }
  }
  const rangeLabels = hotel
    ? ["Check-in", "Check-out"]
    : ["Departure", "Return"];
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next)
          setSelecting(
            departure && range && !returnDate ? "return" : "departure",
          );
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${searchField} scroll-mt-24`}
          aria-label={`${rangeLabels[0]}${range ? ` and ${rangeLabels[1]}` : ""} dates`}
        >
          <CalendarDays size={20} className="shrink-0 text-[#2D3199]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-slate-500">
              {range ? `${rangeLabels[0]} — ${rangeLabels[1]}` : rangeLabels[0]}
            </span>
            <span className="block text-[14px] font-bold">
              {format(departure)}
              {range && (
                <>
                  <span className="px-1 text-slate-300">—</span>
                  {format(returnDate)}
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-500">
              {range
                ? "Choose your travel dates"
                : "Choose your departure date"}
            </span>
          </span>
          <ChevronDown size={14} className="shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <SearchPopoverContent
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className={`${panel} w-auto max-w-[calc(100vw-24px)]`}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <h3 className="font-bold">
              {selecting === "return"
                ? `Select ${rangeLabels[1].toLowerCase()}`
                : `Select ${rangeLabels[0].toLowerCase()}`}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Pick a date on the calendar
            </p>
          </div>
          <ClosePanel close={() => setOpen(false)} />
        </div>
        {range && (
          <div className="grid grid-cols-2 gap-2 px-4 pt-3">
            {(["departure", "return"] as const).map((part, i) => (
              <button
                type="button"
                key={part}
                disabled={part === "return" && !departure}
                onClick={() => setSelecting(part)}
                className={`rounded-xl border px-3 py-2 text-left ${selecting === part ? "border-[#2D3199] bg-indigo-50 text-[#2D3199]" : "border-slate-100"}`}
              >
                <span className="block text-[10px]">{rangeLabels[i]}</span>
                <span className="text-xs font-bold">
                  {format(i ? returnDate : departure)}
                </span>
              </button>
            ))}
          </div>
        )}
        <Suspense
          fallback={
            <div
              role="status"
              className="flex h-80 items-center justify-center p-8 text-sm text-slate-500"
            >
              Loading calendar…
            </div>
          }
        >
          <Calendar
            mode="single"
            selected={selecting === "return" ? last : first}
            onSelect={select}
            defaultMonth={first || today}
            numberOfMonths={wide ? 2 : 1}
            disabled={(date) =>
              date < today ||
              (selecting === "return" &&
                !!first &&
                (hotel
                  ? dateKey(date) <= departure
                  : dateKey(date) < departure))
            }
            modifiers={{
              between: (date) =>
                !!first && !!last && date > first && date < last,
              endpoint: selected,
            }}
            modifiersClassNames={{
              between: "bg-indigo-50",
              endpoint: "bg-indigo-100 text-[#2D3199] font-bold rounded-md",
            }}
            className="p-4 [--cell-size:2.5rem]"
          />
        </Suspense>
        <div className="flex items-center justify-between gap-4 border-t px-4 py-3">
          <span className="text-[11px] text-slate-500">
            {hotel
              ? "Stay dates are local to the property."
              : "Flight times are local to each airport."}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-[#2D3199] px-4 py-2 text-sm font-bold text-white"
          >
            Done
          </button>
        </div>
      </SearchPopoverContent>
    </Popover>
  );
}

function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-1 text-[11px] text-slate-500">{hint}</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label={`Remove ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="rounded-full border border-indigo-200 p-1.5 text-[#2D3199] disabled:border-slate-200 disabled:text-slate-300"
        >
          <Minus size={15} />
        </button>
        <span className="w-4 text-center text-sm font-bold" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Add ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="rounded-full border border-indigo-200 p-1.5 text-[#2D3199] disabled:border-slate-200 disabled:text-slate-300"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
export function TravellerPicker({
  kind,
  adults,
  ages,
  rooms,
  cabin,
  onChange,
}: {
  kind: "flight" | "hotel";
  adults: number;
  ages: number[];
  rooms: number;
  cabin: string;
  onChange: (value: {
    adults: number;
    ages: number[];
    rooms: number;
    cabin: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const hotel = kind === "hotel";
  const update = (
    patch: Partial<{
      adults: number;
      ages: number[];
      rooms: number;
      cabin: string;
    }>,
  ) => onChange({ adults, ages, rooms, cabin, ...patch });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={searchField}
          aria-label="Travellers and trip details"
        >
          <Users size={20} className="shrink-0 text-[#2D3199]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-slate-500">
              {hotel ? "Guests & rooms" : "Travellers & cabin"}
            </span>
            <span className="block truncate text-[14px] font-bold">
              {adults} adult{adults !== 1 ? "s" : ""}
              {ages.length
                ? `, ${ages.length} child${ages.length > 1 ? "ren" : ""}`
                : ""}
            </span>
            <span className="text-[10px] text-slate-500">
              {hotel
                ? `${rooms} room${rooms > 1 ? "s" : ""}`
                : cabinNames[cabin]}
            </span>
          </span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </PopoverTrigger>
      <SearchPopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className={`${panel} w-[min(380px,calc(100vw-24px))]`}
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-bold">
            {hotel ? "Guests & rooms" : "Who’s travelling?"}
          </h3>
          <ClosePanel close={() => setOpen(false)} />
        </div>
        <div className="max-h-[65dvh] overflow-y-auto px-5">
          <Counter
            label="Adults"
            hint={hotel ? "18 years and above" : "12 years and above"}
            value={adults}
            min={1}
            max={hotel ? 9 : 9 - ages.length}
            onChange={(n) => update({ adults: n, rooms: Math.min(rooms, n) })}
          />
          <Counter
            label="Children"
            hint={
              hotel ? "0–17 years at check-in" : "2–11 years at time of travel"
            }
            value={ages.length}
            min={0}
            max={hotel ? 8 : 9 - adults}
            onChange={(n) =>
              update({
                ages:
                  n > ages.length ? [...ages, hotel ? 0 : 2] : ages.slice(0, n),
              })
            }
          />
          {ages.length > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
              {ages.map((age, i) => (
                <label key={i} className="text-[11px] text-slate-600">
                  Child {i + 1} age
                  <select
                    className="mt-1 w-full rounded-lg border bg-white p-2 text-sm text-slate-900"
                    value={age}
                    onChange={(e) =>
                      update({
                        ages: ages.map((n, j) =>
                          j === i ? Number(e.target.value) : n,
                        ),
                      })
                    }
                  >
                    {Array.from(
                      { length: hotel ? 18 : 10 },
                      (_, n) => n + (hotel ? 0 : 2),
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} year{n === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          {hotel ? (
            <Counter
              label="Rooms"
              hint="At least one adult per room"
              value={rooms}
              min={1}
              max={Math.min(8, adults)}
              onChange={(n) => update({ rooms: n })}
            />
          ) : (
            <>
              <p className="mb-4 rounded-xl bg-indigo-50 p-3 text-[11px] leading-relaxed text-[#2D3199]">
                Travelling with an infant under 2? Contact our team to arrange
                your booking.
              </p>
              <label className="mb-4 block text-xs font-semibold">
                Cabin class
                <select
                  value={cabin}
                  onChange={(e) => update({ cabin: e.target.value })}
                  className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm"
                >
                  {Object.entries(cabinNames).map(([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <div className="border-t p-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={`${travelButton} w-full`}
          >
            Done
          </button>
        </div>
      </SearchPopoverContent>
    </Popover>
  );
}
