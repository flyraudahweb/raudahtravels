import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

type TimeLeft = { days: number; hours: number; mins: number; secs: number } | null;

function calcTimeLeft(expiry: string): TimeLeft {
  const diff = new Date(expiry).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days:  Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    mins:  Math.floor((diff / (1000 * 60)) % 60),
    secs:  Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number) { return String(n).padStart(2, "0"); }

export function RegistrationClosedBanner({ variant = "card" }: { variant?: "card" | "full" | "inline" }) {
  if (variant === "full") {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-5 rounded-2xl font-bold text-sm bg-[#1E293B] text-white">
        <Timer className="w-4 h-4 shrink-0" />
        <span>Registration closed</span>
      </div>
    );
  }
  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
        <Timer className="w-3 h-3" />
        Registration closed
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-600"
         style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)" }}>
      <Timer className="w-3.5 h-3.5 shrink-0" />
      <span>Registration closed</span>
    </div>
  );
}

export function CountdownBanner({
  expiry, variant = "card", onExpired = "hide",
}: {
  expiry: string;
  variant?: "card" | "full" | "inline";
  onExpired?: "hide" | "show-closed";
}) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calcTimeLeft(expiry));

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(calcTimeLeft(expiry)), 1000);
    return () => clearInterval(t);
  }, [expiry]);

  if (!timeLeft) {
    if (onExpired === "show-closed") return <RegistrationClosedBanner variant={variant} />;
    return null;
  }
  const { days, hours, mins, secs } = timeLeft;

  if (variant === "full") {
    return (
      <div className="flex items-center justify-center gap-3 py-3 px-5 rounded-2xl text-white font-bold text-sm"
           style={{ background: "linear-gradient(90deg, #CC2F00, #FF3B00)" }}>
        <Timer className="w-4 h-4 animate-pulse shrink-0" />
        <span>Registration closes in</span>
        <div className="flex items-center gap-1 font-black">
          {days > 0 && <><span>{days}d</span><span className="opacity-40 mx-0.5">:</span></>}
          <span>{pad(hours)}h</span>
          <span className="opacity-40 mx-0.5">:</span>
          <span>{pad(mins)}m</span>
          <span className="opacity-40 mx-0.5">:</span>
          <span>{pad(secs)}s</span>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-[#FF3B00] bg-[#FF3B00]/10 border border-[#FF3B00]/25 px-2.5 py-1 rounded-full">
        <Timer className="w-3 h-3 animate-pulse" />
        {days > 0 ? `${days}d ` : ""}{pad(hours)}:{pad(mins)}:{pad(secs)}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[#FF3B00]"
         style={{ background: "rgba(255,59,0,0.08)", border: "1px solid rgba(255,59,0,0.2)" }}>
      <Timer className="w-3.5 h-3.5 shrink-0 animate-pulse" />
      <span>Closes in</span>
      <span className="font-black tabular-nums">
        {days > 0 ? `${days}d ` : ""}{pad(hours)}:{pad(mins)}:{pad(secs)}
      </span>
    </div>
  );
}
