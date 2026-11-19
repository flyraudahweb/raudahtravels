import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import makkah from "@/assets/images/hero-kaaba.png";
import madinah from "@/assets/images/medina-mosque.png";
import { ota } from "@/lib/ota";

const destinations = [
  { city: 0, name: "Makkah", image: makkah, position: "50% 62%" },
  { city: 1, name: "Madinah", image: madinah, position: "50% 50%" },
];
const stayDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
type Availability = {
  checkIn: string;
  checkOut: string;
  destinations: { city: number; count: number | null }[];
};

export default function FeaturedHotelDestinations() {
  const { data } = useQuery({
    queryKey: ["ota", "featured-hotel-destinations"],
    queryFn: ({ signal }) =>
      ota<{ availability: Availability | null }>(
        "/hotels/featured-destinations",
        undefined,
        undefined,
        signal,
      ),
    staleTime: 5 * 60000,
    retry: false,
  });
  const availability = data?.availability;
  const dates =
    availability &&
    [availability.checkIn, availability.checkOut]
      .map((date) => stayDate.format(new Date(date)))
      .join(" – ");
  return (
    <section
      aria-labelledby="featured-hotels-heading"
      className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="featured-hotels-heading"
          className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
        >
          Top hotel destinations
        </h2>
        <Link
          href="/hotels"
          className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[#2D3199] hover:underline"
        >
          All hotels <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        {destinations.map(({ city, name, image, position }) => {
          const count = availability?.destinations.find(
            (result) => result.city === city,
          )?.count;
          const params = new URLSearchParams({ city: String(city) });
          if (availability && count != null && count > 0) {
            params.set("checkIn", availability.checkIn);
            params.set("checkOut", availability.checkOut);
          }
          return (
            <Link
              key={city}
              href={`/hotels/search?${params}`}
              className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 transition-colors hover:border-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <img
                src={image}
                alt=""
                loading="lazy"
                decoding="async"
                style={{ objectPosition: position }}
                className="h-24 w-full object-cover sm:h-36 md:h-44"
              />
              <div className="flex flex-1 items-start justify-between gap-2 p-3 sm:p-4">
                <div>
                  <p className="text-xs font-semibold text-[#2D3199]">
                    {count
                      ? `${count} ${count === 1 ? "hotel" : "hotels"} found`
                      : "Browse stays"}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
                    {name}
                  </h3>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    Saudi Arabia
                  </p>
                </div>
                <ArrowUpRight
                  className="mt-1 shrink-0 text-[#2D3199]"
                  size={17}
                  aria-hidden="true"
                />
              </div>
            </Link>
          );
        })}
      </div>
      {dates && availability?.destinations.some(({ count }) => !!count) && (
        <p className="mt-3 text-xs text-slate-600">
          Hotels found for {dates} · 1 adult, 1 room
        </p>
      )}
    </section>
  );
}
