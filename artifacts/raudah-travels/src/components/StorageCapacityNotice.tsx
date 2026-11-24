import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";

export function StorageCapacityNotice() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { data } = useQuery<{ notice: { title: string; message: string } | null }>({
    queryKey: ["account-storage-notice", sessionId],
    enabled: Boolean(isLoaded && isSignedIn && sessionId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/account/storage-notice", { signal });
      if (!response.ok) throw new Error("Could not load the storage notice");
      return response.json();
    },
  });

  if (!isLoaded || !isSignedIn || !sessionId || !data?.notice) return null;

  return (
    <aside
      role="alert"
      className="fixed bottom-4 left-4 right-4 z-[60] flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-lg sm:right-auto sm:w-96"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div>
        <p className="font-bold">{data.notice.title}</p>
        <p className="mt-1 text-sm leading-relaxed">{data.notice.message}</p>
      </div>
    </aside>
  );
}
