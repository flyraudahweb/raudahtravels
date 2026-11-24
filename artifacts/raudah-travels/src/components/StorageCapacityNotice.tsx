import { useAuth } from "@clerk/react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const REMINDER_MINUTES = 5;
const REMINDER_DELAY_MS = REMINDER_MINUTES * 60_000;
type StorageNotice = { title: string; message: string };

export function StorageCapacityNotice() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const { data } = useQuery<{ notice: StorageNotice | null }>({
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
  return <StorageNoticeDialog key={sessionId} sessionId={sessionId} notice={data.notice} />;
}

function StorageNoticeDialog({ sessionId, notice }: { sessionId: string; notice: StorageNotice }) {
  const storageKey = `storage-notice-remind-at:${sessionId}`;
  const [remindAt, setRemindAt] = useState(() => {
    try {
      const saved = Number(window.sessionStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved > Date.now()) return saved;
    } catch {
      // The reminder still works when browser storage is unavailable.
    }
    return 0;
  });
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!remindAt) return;
    const timer = window.setTimeout(
      () => setRemindAt(0),
      Math.min(REMINDER_DELAY_MS, Math.max(0, remindAt - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [remindAt]);

  function dismiss() {
    const nextReminder = Date.now() + REMINDER_DELAY_MS;
    setRemindAt(nextReminder);
    try {
      window.sessionStorage.setItem(storageKey, String(nextReminder));
    } catch {
      // The in-memory timer is enough until the page reloads.
    }
  }

  return (
    <AlertDialog
      open={remindAt === 0}
      onOpenChange={(open) => {
        if (!open) dismiss();
      }}
    >
      <AlertDialogContent
        className="w-[calc(100%_-_2rem)] max-w-md rounded-xl border-amber-300 bg-white shadow-2xl"
        onOpenAutoFocus={() => {
          previousFocus.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        }}
        onCloseAutoFocus={() => {
          if (previousFocus.current?.isConnected) {
            previousFocus.current.focus({ preventScroll: true });
          }
        }}
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <TriangleAlert aria-hidden="true" className="h-6 w-6" />
        </div>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-xl text-slate-950">{notice.title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed text-slate-700">
            {notice.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="mt-0 min-h-11">
            Remind me in {REMINDER_MINUTES} minutes
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
