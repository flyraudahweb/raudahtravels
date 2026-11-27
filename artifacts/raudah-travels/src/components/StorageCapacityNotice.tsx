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

const REMINDER_SECONDS = 30;
const REMINDER_DELAY_MS = REMINDER_SECONDS * 1000;
const DISMISS_WAIT_SECONDS = 5;
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

  return remindAt === 0 ? <StorageNoticePopup notice={notice} onDismiss={dismiss} /> : null;
}

function StorageNoticePopup({ notice, onDismiss }: { notice: StorageNotice; onDismiss: () => void }) {
  const [dismissAt] = useState(() => Date.now() + DISMISS_WAIT_SECONDS * 1000);
  const [secondsLeft, setSecondsLeft] = useState(DISMISS_WAIT_SECONDS);
  const previousFocus = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((dismissAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [dismissAt]);

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && Date.now() >= dismissAt) onDismiss();
      }}
    >
      <AlertDialogContent
        ref={contentRef}
        tabIndex={-1}
        className="max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-2xl gap-6 overflow-y-auto rounded-2xl border-amber-300 bg-white p-7 shadow-2xl sm:gap-8 sm:p-10"
        onEscapeKeyDown={(event) => {
          if (Date.now() < dismissAt) event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          previousFocus.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          contentRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          if (previousFocus.current?.isConnected) {
            event.preventDefault();
            previousFocus.current.focus({ preventScroll: true });
          }
        }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <TriangleAlert aria-hidden="true" className="h-8 w-8" />
        </div>
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-2xl font-bold leading-tight text-slate-950 sm:text-4xl">{notice.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed text-slate-700 sm:text-lg">
            {notice.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="items-center gap-3">
          {secondsLeft > 0 && (
            <p className="text-sm text-slate-600">You can continue in {secondsLeft}s.</p>
          )}
          <AlertDialogCancel disabled={secondsLeft > 0} className="mt-0 min-h-12 px-5">
            Remind me in {REMINDER_SECONDS} seconds
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
