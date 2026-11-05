import { Link } from "wouter";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Plane,
  Smartphone,
} from "lucide-react";
import aircraft from "@/assets/images/hero-aircraft.jpg";

export default function AppSection() {
  return (
    <section
      aria-labelledby="raudah-app-heading"
      className="bg-white py-16 md:py-24"
    >
      <div className="mx-auto grid max-w-7xl gap-6 px-4 md:px-8 lg:grid-cols-2">
        <div className="relative isolate min-h-[430px] overflow-hidden rounded-2xl bg-[#1C1F66] p-7 pb-96 text-white sm:p-10 sm:pb-64">
          <div className="relative z-10 max-w-sm">
            <span className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-white/80">
              <Smartphone size={18} aria-hidden="true" />
              Raudah on the go
            </span>
            <h2
              id="raudah-app-heading"
              className="text-3xl font-bold leading-tight text-white sm:text-4xl"
            >
              Your journey, always within reach.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/80">
              Search flights, explore hotels and discover Hajj &amp; Umrah
              packages in one simple place.
            </p>
            <Link
              href="/app"
              className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-lg bg-white px-5 py-3 font-semibold text-[#2D3199] hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#1C1F66]"
            >
              Open Raudah App
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-20 right-7 w-[210px] rotate-[8deg] rounded-[32px] border-[7px] border-slate-900 bg-slate-50 p-3 sm:right-12 sm:w-[235px]"
          >
            <div className="mx-auto mb-4 h-4 w-20 rounded-full bg-slate-900" />
            <p className="mb-3 text-lg font-bold text-[#2D3199]">
              raudah<span className="text-[#FF4E00]">.</span>
            </p>
            <img
              src={aircraft}
              alt=""
              className="h-24 w-full rounded-xl object-cover"
            />
            <p className="mb-3 mt-4 text-base font-bold text-slate-900">
              Where to next?
            </p>
            {(
              [
                [Plane, "Flights"],
                [Building2, "Hotels"],
                [CheckCircle2, "My trips"],
              ] as const
            ).map(([PreviewIcon, label]) => {
              return (
                <div
                  key={String(label)}
                  className="mb-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700"
                >
                  <PreviewIcon size={16} className="text-[#2D3199]" />
                  {String(label)}
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Fly your way",
              text: "Compare itineraries, baggage and fare conditions before you book.",
              href: "/flights",
              cta: "Explore flights",
              icon: Plane,
            },
            {
              title: "Stay somewhere special",
              text: "Choose available rooms with clear pricing and cancellation policies.",
              href: "/hotels",
              cta: "Discover hotels",
              icon: Building2,
            },
            {
              title: "Every journey, together",
              text: "Return to saved checkouts, view supplier confirmations and request support.",
              href: "/dashboard/my-trips",
              cta: "Open my trips",
              icon: CheckCircle2,
            },
          ].map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group rounded-2xl bg-[#F8FAFC] p-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D3199] ${index === 0 ? "sm:col-span-2" : ""}`}
            >
              <item.icon
                size={28}
                className="mb-6 text-[#2D3199]"
                aria-hidden="true"
              />
              <h3 className="text-xl font-bold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.text}
              </p>
              <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2D3199]">
                {item.cta}
                <ArrowRight size={16} aria-hidden="true" />
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
