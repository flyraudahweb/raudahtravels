import { useListNotifications, getListNotificationsQueryKey, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, CheckCheck, BookOpen, CreditCard, FileText, MessageSquare, Settings, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; gradient: string; bg: string }> = {
  booking: { icon: BookOpen,     gradient: "from-[#2D3199] to-[#4C56B8]", bg: "bg-[#EEF0FF]" },
  payment: { icon: CreditCard,   gradient: "from-[#FF3B00] to-[#FF6B35]", bg: "bg-[#FFF0EC]" },
  document:{ icon: FileText,     gradient: "from-[#0EA5E9] to-[#38BDF8]", bg: "bg-[#EFF9FF]" },
  support: { icon: MessageSquare,gradient: "from-[#8B5CF6] to-[#A78BFA]", bg: "bg-[#F5F0FF]" },
  visa:    { icon: FileText,     gradient: "from-[#0EA5E9] to-[#38BDF8]", bg: "bg-[#EFF9FF]" },
  system:  { icon: Settings,     gradient: "from-[#64748B] to-[#94A3B8]", bg: "bg-[#F1F5F9]" },
};

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function DashboardNotifications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListNotifications({}, { query: { queryKey: getListNotificationsQueryKey({}) } });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkAll = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) });
        toast({ title: "All notifications marked as read" });
      },
    });
  };

  const handleMarkOne = (id: string) => {
    markRead.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey({}) }),
    });
  };

  return (
    <div className="space-y-6" data-testid="page-dashboard-notifications">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Updates</p>
          <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-2.5">
            Notifications
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#FF3B00] text-white text-[11px] font-black">{unreadCount}</span>
            )}
          </h1>
          <p className="text-[#64748B] text-sm mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? "s" : ""}` : "You're all caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            disabled={markAllRead.isPending}
            data-testid="button-mark-all-read"
            className="flex items-center gap-2 px-4 py-2 bg-[#EEF0FF] hover:bg-[#DCE0FF] text-[#2D3199] text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-[#DCE3F0]">
          <div className="w-14 h-14 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <BellOff className="w-6 h-6 text-[#2D3199]/40" />
          </div>
          <p className="font-bold text-[#0F172A] mb-1">No notifications yet</p>
          <p className="text-[#94A3B8] text-sm">We'll notify you of booking updates, payments and more.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
            const Icon = cfg.icon;
            return (
              <div
                key={notif.id}
                data-testid={`card-notification-${notif.id}`}
                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                  notif.isRead
                    ? "bg-white border-[#F1F5F9]"
                    : "bg-[#F8FAFF] border-[#B8C0E8] shadow-[0_2px_12px_rgba(45,49,153,0.07)]"
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-bold leading-snug ${notif.isRead ? "text-[#334155]" : "text-[#0F172A]"}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-[#94A3B8] whitespace-nowrap shrink-0">{timeAgo(notif.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[#64748B] mt-0.5 leading-relaxed">{notif.message}</p>
                </div>

                {/* Unread dot + mark read */}
                {!notif.isRead && (
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#2D3199] mt-1" />
                    <button
                      onClick={() => handleMarkOne(notif.id)}
                      data-testid={`button-mark-read-${notif.id}`}
                      className="w-7 h-7 rounded-xl bg-[#EEF0FF] hover:bg-[#2D3199] text-[#2D3199] hover:text-white flex items-center justify-center transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
