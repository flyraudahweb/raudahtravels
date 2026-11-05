import {
  useGetPackage,
  getGetPackageQueryKey,
} from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { useUser } from "@clerk/react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  MapPin,
  Star,
  Check,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { PackageAvailability } from "@/components/PackageAvailability";

import { getPackageImage, packageBookingHref } from "@/lib/packagePresentation";

export default function PackageDetail() {
  const [, params] = useRoute("/packages/:id");
  const packageId = params?.id || "";
  const { isSignedIn } = useUser();

  const {
    data: pkg,
    isLoading,
    error,
  } = useGetPackage(packageId, {
    query: {
      enabled: !!packageId,
      queryKey: getGetPackageQueryKey(packageId),
    },
  });

  if (isLoading)
    return (
      <div className="min-h-[100dvh] flex flex-col bg-white">
        <Navbar />
        <main className="flex-1 container mx-auto p-8 pt-28">
          <div className="h-96 animate-pulse bg-muted rounded-xl" />
        </main>
        <Footer />
      </div>
    );

  if (error || !pkg)
    return (
      <div className="min-h-[100dvh] flex flex-col bg-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-8 pt-32">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-[#0F172A] mb-4">
              Package Not Found
            </h1>
            <p className="text-[#64748B] mb-8">
              The package you are looking for does not exist or may have been
              removed.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-[#2D3199] hover:bg-[#25297F] text-white rounded-full shadow-brand px-8"
            >
              <Link href="/packages">View All Packages</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );

  const spacesAvailable = pkg.maxCapacity - pkg.currentBookings;
  const closed = pkg.isRegistrationClosed || spacesAvailable <= 0;
  const bookingHref = packageBookingHref(pkg.id, !!isSignedIn);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white">
      <Navbar />

      <main className="flex-1">
        <header className="bg-[#F8F9FF] pb-9 pt-24 md:pt-32">
          <div className="mx-auto max-w-7xl px-4 md:px-8">
            <Link
              href="/packages"
              className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#2D3199]"
            >
              <ArrowLeft size={17} />
              All Packages
            </Link>
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <span className="mb-3 inline-flex rounded-full bg-[#EEF0FF] px-3 py-1.5 text-sm font-medium capitalize text-[#2D3199]">
                  {pkg.type}
                </span>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 md:text-4xl">
                  {pkg.name}
                </h1>
                <div className="mt-4 flex flex-wrap gap-5 text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <Star size={17} className="text-[#2D3199]" />
                    {pkg.starRating} Star
                  </span>
                  <span className="flex items-center gap-2">
                    <CalendarDays size={17} className="text-[#2D3199]" />
                    {pkg.durationDays} Days
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin size={17} className="text-[#2D3199]" />
                    Mecca &amp; Medina
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                <p className="text-sm text-slate-500">Total Price</p>
                <p className="mt-1 text-3xl font-bold text-[#2D3199]">
                  ₦{pkg.price.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 pt-8 md:px-8 md:pt-10">
          <img
            src={getPackageImage(pkg.id, pkg.imageUrl)}
            alt={pkg.name}
            className="max-h-[460px] w-full rounded-2xl object-cover aspect-[16/9] md:aspect-[16/6]"
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 py-10 pb-28 md:px-8 lg:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
            <div className="lg:col-span-2 space-y-12">
              {/* Description */}
              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-5">
                  About This Package
                </h2>
                <div className="max-w-none leading-relaxed text-slate-600 whitespace-pre-wrap">
                  {pkg.description}
                </div>
              </section>

              {/* Inclusions */}
              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-5">
                  What's Included
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pkg.inclusions.map((inc, i) => (
                    <div key={i} className="flex items-start">
                      <Check className="w-5 h-5 text-[#2D3199] mr-3 shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{inc}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Itinerary / Dates */}
              <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-5">
                  Schedule
                </h2>
                <div className="flex flex-col md:flex-row gap-6">
                  <Card className="flex-1 bg-muted/50 border-none">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CalendarDays className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Departure
                      </div>
                      <div className="font-bold text-lg">
                        {new Date(pkg.departureDate).toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="flex-1 bg-muted/50 border-none">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CalendarDays className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        Return
                      </div>
                      <div className="font-bold text-lg">
                        {new Date(pkg.returnDate).toLocaleDateString(
                          undefined,
                          {
                            weekday: "short",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            </div>

            {/* Booking Sidebar */}
            <aside>
              <Card className="sticky top-28 rounded-2xl border-slate-200 shadow-none">
                <CardContent className="p-6">
                  <div className="mb-6">
                    <div className="text-sm text-muted-foreground mb-1">
                      Total Price
                    </div>
                    <div className="text-4xl font-bold text-primary">
                      ₦{pkg.price.toLocaleString()}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Required Deposit: ₦{pkg.depositAmount.toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">
                        {pkg.durationDays} Days
                      </span>
                    </div>
                    <div className="py-3 border-b border-border">
                      <PackageAvailability
                        maxCapacity={pkg.maxCapacity}
                        currentBookings={pkg.currentBookings}
                        className="bg-transparent border-none p-0"
                      />
                    </div>
                  </div>

                  {!closed ? (
                    <Button
                      asChild
                      size="lg"
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg"
                    >
                      <Link href={bookingHref}>Book Now</Link>
                    </Button>
                  ) : (
                    <Button disabled size="lg" className="w-full text-lg">
                      {pkg.isRegistrationClosed
                        ? "Registration Closed"
                        : "Sold Out"}
                    </Button>
                  )}

                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Need help? Contact us on WhatsApp for assistance.
                  </p>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
      <div
        aria-label="Package booking"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Total Price</p>
          <p className="text-xl font-bold text-[#2D3199]">
            ₦{pkg.price.toLocaleString()}
          </p>
        </div>
        {closed ? (
          <Button disabled>
            {pkg.isRegistrationClosed ? "Registration Closed" : "Sold Out"}
          </Button>
        ) : (
          <Button
            asChild
            className="min-h-12 rounded-lg bg-[#FF4E00] px-6 text-white hover:bg-[#D63200]"
          >
            <Link href={bookingHref}>Book Now</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
