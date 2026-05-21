import { useListPackages, getListPackagesQueryKey, useGetAgentPackageDiscounts, getGetAgentPackageDiscountsQueryKey, useGetAgentProfile, getGetAgentProfileQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, Star, Check, Tag, Percent, DollarSign, ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownBanner } from "@/components/CountdownBanner";
import { PackageAvailability } from "@/components/PackageAvailability";



export default function AgentPackages() {
  const { data, isLoading } = useListPackages({ available: true }, { query: { queryKey: getListPackagesQueryKey({ available: true }) } });
  const { data: discountData } = useGetAgentPackageDiscounts({ query: { queryKey: getGetAgentPackageDiscountsQueryKey() } });
  const { data: agentProfile } = useGetAgentProfile({ query: { queryKey: getGetAgentProfileQueryKey() } });

  const packages = data?.packages || [];
  const discounts = discountData?.discounts || [];
  const commissionRate = discountData?.commissionRate || agentProfile?.commissionRate || 0;
  const commissionType = discountData?.commissionType || agentProfile?.commissionType || "percentage";
  const discountMap = Object.fromEntries(discounts.map(d => [d.packageId, d]));

  return (
    <div className="space-y-6" data-testid="page-agent-packages">
      {/* Header */}
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#2D3199]/60 mb-1">AGENT PORTAL</p>
        <h1 className="text-3xl font-black text-[#1C1F66] tracking-tight">Available Packages</h1>
        <p className="text-[#64748B] text-sm mt-1">Browse and book packages for your clients</p>
      </div>

      {/* Commission banner */}
      {commissionRate > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2D3199] to-[#4C56B8] p-5 text-white shadow-lg">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="absolute -bottom-8 right-16 w-32 h-32 rounded-full bg-white/5" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              {commissionType === "percentage" ? <Percent className="w-6 h-6 text-white" /> : <DollarSign className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1">
              <p className="font-black text-white text-sm">Your Default Commission Rate</p>
              <p className="text-white/70 text-xs mt-0.5">
                You earn {commissionType === "percentage" ? `${commissionRate}%` : `₦${commissionRate.toLocaleString()}`} on every booking.
                Individual package earnings are highlighted below.
              </p>
            </div>
            <div className="shrink-0">
              <p className="text-3xl font-black text-white">
                {commissionType === "percentage" ? `${commissionRate}%` : `₦${Number(commissionRate).toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-[#CBD5E1]" />
          </div>
          <p className="font-black text-[#94A3B8] text-base">No packages available</p>
          <p className="text-sm text-[#CBD5E1] mt-1">Check back soon for new Hajj and Umrah packages.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {packages.map(pkg => {
            const packageDiscount = discountMap[pkg.id];

            // BUG FIX #13: Separate commission (display-only) from discount (actual price reduction).
            // Only per-package discounts affect pricing. commissionRate is informational only.
            const hasSpecialDiscount = !!packageDiscount;

            // Calculate actual discount (only from per-package discounts)
            let discountAmount = 0;
            if (packageDiscount) {
              if (packageDiscount.discountType === "percentage") {
                discountAmount = pkg.price * packageDiscount.discountValue / 100;
              } else {
                discountAmount = packageDiscount.discountValue;
              }
            }
            const remittancePrice = pkg.price - discountAmount;

            // Commission is display-only — how much the agent earns per booking
            const hasCommission = commissionRate > 0;
            const commissionEarnings = commissionType === "percentage"
              ? pkg.price * commissionRate / 100
              : commissionRate;

            const spotsLeft = pkg.maxCapacity - pkg.currentBookings;
            const fillPct = Math.round((pkg.currentBookings / pkg.maxCapacity) * 100);
            const isAlmostFull = fillPct >= 80;

            return (
              <div key={pkg.id} data-testid={`card-package-${pkg.id}`}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col ${
                  hasSpecialDiscount ? "border-emerald-300 ring-2 ring-emerald-100" : "border-[#E2E8F0] hover:border-[#2D3199]/20"
                }`}>
                {/* Top ribbon */}
                {hasSpecialDiscount ? (
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 flex items-center gap-2">
                    <Tag className="w-3 h-3" /> Special discount applied to your account
                  </div>
                ) : isAlmostFull ? (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 flex items-center gap-2">
                    <Sparkles className="w-3 h-3" /> Almost full — {spotsLeft} spots left
                  </div>
                ) : null}

                <div className="p-5 flex-1 flex flex-col">
                  {/* Package header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full mb-2 ${
                        pkg.type === "hajj" ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-orange-50 text-orange-700"
                      }`}>
                        {pkg.type}
                      </span>
                      <h3 className="font-black text-[#1C1F66] text-base leading-tight">{pkg.name}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <Star className="w-4 h-4 text-[#FF3B00] fill-[#FF3B00]" />
                      <span className="font-black text-[#1C1F66] text-sm">{pkg.starRating}</span>
                    </div>
                  </div>

                  {/* Countdown */}
                  {pkg.countdownEnabled && pkg.countdownExpiry && (
                    <div className="mb-4">
                      <CountdownBanner expiry={pkg.countdownExpiry} variant="card"
                        onExpired={pkg.countdownAction === "both" ? "show-closed" : "hide"} />
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-4 text-xs text-[#64748B] mb-4">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-[#94A3B8]" />
                      {pkg.durationDays} Days · {new Date(pkg.departureDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>

                  {/* Capacity bar */}
                  <PackageAvailability
                    maxCapacity={pkg.maxCapacity}
                    currentBookings={pkg.currentBookings}
                    className="mb-4"
                  />

                  {/* Inclusions */}
                  {pkg.inclusions.length > 0 && (
                    <div className="space-y-1 mb-4 flex-1">
                      {pkg.inclusions.slice(0, 3).map((inc, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-[#64748B]">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{inc}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="pt-4 border-t border-[#F1F5F9] mt-auto space-y-3">
                    {/* Full client price — always shown as primary */}
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest mb-0.5">Client Price</p>
                        <p className="text-2xl font-black text-[#1C1F66]">₦{pkg.price.toLocaleString()}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">per person (full price)</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-[#94A3B8] font-semibold">Deposit</p>
                        <p className="font-black text-[#FF3B00] text-base">₦{pkg.depositAmount.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Agent discount block — only shown when a real per-package discount exists */}
                    {hasSpecialDiscount && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Tag className="w-3 h-3 text-emerald-600 shrink-0" />
                            <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                              Your Discount
                            </p>
                          </div>
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                            {packageDiscount.discountType === "percentage" ? `${packageDiscount.discountValue}%` : `₦${Number(packageDiscount.discountValue).toLocaleString()}`} off
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] text-emerald-700 font-semibold">Your remittance price</p>
                            <p className="text-base font-black text-emerald-800">₦{remittancePrice.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-emerald-700 font-semibold">You save</p>
                            <div className="flex items-center gap-1 justify-end">
                              <TrendingUp className="w-3 h-3 text-emerald-600" />
                              <p className="text-base font-black text-emerald-700">₦{discountAmount.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Commission info — display-only, does NOT affect pricing */}
                    {hasCommission && !hasSpecialDiscount && (
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3 text-[#2D3199] shrink-0" />
                            <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest">Commission Earnings</p>
                          </div>
                          <span className="text-[10px] font-black text-[#2D3199] bg-[#EEF0FF] px-2 py-0.5 rounded-full">
                            ₦{commissionEarnings.toLocaleString()} per booking
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="px-5 pb-5 flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl border-[#E2E8F0] text-[#64748B] hover:border-[#2D3199] hover:text-[#2D3199] font-black text-xs">
                    <Link href={`/packages/${pkg.id}`}>View Details</Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1 bg-gradient-to-r from-[#2D3199] to-[#4C56B8] hover:from-[#252880] hover:to-[#3D4699] rounded-xl font-black text-xs text-white shadow-md">
                    <Link href={`/agent/clients?packageId=${pkg.id}`}>
                      Book for Client <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
