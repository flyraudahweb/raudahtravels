import { Skeleton } from "@/components/ui/skeleton";

function SingleSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 lg:gap-6">
        <div className="flex-1 flex flex-col justify-center gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
            {/* Airline */}
            <div className="flex items-center gap-3 sm:w-40 lg:w-44 shrink-0">
              <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 sm:h-4 w-20 sm:w-24" />
                <Skeleton className="h-2.5 sm:h-3 w-10 sm:w-12" />
              </div>
            </div>

            {/* Flight path */}
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Skeleton className="h-6 sm:h-7 lg:h-8 w-14 sm:w-16" />
                  <Skeleton className="h-3 sm:h-4 w-8 sm:w-10" />
                </div>
                <div className="flex-1 flex flex-col items-center gap-1 px-2">
                  <Skeleton className="h-2.5 sm:h-3 w-10 sm:w-12" />
                  <Skeleton className="h-[2px] w-full" />
                  <Skeleton className="h-2.5 sm:h-3 w-10" />
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <Skeleton className="h-6 sm:h-7 lg:h-8 w-14 sm:w-16" />
                  <Skeleton className="h-3 sm:h-4 w-8 sm:w-10" />
                </div>
              </div>
            </div>

            {/* Desktop Badges */}
            <div className="hidden xl:flex flex-col gap-1.5 shrink-0 w-24 items-end justify-center">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>

          {/* Mobile Badges */}
          <div className="flex xl:hidden gap-2 mt-3 sm:mt-2 sm:pl-[10.5rem] lg:pl-52">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
        </div>

        <div className="lg:hidden h-[1px] w-full bg-border/60" />
        <div className="hidden lg:block w-[1px] bg-border/60" />

        {/* Meta */}
        <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0 lg:w-44 py-1 lg:py-2">
          <div className="space-y-1.5 w-24">
            <Skeleton className="h-3 sm:h-4 w-16 lg:ml-auto" />
            <Skeleton className="h-5 sm:h-6 lg:h-7 w-24 lg:ml-auto" />
          </div>
          <Skeleton className="h-10 sm:h-12 w-[120px] lg:w-full rounded-xl shrink-0" />
        </div>
      </div>
    </div>
  );
}

export default function FlightCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <SingleSkeleton key={i} />
      ))}
    </div>
  );
}
