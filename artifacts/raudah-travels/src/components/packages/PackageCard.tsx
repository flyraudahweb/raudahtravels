import { Link } from "wouter";
import { useUser } from "@clerk/react";
import type { TravelPackage } from "@workspace/api-client-react";
import { CalendarDays, MapPin, Plane, Star, Check, Eye } from "lucide-react";
import { PackageAvailability } from "@/components/PackageAvailability";
import { CountdownBanner } from "@/components/CountdownBanner";
import {
  getPackageImage,
  packageBookingHref,
  packageTypeLabels,
} from "@/lib/packagePresentation";

export default function PackageCard({
  pkg,
  detailed = false,
}: {
  pkg: TravelPackage;
  detailed?: boolean;
}) {
  const { isSignedIn } = useUser();
  const spaces = Math.max(0, pkg.maxCapacity - pkg.currentBookings);
  const closed = pkg.isRegistrationClosed || spaces === 0;
  return (
    <article className="flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-[#2D3199]/40 sm:p-5">
      <Link
        href={`/packages/${pkg.id}`}
        className="relative block overflow-hidden rounded-xl bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] focus-visible:ring-offset-4"
        aria-label={`View ${pkg.name}`}
      >
        <img
          src={getPackageImage(pkg.id, pkg.imageUrl)}
          alt={pkg.name}
          loading="lazy"
          className="aspect-[16/10] w-full object-cover"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2D3199]">
          {packageTypeLabels[pkg.type] ?? pkg.type}
        </span>
      </Link>
      <div className="flex flex-1 flex-col pt-5">
        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Star size={16} className="text-[#2D3199]" aria-hidden="true" />
            {pkg.starRating} Star
          </span>
          <span className="capitalize">{pkg.category}</span>
          {pkg.season && <span>{pkg.season}</span>}
        </div>
        <h3 className="text-xl font-bold leading-snug text-slate-900">
          <Link
            href={`/packages/${pkg.id}`}
            className="rounded hover:text-[#2D3199] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199]"
          >
            {pkg.name}
          </Link>
        </h3>
        {pkg.countdownEnabled && pkg.countdownExpiry && (
          <div className="mt-4">
            <CountdownBanner
              expiry={pkg.countdownExpiry}
              variant="card"
              onExpired={
                pkg.countdownAction === "both" ? "show-closed" : "hide"
              }
            />
          </div>
        )}
        <div className="mt-4 space-y-2 text-sm text-[#2D3199]">
          <p className="flex items-center gap-2">
            <CalendarDays size={17} aria-hidden="true" />
            {pkg.durationDays} Days
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={17} aria-hidden="true" />
            {detailed ? "Makkah + Madinah" : "Makkah"}
          </p>
          <p className="flex items-start gap-2 text-slate-600">
            <CalendarDays
              size={17}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />
            <span>
              Departure ·{" "}
              {new Date(pkg.departureDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </p>
        </div>
        <details className="my-5 border-y border-slate-100 py-1">
          <summary className="cursor-pointer py-3 text-sm font-medium text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199]">
            Package details · {spaces} spaces
          </summary>
          {detailed && (
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {pkg.airlines.length > 0 && (
                <p className="flex items-start gap-2">
                  <Plane
                    size={16}
                    className="mt-0.5 shrink-0 text-[#2D3199]"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium">Airline: </span>
                    {pkg.airlines.join(", ")}
                  </span>
                </p>
              )}
              {pkg.departureCities.length > 0 && (
                <p>
                  <span className="font-medium">Departs From: </span>
                  {pkg.departureCities.join(", ")}
                </p>
              )}
            </div>
          )}
          <ul className="my-5 space-y-2 text-sm text-slate-600">
            {pkg.inclusions.slice(0, 3).map((inc, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check
                  size={16}
                  className="mt-0.5 shrink-0 text-[#2D3199]"
                  aria-hidden="true"
                />
                <span>{inc}</span>
              </li>
            ))}
            {pkg.inclusions.length > 3 && (
              <li className="pl-6 text-xs text-slate-500">
                +{pkg.inclusions.length - 3} more inclusions
              </li>
            )}
          </ul>
          <PackageAvailability
            maxCapacity={pkg.maxCapacity}
            currentBookings={pkg.currentBookings}
            className="mb-4"
          />
        </details>
        <div className="mt-auto">
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-500">Starting From</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                ₦{pkg.price.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">per person</span>
            </p>
            {detailed && pkg.agentDiscount > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Agent: ₦{(pkg.price - pkg.agentDiscount).toLocaleString()}
              </p>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Link
              href={`/packages/${pkg.id}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 px-2 py-2.5 text-sm font-semibold text-slate-700 hover:border-[#2D3199] hover:text-[#2D3199] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199]"
            >
              <Eye size={17} aria-hidden="true" />
              View Details
            </Link>
            {closed ? (
              <button
                disabled
                className="min-h-11 rounded-lg bg-slate-100 px-2 text-sm font-semibold text-slate-500"
              >
                {pkg.isRegistrationClosed ? "Registration Closed" : "Sold Out"}
              </button>
            ) : (
              <Link
                href={packageBookingHref(pkg.id, !!isSignedIn)}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#2D3199] px-2 py-2.5 text-sm font-semibold text-white hover:bg-[#25297F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] focus-visible:ring-offset-2"
              >
                Book Now
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
