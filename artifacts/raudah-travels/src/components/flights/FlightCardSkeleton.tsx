import { Skeleton } from "@/components/ui/skeleton";

function SingleSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Airline */}
        <div className="flex items-center gap-3 lg:w-44 shrink-0">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        {/* Flight path */}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
            <div className="flex-1 flex flex-col items-center gap-1 px-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-[2px] w-full" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-4 w-10" />
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <div className="space-y-1 min-w-[120px]">
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-6 w-24 ml-auto" />
          </div>
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function FlightCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <SingleSkeleton key={i} />
      ))}
    </div>
  );
}
