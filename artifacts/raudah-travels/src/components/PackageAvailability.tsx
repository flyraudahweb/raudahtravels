import React from "react";

interface PackageAvailabilityProps {
  maxCapacity: number;
  currentBookings: number;
  className?: string;
}

export function PackageAvailability({ maxCapacity, currentBookings, className = "" }: PackageAvailabilityProps) {
  const spacesLeft = Math.max(0, maxCapacity - currentBookings);
  const fillPct = maxCapacity > 0 ? Math.min(100, Math.round((currentBookings / maxCapacity) * 100)) : 0;

  return (
    <div className={`bg-[#F4FBFA] border border-[#D1FAE5] rounded-xl p-3.5 ${className}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-black text-[#475569] uppercase tracking-widest">Availability</span>
        <span className="text-xs font-bold text-[#065F46] flex items-center gap-1">
          🪑 {spacesLeft} spots left
        </span>
      </div>
      <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden mb-2 relative">
        <div 
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 bg-[#10B981]" 
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <p className="text-[10px] text-[#64748B] font-medium">
        {currentBookings} of {maxCapacity} seats booked
      </p>
    </div>
  );
}
