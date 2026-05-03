import { useGetPackage, getGetPackageQueryKey } from "@workspace/api-client-react";
import { Link, useRoute } from "wouter";
import { useUser } from "@clerk/react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, MapPin, Star, Check, AlertCircle, ArrowLeft } from "lucide-react";

const PACKAGE_IMAGES = [
  "https://images.pexels.com/photos/28209449/pexels-photo-28209449.jpeg",
  "https://images.pexels.com/photos/26436662/pexels-photo-26436662.jpeg",
  "https://images.pexels.com/photos/34246939/pexels-photo-34246939.jpeg",
  "https://images.pexels.com/photos/29676866/pexels-photo-29676866.jpeg",
];

export default function PackageDetail() {
  const [, params] = useRoute("/packages/:id");
  const packageId = params?.id || "";
  const { isSignedIn } = useUser();

  const { data: pkg, isLoading, error } = useGetPackage(packageId, {
    query: {
      enabled: !!packageId,
      queryKey: getGetPackageQueryKey(packageId)
    }
  });

  if (isLoading) return <div className="min-h-[100dvh] flex flex-col bg-background"><Navbar /><main className="flex-1 container mx-auto p-8"><div className="h-96 animate-pulse bg-muted rounded-xl" /></main><Footer /></div>;

  if (error || !pkg) return <div className="min-h-[100dvh] flex flex-col bg-background"><Navbar /><main className="flex-1 container mx-auto p-8 text-center text-red-500"><AlertCircle className="w-12 h-12 mx-auto mb-4" />Package not found or error loading details.</main><Footer /></div>;

  const spacesAvailable = pkg.maxCapacity - pkg.currentBookings;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1">
        {/* Header Hero */}
        {(() => {
          const imgIdx = packageId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % PACKAGE_IMAGES.length;
          const heroImg = pkg.imageUrl || PACKAGE_IMAGES[imgIdx];
          return (
            <div className="h-72 md:h-[480px] relative overflow-hidden bg-[#1C1F66]">
              <img src={heroImg} alt={pkg.name} className="absolute inset-0 w-full h-full object-cover" />
              {/* Gradient: dark indigo at bottom fading upward */}
              <div className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(28,31,102,0.97) 0%, rgba(28,31,102,0.65) 45%, rgba(28,31,102,0.25) 100%)" }} />
              {/* Back link */}
              <div className="absolute top-6 left-0 right-0 container mx-auto px-4">
                <Link href="/packages"
                  className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold transition-colors">
                  <ArrowLeft className="w-4 h-4" /> All Packages
                </Link>
              </div>
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 container mx-auto px-4 pb-8 md:pb-10">
                <span className="inline-block px-3 py-1 bg-[#FF3B00] text-white text-xs font-bold uppercase rounded-full mb-4 tracking-wider">
                  {pkg.type}
                </span>
                <h1 className="text-3xl md:text-5xl font-black text-white mb-3 leading-tight">{pkg.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
                  <div className="flex items-center gap-1.5"><Star className="w-4 h-4 text-[#FF3B00] fill-current" /> {pkg.starRating} Star</div>
                  <span className="text-white/30">|</span>
                  <div className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> {pkg.durationDays} Days</div>
                  <span className="text-white/30">|</span>
                  <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Mecca &amp; Medina</div>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12">
              {/* Description */}
              <section>
                <h2 className="text-2xl font-serif font-bold text-primary mb-4">About This Package</h2>
                <div className="prose max-w-none text-muted-foreground whitespace-pre-wrap">
                  {pkg.description}
                </div>
              </section>

              {/* Inclusions */}
              <section>
                <h2 className="text-2xl font-serif font-bold text-primary mb-4">What's Included</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pkg.inclusions.map((inc, i) => (
                    <div key={i} className="flex items-start">
                      <Check className="w-5 h-5 text-green-600 mr-3 shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{inc}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Itinerary / Dates */}
              <section>
                <h2 className="text-2xl font-serif font-bold text-primary mb-4">Schedule</h2>
                <div className="flex flex-col md:flex-row gap-6">
                  <Card className="flex-1 bg-muted/50 border-none">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CalendarDays className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">Departure</div>
                      <div className="font-bold text-lg">{new Date(pkg.departureDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </CardContent>
                  </Card>
                  <Card className="flex-1 bg-muted/50 border-none">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CalendarDays className="w-6 h-6 text-primary" />
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">Return</div>
                      <div className="font-bold text-lg">{new Date(pkg.returnDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            </div>

            {/* Booking Sidebar */}
            <aside>
              <Card className="sticky top-24 border-primary/20 shadow-xl">
                <CardContent className="p-6">
                  <div className="mb-6">
                    <div className="text-sm text-muted-foreground mb-1">Total Price</div>
                    <div className="text-4xl font-bold text-primary">₦{pkg.price.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground mt-2">Required Deposit: ₦{pkg.depositAmount.toLocaleString()}</div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{pkg.durationDays} Days</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-border">
                      <span className="text-muted-foreground">Availability</span>
                      <span className={`font-medium ${spacesAvailable < 10 ? 'text-red-500' : 'text-green-600'}`}>
                        {spacesAvailable} spaces left
                      </span>
                    </div>
                  </div>

                  {spacesAvailable > 0 ? (
                    <Button asChild size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg">
                      <Link href={isSignedIn ? `/dashboard/book/${pkg.id}` : `/sign-in?redirect_url=/dashboard/book/${pkg.id}`}>
                        Book Now
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled size="lg" className="w-full text-lg">
                      Sold Out
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
    </div>
  );
}
