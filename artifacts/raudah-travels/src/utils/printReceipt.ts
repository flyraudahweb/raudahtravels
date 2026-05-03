export interface ReceiptData {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string | null;
  createdAt: string;
  notes?: string | null;
  pilgrimName?: string | null;
  packageName?: string | null;
  departureDate?: string | null;
  bookingId?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  cash: "Cash Payment",
  card: "Card Payment",
  wallet: "Wallet Payment",
  online: "Online Payment (Paystack)",
  paystack: "Online Payment (Paystack)",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  verified: { label: "VERIFIED", color: "#059669" },
  pending:  { label: "PENDING VERIFICATION", color: "#D97706" },
  rejected: { label: "REJECTED", color: "#DC2626" },
};

export function printReceipt(data: ReceiptData) {
  const origin = window.location.origin;
  const logoUrl = `${origin}/logo.png`;
  const now = new Date();
  const receiptNo = `RCT-${data.id.slice(-8).toUpperCase()}`;
  const payDate = new Date(data.createdAt).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const payTime = new Date(data.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit",
  });
  const statusInfo = STATUS_LABELS[data.status] || STATUS_LABELS.pending;
  const methodLabel = METHOD_LABELS[data.method] || data.method.replace(/_/g, " ");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt — ${receiptNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F8FAFC; color: #0F172A; }
    .page { max-width: 680px; margin: 0 auto; background: #fff; }

    /* Header */
    .header { background: linear-gradient(135deg, #2D3199 0%, #4C56B8 100%); padding: 36px 40px 28px; color: white; }
    .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .logo-wrap { display: flex; align-items: center; gap: 12px; }
    .logo-img { width: 48px; height: 48px; object-fit: contain; background: white; border-radius: 10px; padding: 4px; }
    .company-name { font-size: 20px; font-weight: 900; letter-spacing: -0.3px; }
    .company-tagline { font-size: 11px; opacity: 0.75; font-weight: 500; margin-top: 2px; }
    .receipt-label { text-align: right; }
    .receipt-label p:first-child { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; opacity: 0.7; }
    .receipt-no { font-size: 18px; font-weight: 900; font-family: monospace; letter-spacing: 1px; }
    .amount-row { display: flex; align-items: flex-end; justify-content: space-between; }
    .amount-block p:first-child { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.7; margin-bottom: 4px; }
    .amount-big { font-size: 42px; font-weight: 900; letter-spacing: -1px; }
    .status-pill { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 100px; padding: 6px 14px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: ${statusInfo.color}; }
    .status-text { font-size: 12px; font-weight: 800; letter-spacing: 0.5px; }

    /* Body */
    .body { padding: 32px 40px; }

    /* Section */
    .section { margin-bottom: 24px; }
    .section-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #94A3B8; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #F1F5F9; }
    .row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; }
    .row-label { font-size: 13px; color: #64748B; font-weight: 500; }
    .row-value { font-size: 13px; color: #0F172A; font-weight: 700; text-align: right; max-width: 60%; }
    .row-value.mono { font-family: monospace; font-size: 12px; }
    .row-value.accent { color: #2D3199; }
    .row + .row { border-top: 1px solid #F8FAFC; }

    /* Divider */
    .divider { border: none; border-top: 2px dashed #E2E8F0; margin: 24px 0; }

    /* Verified stamp */
    .stamp { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; border: 2px solid ${statusInfo.color}; border-radius: 12px; margin: 24px 0; }
    .stamp-icon { font-size: 22px; }
    .stamp-text { font-size: 14px; font-weight: 900; color: ${statusInfo.color}; letter-spacing: 1px; text-transform: uppercase; }

    /* Footer */
    .footer { background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 24px 40px; text-align: center; }
    .footer-arabic { font-size: 18px; font-weight: 700; color: #2D3199; margin-bottom: 6px; }
    .footer-text { font-size: 11px; color: #94A3B8; line-height: 1.6; }
    .footer-contact { margin-top: 12px; font-size: 11px; color: #64748B; font-weight: 600; }
    .print-date { font-size: 10px; color: #CBD5E1; margin-top: 8px; }

    @media print {
      body { background: white; }
      .page { box-shadow: none; }
      .no-print { display: none !important; }
      @page { margin: 0.5in; size: A4 portrait; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Print button (web only) -->
  <div class="no-print" style="background:#EEF0FF;padding:12px 40px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:13px;font-weight:700;color:#2D3199;">Payment Receipt Preview</span>
    <button onclick="window.print()" style="background:#2D3199;color:white;border:none;border-radius:8px;padding:8px 20px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print / Save PDF</button>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="logo-wrap">
        <img class="logo-img" src="${logoUrl}" alt="Raudah Travels" onerror="this.style.display='none'" />
        <div>
          <div class="company-name">Raudah Travels & Tours</div>
          <div class="company-tagline">Hajj & Umrah Specialists · Nigeria</div>
        </div>
      </div>
      <div class="receipt-label">
        <p>Payment Receipt</p>
        <div class="receipt-no">${receiptNo}</div>
      </div>
    </div>
    <div class="amount-row">
      <div class="amount-block">
        <p>Amount Paid</p>
        <div class="amount-big">₦${data.amount.toLocaleString()}</div>
      </div>
      <div class="status-pill">
        <div class="status-dot"></div>
        <span class="status-text">${statusInfo.label}</span>
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Payment Details -->
    <div class="section">
      <div class="section-title">Payment Details</div>
      <div class="row">
        <span class="row-label">Payment Method</span>
        <span class="row-value accent">${methodLabel}</span>
      </div>
      <div class="row">
        <span class="row-label">Date</span>
        <span class="row-value">${payDate}</span>
      </div>
      <div class="row">
        <span class="row-label">Time</span>
        <span class="row-value">${payTime}</span>
      </div>
      ${data.reference ? `
      <div class="row">
        <span class="row-label">Transaction Reference</span>
        <span class="row-value mono">${data.reference}</span>
      </div>` : ""}
      ${data.bookingId ? `
      <div class="row">
        <span class="row-label">Booking ID</span>
        <span class="row-value mono">${data.bookingId.slice(0, 12).toUpperCase()}</span>
      </div>` : ""}
    </div>

    ${data.pilgrimName || data.packageName ? `
    <!-- Pilgrim / Package -->
    <div class="section">
      <div class="section-title">Booking Information</div>
      ${data.pilgrimName ? `
      <div class="row">
        <span class="row-label">Pilgrim Name</span>
        <span class="row-value">${data.pilgrimName}</span>
      </div>` : ""}
      ${data.packageName ? `
      <div class="row">
        <span class="row-label">Package</span>
        <span class="row-value">${data.packageName}</span>
      </div>` : ""}
      ${data.departureDate ? `
      <div class="row">
        <span class="row-label">Departure Date</span>
        <span class="row-value">${new Date(data.departureDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>` : ""}
    </div>` : ""}

    ${data.notes ? `
    <div class="section">
      <div class="section-title">Notes</div>
      <p style="font-size:13px;color:#64748B;line-height:1.6;">${data.notes}</p>
    </div>` : ""}

    <!-- Status Stamp -->
    <div class="stamp">
      <span class="stamp-icon">${data.status === "verified" ? "✅" : data.status === "rejected" ? "❌" : "⏳"}</span>
      <span class="stamp-text">${statusInfo.label}</span>
    </div>

    <hr class="divider" />

    <!-- Summary Row -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">
      <span style="font-size:15px;font-weight:700;color:#0F172A;">Total Amount</span>
      <span style="font-size:22px;font-weight:900;color:#2D3199;">₦${data.amount.toLocaleString()}</span>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-arabic">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</div>
    <p class="footer-text">
      Thank you for choosing Raudah Travels & Tours for your sacred pilgrimage.<br>
      May Allah accept your Hajj/Umrah and grant you a blessed journey.
    </p>
    <p class="footer-contact">Raudah Travels & Tours Ltd · Nigeria · raudahtravels.com</p>
    <p class="print-date">Printed on ${now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} at ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=760,height=900,scrollbars=yes");
  if (!win) {
    alert("Pop-up blocked — please allow pop-ups for this site to print receipts.");
    return;
  }
  win.document.write(html);
  win.document.close();
}
