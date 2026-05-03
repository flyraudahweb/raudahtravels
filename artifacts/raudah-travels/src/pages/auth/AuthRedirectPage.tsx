import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";

const ROLE_DESTINATIONS: Record<string, string> = {
  admin:       "/admin",
  super_admin: "/admin",
  staff:       "/admin",
  agent:       "/agent",
  user:        "/dashboard",
  pilgrim:     "/dashboard",
};

async function fetchRole(retries = 10, delayMs = 500): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch("/api/auth/profile", { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        if (data.role) return data.role as string;
      } else if (r.status === 404) {
        // Profile not yet synced — wait and retry
      }
    } catch {
      // Network error — retry
    }
    if (i < retries - 1) await new Promise(res => setTimeout(res, delayMs));
  }
  return "user";
}

export default function AuthRedirectPage() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useUser();
  const started = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { setLocation("/sign-in", { replace: true }); return; }
    if (started.current) return;
    started.current = true;

    fetchRole().then(role => {
      const dest = ROLE_DESTINATIONS[role] ?? "/dashboard";
      setLocation(dest, { replace: true });
    });
  }, [isLoaded, isSignedIn]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F8F9FF] gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-[#2D3199]/20 border-t-[#2D3199] animate-spin" />
      <p className="text-sm font-semibold text-[#64748B]">Signing you in…</p>
    </div>
  );
}
