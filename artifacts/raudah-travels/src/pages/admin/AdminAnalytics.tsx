import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, DollarSign, Users, BookOpen, ArrowUpRight, BarChart2,
  Download, FileText, FileSpreadsheet, CheckCircle2, XCircle, Clock,
  Package, RefreshCw, Wallet,
} from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const COLORS = ["#2D3199", "#FF3B00", "#10B981", "#F59E0B", "#8B5CF6", "#0EA5E9", "#EC4899"];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#10B981",
  pending: "#F59E0B",
  cancelled: "#EF4444",
  completed: "#2D3199",
};

const PERIODS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "This Year" },
];

async function fetchAnalytics(params: Record<string, string>) {
  const q = new URLSearchParams(params);
  const r = await fetch(`/api/admin/analytics?${q}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch analytics");
  return r.json() as Promise<any>;
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
  return `₦${n.toLocaleString()}`;
}

function KpiCard({
  label, value, sub, icon: Icon, color, bg,
}: {
  label: string; value: string | number; sub?: string;
  icon: typeof DollarSign; color: string; bg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-[#CBD5E1]" />
      </div>
      <p className="text-2xl font-black text-[#0F172A] leading-tight">{value}</p>
      <p className="text-xs font-semibold text-[#94A3B8] mt-1 uppercase tracking-widest">{label}</p>
      {sub && <p className="text-[10px] text-[#CBD5E1] mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<string>("month");
  const [reportMonth, setReportMonth] = useState(format(new Date(), "yyyy-MM"));
  const [tablePage, setTablePage] = useState(0);
  const TABLE_PAGE_SIZE = 5;
  const chartRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-analytics", period],
    queryFn: () => fetchAnalytics({ period }),
    refetchInterval: 30000,
  });

  // ── Export helpers ────────────────────────────────────────────────────────

  const getReportData = async () => {
    const [y, m] = reportMonth.split("-");
    return fetchAnalytics({ period: "month", month: m, year: y });
  };

  const exportExcel = async () => {
    const d = await getReportData();
    const [y, m] = reportMonth.split("-");
    const monthLabel = format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMMM yyyy");

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ["Raudah Travels & Tours — Monthly Report"],
      [`Period: ${monthLabel}`],
      [`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`],
      [],
      ["Metric", "Value"],
      ["Expected Revenue", d.expectedRevenue],
      ["Collected Revenue", d.collectedRevenue],
      ["Total Bookings", d.totalBookings],
      ["Pilgrims Registered", d.newPilgrims],
      ["Confirmed Bookings", d.bookingsByStatus?.confirmed ?? 0],
      ["Pending Bookings", d.bookingsByStatus?.pending ?? 0],
      ["Cancelled Bookings", d.bookingsByStatus?.cancelled ?? 0],
      ["Completed Bookings", d.bookingsByStatus?.completed ?? 0],
      ["Conversion Rate", `${d.conversionRate ?? 0}%`],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1["!cols"] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    // Revenue by day sheet
    if (d.revenueByPeriod?.length) {
      const revRows = [["Day", "Expected Revenue (₦)", "Collected (₦)", "Bookings"],
        ...d.revenueByPeriod.map((r: any) => [r.label, r.revenue, r.collected, r.bookings])];
      const ws2 = XLSX.utils.aoa_to_sheet(revRows);
      ws2["!cols"] = [{ wch: 8 }, { wch: 22 }, { wch: 22 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws2, "Revenue by Day");
    }

    // Packages sheet
    if (d.packageBreakdown?.length) {
      const pkgRows = [["Package", "Type", "Bookings", "Revenue (₦)", "Capacity", "Fill Rate %"],
        ...d.packageBreakdown.map((p: any) => [p.name, p.type, p.bookings, p.revenue, p.capacity, p.fillRate])];
      const ws3 = XLSX.utils.aoa_to_sheet(pkgRows);
      ws3["!cols"] = [{ wch: 40 }, { wch: 8 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws3, "Packages");
    }

    XLSX.writeFile(wb, `Raudah-Report-${reportMonth}.xlsx`);
  };

  const exportPDF = async () => {
    const d = await getReportData();
    const [y, m] = reportMonth.split("-");
    const monthLabel = format(new Date(parseInt(y), parseInt(m) - 1, 1), "MMMM yyyy");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();

    // ── Load logo (white version for dark header) ────────────────────────────
    const logoResult = await new Promise<{ dataUrl: string; aspect: number }>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const nw = img.naturalWidth || 400;
          const nh = img.naturalHeight || 120;
          const canvas = document.createElement("canvas");
          canvas.width = nw;
          canvas.height = nh;
          const ctx = canvas.getContext("2d")!;
          ctx.filter = "brightness(0) invert(1)";
          ctx.drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL("image/png"), aspect: nw / nh });
        } catch {
          resolve({ dataUrl: "", aspect: 3.5 });
        }
      };
      img.onerror = () => resolve({ dataUrl: "", aspect: 3.5 });
      img.src = "/logo.png";
    });

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFillColor(45, 49, 153);
    doc.rect(0, 0, W, 42, "F");

    // Decorative circles
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.3);
    doc.setGState(doc.GState({ opacity: 0.12 }));
    doc.circle(190, 6, 24, "S");
    doc.circle(185, 38, 14, "S");
    doc.setGState(doc.GState({ opacity: 1 }));

    // Logo (top-right of header, vertically centred)
    if (logoResult.dataUrl) {
      const logoW = 36;
      const logoH = logoW / logoResult.aspect;
      const logoX = W - logoW - 12;
      const logoY = (42 - logoH) / 2;
      doc.addImage(logoResult.dataUrl, "PNG", logoX, logoY, logoW, logoH);
    }

    // Brand name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Raudah Travels & Tours", 14, 17);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 184, 235);
    doc.text("MONTHLY PERFORMANCE REPORT", 14, 25);

    // Period badge
    doc.setFillColor(255, 59, 0);
    doc.roundedRect(14, 29, 52, 7, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(monthLabel.toUpperCase(), 17, 34);

    // Generated date
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 184, 235);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, W - 14, 34, { align: "right" });

    let y2 = 52;

    // ── KPI Cards ───────────────────────────────────────────────────────────
    const kpis = [
      { label: "Expected Revenue", value: fmt(d.expectedRevenue ?? 0), color: [45, 49, 153] as [number,number,number] },
      { label: "Collected Revenue", value: fmt(d.collectedRevenue ?? 0), color: [16, 185, 129] as [number,number,number] },
      { label: "Total Bookings", value: String(d.totalBookings ?? 0), color: [139, 92, 246] as [number,number,number] },
      { label: "Pilgrims", value: String(d.newPilgrims ?? 0), color: [245, 158, 11] as [number,number,number] },
    ];

    const cardW = (W - 28 - 9) / 4;
    kpis.forEach((k, i) => {
      const cx = 14 + i * (cardW + 3);
      doc.setFillColor(248, 250, 255);
      doc.setDrawColor(220, 227, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y2, cardW, 22, 3, 3, "FD");
      doc.setFillColor(...k.color);
      doc.roundedRect(cx + 2, y2 + 2, 6, 6, 1.5, 1.5, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(k.value, cx + 3, y2 + 15);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(k.label.toUpperCase(), cx + 3, y2 + 20);
    });
    y2 += 30;

    // ── Booking Status ───────────────────────────────────────────────────────
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Booking Status Breakdown", 14, y2);
    y2 += 5;

    const statuses = [
      { label: "Confirmed", value: d.bookingsByStatus?.confirmed ?? 0, color: [16, 185, 129] as [number,number,number] },
      { label: "Pending", value: d.bookingsByStatus?.pending ?? 0, color: [245, 158, 11] as [number,number,number] },
      { label: "Cancelled", value: d.bookingsByStatus?.cancelled ?? 0, color: [239, 68, 68] as [number,number,number] },
      { label: "Completed", value: d.bookingsByStatus?.completed ?? 0, color: [45, 49, 153] as [number,number,number] },
    ];
    const sW = (W - 28 - 9) / 4;
    statuses.forEach((s, i) => {
      const cx = 14 + i * (sW + 3);
      doc.setFillColor(...s.color);
      doc.roundedRect(cx, y2, sW, 13, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(String(s.value), cx + sW / 2, y2 + 8, { align: "center" });
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(s.label.toUpperCase(), cx + sW / 2, y2 + 12, { align: "center" });
    });
    y2 += 22;

    // ── Revenue Trend Table ──────────────────────────────────────────────────
    if (d.revenueByPeriod?.length) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Daily Revenue Breakdown", 14, y2);
      y2 += 4;

      autoTable(doc, {
        startY: y2,
        head: [["Day", "Expected (₦)", "Collected (₦)", "Bookings"]],
        body: d.revenueByPeriod.map((r: any) => [
          r.label,
          Number(r.revenue).toLocaleString(),
          Number(r.collected).toLocaleString(),
          r.bookings,
        ]),
        theme: "grid",
        headStyles: { fillColor: [45, 49, 153], textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [248, 250, 255] },
        columnStyles: { 0: { cellWidth: 18 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "center", cellWidth: 22 } },
        margin: { left: 14, right: 14 },
        tableLineColor: [220, 227, 240],
        tableLineWidth: 0.2,
      });
      y2 = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── Package Breakdown ────────────────────────────────────────────────────
    if (d.packageBreakdown?.length) {
      if (y2 > 230) { doc.addPage(); y2 = 20; }
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Package Performance", 14, y2);
      y2 += 4;

      autoTable(doc, {
        startY: y2,
        head: [["Package Name", "Type", "Bookings", "Revenue (₦)", "Capacity", "Fill %"]],
        body: d.packageBreakdown.map((p: any) => [
          p.name,
          p.type.toUpperCase(),
          p.bookings,
          Number(p.revenue).toLocaleString(),
          p.capacity,
          `${p.fillRate}%`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [45, 49, 153], textColor: 255, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [248, 250, 255] },
        columnStyles: { 0: { cellWidth: 65 }, 3: { halign: "right" }, 5: { halign: "center" } },
        margin: { left: 14, right: 14 },
        tableLineColor: [220, 227, 240],
        tableLineWidth: 0.2,
      });
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      const PH = doc.internal.pageSize.getHeight();
      doc.setFillColor(248, 250, 255);
      doc.rect(0, PH - 12, W, 12, "F");
      doc.setDrawColor(220, 227, 240);
      doc.setLineWidth(0.3);
      doc.line(0, PH - 12, W, PH - 12);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("Raudah Travels & Tours — CONFIDENTIAL", 14, PH - 5);
      doc.text(`Page ${p} of ${pages}`, W - 14, PH - 5, { align: "right" });
    }

    doc.save(`Raudah-Report-${reportMonth}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const d = data as any;

  return (
    <div className="space-y-7" ref={chartRef} data-testid="page-admin-analytics">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-[#2D3199] text-xs font-bold uppercase tracking-widest mb-1">Insights</p>
          <h1 className="text-2xl font-black text-[#0F172A]">Analytics Dashboard</h1>
          <p className="text-[#64748B] text-sm mt-0.5">Revenue, bookings, and growth metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#DCE3F0] rounded-xl text-xs font-bold text-[#64748B] hover:text-[#2D3199] hover:border-[#2D3199] transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <div className="flex gap-1.5 bg-white rounded-2xl border border-[#DCE3F0] p-1 shadow-sm overflow-x-auto shrink-0 max-w-full">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${period === p.value ? "bg-[#2D3199] text-white shadow-sm" : "text-[#64748B] hover:text-[#2D3199]"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="h-28 bg-[#F8FAFF] rounded-2xl animate-pulse" />)}</div>
          <div className="h-64 bg-[#F8FAFF] rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-56 bg-[#F8FAFF] rounded-2xl animate-pulse" />)}</div>
        </div>
      ) : !d ? (
        <div className="flex flex-col items-center py-24 text-center bg-white rounded-2xl border border-[#DCE3F0]">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF0FF] flex items-center justify-center mb-4">
            <BarChart2 className="w-7 h-7 text-[#2D3199]/40" />
          </div>
          <p className="text-[#0F172A] font-bold mb-1">No analytics data</p>
          <p className="text-[#94A3B8] text-sm">Data will appear as bookings and payments come in</p>
        </div>
      ) : (
        <>
          {/* ── KPI Row ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label="Expected Revenue" value={fmt(d.expectedRevenue ?? 0)} sub="Confirmed bookings" icon={Wallet} color="#2D3199" bg="#EEF0FF" />
            <KpiCard label="Collected Revenue" value={fmt(d.collectedRevenue ?? 0)} sub="Verified payments" icon={DollarSign} color="#10B981" bg="#ECFDF5" />
            <KpiCard label="Total Bookings" value={d.totalBookings ?? 0} sub={period} icon={BookOpen} color="#8B5CF6" bg="#F5F3FF" />
            <KpiCard label="Pilgrims" value={d.newPilgrims ?? 0} sub="Registered" icon={Users} color="#F59E0B" bg="#FFFBEB" />
            <KpiCard label="Conversion Rate" value={`${d.conversionRate ?? 0}%`} sub="Confirmed / total" icon={TrendingUp} color="#FF3B00" bg="#FFF1F0" />
          </div>

          {/* ── Revenue Trend ─────────────────────────────────────────────── */}
          {d.revenueByPeriod?.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <div>
                  <p className="font-black text-[#0F172A] text-base">Revenue Trend</p>
                  <p className="text-[#64748B] text-xs mt-0.5">Expected vs collected over time</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#2D3199] rounded-full inline-block" /> Expected</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#10B981] rounded-full inline-block" /> Collected</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-[#FF3B00] rounded-full inline-block" /> Bookings</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={d.revenueByPeriod}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2D3199" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#2D3199" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="rev" tickFormatter={v => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="book" orientation="right" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DCE3F0", fontSize: 12 }}
                    formatter={(v: number, name: string) => [
                      name === "bookings" ? v : `₦${Number(v).toLocaleString()}`,
                      name === "revenue" ? "Expected" : name === "collected" ? "Collected" : "Bookings"
                    ]} />
                  <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#2D3199" strokeWidth={2.5} fill="url(#gradRev)" dot={{ r: 3, fill: "#2D3199" }} />
                  <Area yAxisId="rev" type="monotone" dataKey="collected" stroke="#10B981" strokeWidth={2} fill="url(#gradCol)" dot={{ r: 3, fill: "#10B981" }} />
                  <Area yAxisId="book" type="monotone" dataKey="bookings" stroke="#FF3B00" strokeWidth={1.5} fill="none" strokeDasharray="4 3" dot={{ r: 2, fill: "#FF3B00" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Middle Row: Status Donut + Hajj/Umrah + Payment Methods ──── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Booking Status donut */}
            <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
              <p className="font-black text-[#0F172A] text-base mb-1">Booking Status</p>
              <p className="text-[#64748B] text-xs mb-3">Current distribution</p>
              {d.bookingsByStatus ? (() => {
                const items = [
                  { name: "Confirmed", value: d.bookingsByStatus.confirmed, color: "#10B981", Icon: CheckCircle2 },
                  { name: "Pending", value: d.bookingsByStatus.pending, color: "#F59E0B", Icon: Clock },
                  { name: "Cancelled", value: d.bookingsByStatus.cancelled, color: "#EF4444", Icon: XCircle },
                  { name: "Completed", value: d.bookingsByStatus.completed, color: "#2D3199", Icon: BookOpen },
                ].filter(i => i.value > 0);
                const total = items.reduce((s, i) => s + i.value, 0) || 1;
                return items.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={items} cx="50%" cy="50%" innerRadius={40} outerRadius={62} dataKey="value" paddingAngle={3}>
                          {items.map((item, i) => <Cell key={i} fill={item.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DCE3F0", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {items.map(item => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                            <span className="text-[#475569]">{item.name}</span>
                          </div>
                          <span className="font-bold text-[#0F172A]">{item.value} <span className="text-[#94A3B8] font-normal">({Math.round(item.value / total * 100)}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-[#94A3B8] text-sm">No bookings yet</div>
                );
              })() : null}
            </div>

            {/* Hajj vs Umrah pie */}
            <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
              <p className="font-black text-[#0F172A] text-base mb-1">Journey Type Split</p>
              <p className="text-[#64748B] text-xs mb-3">Hajj vs Umrah bookings</p>
              {(() => {
                const hv = d.hajjVsUmrah;
                const items = [
                  { name: "Hajj", value: hv?.hajj ?? 0, pct: hv?.hajjPercent ?? 0, color: "#2D3199" },
                  { name: "Umrah", value: hv?.umrah ?? 0, pct: hv?.umrahPercent ?? 0, color: "#FF3B00" },
                ];
                const hasData = items.some(i => i.value > 0);
                return hasData ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={items} cx="50%" cy="50%" innerRadius={40} outerRadius={62} dataKey="value" paddingAngle={3}>
                          {items.map((item, i) => <Cell key={i} fill={item.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DCE3F0", fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-1">
                      {items.map(item => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                            <span className="text-[#475569]">{item.name}</span>
                          </div>
                          <span className="font-bold text-[#0F172A]">{item.value} <span className="text-[#94A3B8] font-normal">({item.pct}%)</span></span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="h-40 flex items-center justify-center text-[#94A3B8] text-sm">No bookings yet</div>
                );
              })()}
            </div>

            {/* Payment method breakdown */}
            <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
              <p className="font-black text-[#0F172A] text-base mb-1">Payment Methods</p>
              <p className="text-[#64748B] text-xs mb-4">How pilgrims pay</p>
              <div className="space-y-3">
                {(d.paymentMethodBreakdown || []).map((pm: any, i: number) => (
                  <div key={pm.method}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-[#475569]">{pm.method}</span>
                      <span className="font-bold text-[#0F172A]">{pm.count} payments</span>
                    </div>
                    <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max((pm.count / Math.max((d.paymentMethodBreakdown?.reduce((s: number, x: any) => s + x.count, 0) || 1), 1)) * 100, pm.count > 0 ? 4 : 0)}%`, background: COLORS[i] }} />
                    </div>
                  </div>
                ))}
                {(!d.paymentMethodBreakdown || d.paymentMethodBreakdown.every((p: any) => p.count === 0)) && (
                  <div className="text-center text-[#94A3B8] text-sm py-8">No payments recorded</div>
                )}
              </div>
            </div>
          </div>

          {/* ── Package Performance Bar ────────────────────────────────────── */}
          {d.packageBreakdown?.length > 0 && (() => {
            const allPkgs = d.packageBreakdown;
            const BAR_HEIGHT = 40;
            const chartHeight = Math.max(200, allPkgs.length * BAR_HEIGHT);
            const needsScroll = allPkgs.length > 7;
            return (
              <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-black text-[#0F172A] text-base">Package Performance</p>
                    <p className="text-[#64748B] text-xs mt-0.5">
                      Bookings per package · {allPkgs.length} package{allPkgs.length !== 1 ? "s" : ""} total
                    </p>
                  </div>
                  {needsScroll && (
                    <span className="text-[10px] font-bold text-[#94A3B8] bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-full whitespace-nowrap">
                      ↕ Scroll to see all
                    </span>
                  )}
                </div>
                <div
                  className={needsScroll ? "overflow-y-auto pr-1" : ""}
                  style={needsScroll ? { maxHeight: 7 * BAR_HEIGHT + 8 } : {}}
                >
                  <div style={{ height: chartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allPkgs} barSize={20} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={210}
                          tick={{ fontSize: 10, fill: "#64748B" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 28) + "…" : v}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #DCE3F0", fontSize: 12 }}
                          formatter={(v: number) => [v, "Bookings"]}
                          labelFormatter={(label: string) => label}
                        />
                        <Bar dataKey="bookings" radius={[0, 6, 6, 0]}>
                          {allPkgs.map((_: any, i: number) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Package Breakdown Table (paginated) ───────────────────────── */}
          {d.packageBreakdown?.length > 0 && (() => {
            const total = d.packageBreakdown.length;
            const totalPages = Math.ceil(total / TABLE_PAGE_SIZE);
            const safePage = Math.min(tablePage, totalPages - 1);
            const start = safePage * TABLE_PAGE_SIZE;
            const pageRows = d.packageBreakdown.slice(start, start + TABLE_PAGE_SIZE);
            return (
              <div className="bg-white rounded-2xl border border-[#DCE3F0] shadow-[0_2px_16px_rgba(45,49,153,0.06)] overflow-hidden">
                <div className="px-5 pt-5 pb-4 border-b border-[#F1F5F9] flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-[#0F172A] text-base">Package Breakdown</p>
                    <p className="text-[#64748B] text-xs mt-0.5">
                      Revenue and fill rates · {start + 1}–{Math.min(start + TABLE_PAGE_SIZE, total)} of {total} packages
                    </p>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setTablePage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#F1F5F9] hover:bg-[#2D3199] hover:text-white text-[#475569]"
                      >‹</button>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => setTablePage(i)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-colors ${
                            i === safePage
                              ? "bg-[#2D3199] text-white shadow-md"
                              : "bg-[#F1F5F9] text-[#475569] hover:bg-[#EEF0FF] hover:text-[#2D3199]"
                          }`}
                        >{i + 1}</button>
                      ))}
                      <button
                        onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage === totalPages - 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-[#F1F5F9] hover:bg-[#2D3199] hover:text-white text-[#475569]"
                      >›</button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F8FAFF] text-[#64748B] text-xs uppercase tracking-wider">
                        <th className="px-5 py-3 text-left font-bold">#</th>
                        <th className="px-5 py-3 text-left font-bold">Package</th>
                        <th className="px-4 py-3 text-center font-bold">Type</th>
                        <th className="px-4 py-3 text-right font-bold">Bookings</th>
                        <th className="px-4 py-3 text-right font-bold">Revenue</th>
                        <th className="px-4 py-3 text-right font-bold">Capacity</th>
                        <th className="px-4 py-3 text-center font-bold">Fill Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {pageRows.map((p: any, i: number) => {
                        const globalIdx = start + i;
                        return (
                          <tr key={globalIdx} className="hover:bg-[#F8FAFF] transition-colors">
                            <td className="px-5 py-3.5 text-xs font-black text-[#CBD5E1] tabular-nums">{globalIdx + 1}</td>
                            <td className="px-5 py-3.5 font-medium text-[#0F172A] max-w-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[globalIdx % COLORS.length] }} />
                                <span className="truncate" title={p.name}>{p.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${p.type === "hajj" ? "bg-[#EEF0FF] text-[#2D3199]" : "bg-orange-50 text-orange-700"}`}>
                                {p.type}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right font-bold text-[#0F172A]">{p.bookings}</td>
                            <td className="px-4 py-3.5 text-right font-bold text-emerald-700">{fmt(p.revenue)}</td>
                            <td className="px-4 py-3.5 text-right text-[#64748B]">{p.capacity}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(p.fillRate, 100)}%`, background: p.fillRate > 75 ? "#EF4444" : p.fillRate > 40 ? "#F59E0B" : "#10B981" }} />
                                </div>
                                <span className="text-xs font-bold text-[#475569] w-9 text-right">{p.fillRate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="px-5 py-3 border-t border-[#F1F5F9] bg-[#FAFBFF] flex items-center justify-between">
                    <p className="text-xs text-[#94A3B8]">
                      Page {safePage + 1} of {totalPages} · {total} packages total
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTablePage(p => Math.max(0, p - 1))}
                        disabled={safePage === 0}
                        className="text-xs font-black text-[#2D3199] disabled:text-[#CBD5E1] disabled:cursor-not-allowed hover:underline"
                      >← Previous</button>
                      <span className="text-[#E2E8F0]">|</span>
                      <button
                        onClick={() => setTablePage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={safePage === totalPages - 1}
                        className="text-xs font-black text-[#2D3199] disabled:text-[#CBD5E1] disabled:cursor-not-allowed hover:underline"
                      >Next →</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Export Report Section ─────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-[#2D3199] to-[#4C56CC] rounded-2xl p-6 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Download className="w-4 h-4 text-white/70" />
                  <p className="text-xs font-bold uppercase tracking-widest text-white/70">Export Report</p>
                </div>
                <p className="text-lg font-black">Download Monthly Report</p>
                <p className="text-white/60 text-sm mt-0.5">Select a month and export as Excel spreadsheet or a beautifully designed PDF</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div>
                  <p className="text-white/60 text-[10px] font-bold uppercase mb-1">Select Month</p>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={e => setReportMonth(e.target.value)}
                    max={format(new Date(), "yyyy-MM")}
                    className="px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium outline-none focus:border-white/50 transition-all [color-scheme:dark]" />
                </div>
                <div className="flex gap-2 mt-4 sm:mt-0">
                  <button onClick={exportExcel}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#10B981] rounded-xl text-white text-sm font-bold hover:bg-[#059669] transition-colors shadow-lg shadow-emerald-500/20">
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={exportPDF}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#FF3B00] rounded-xl text-white text-sm font-bold hover:bg-[#E63400] transition-colors shadow-lg shadow-red-500/20">
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
