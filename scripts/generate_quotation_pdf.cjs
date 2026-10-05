/**
 * Raudah Travels & Tours — Infrastructure & Engineering Quotation Generator
 * Generates an executive single-page quotation for Raudah leadership.
 */

const fs = require("fs");
const path = require("path");
const { jsPDF } = require("../artifacts/raudah-travels/node_modules/jspdf");
const autoTableModule = require("../artifacts/raudah-travels/node_modules/jspdf-autotable");
const autoTable = autoTableModule.default || autoTableModule;

const outputPath = path.resolve("./docs/Raudah_App_Infrastructure_and_Engineering_Quotation.pdf");
const publicOutputPath = path.resolve("./artifacts/raudah-travels/public/Raudah_App_Infrastructure_and_Engineering_Quotation.pdf");

// Initialize A4 Portrait Document
const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
  compress: true,
});

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 14;
const MARGIN_R = 14;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 182 mm

// Brand Colors
const COLOR_NAVY = [28, 31, 102];         // #1C1F66 Corporate Navy
const COLOR_ROYAL = [45, 49, 153];        // #2D3199 Royal Blue
const COLOR_ORANGE = [255, 59, 0];        // #FF3B00 Accent Orange
const COLOR_GOLD = [190, 140, 45];        // #BE8C2D Rich Gold
const COLOR_TEXT_MAIN = [30, 41, 59];     // #1E293B Slate 800
const COLOR_TEXT_MUTED = [100, 116, 139]; // #64748B Slate 500
const COLOR_BG_CARD = [248, 250, 252];    // #F8FAFC
const COLOR_BORDER = [226, 232, 240];     // #E2E8F0

let currentY = 12;

// Load Logo
let logoDataUrl = null;
try {
  const logoBuf = fs.readFileSync("./artifacts/raudah-travels/public/logo.png");
  logoDataUrl = "data:image/png;base64," + logoBuf.toString("base64");
} catch (e) {
  console.warn("Could not read logo:", e.message);
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP HEADER & BRANDING
// ═══════════════════════════════════════════════════════════════════════════

// Top Decorative Dual Color Bar
doc.setFillColor(...COLOR_NAVY);
doc.rect(0, 0, PAGE_W, 3.5, "F");
doc.setFillColor(...COLOR_ORANGE);
doc.rect(0, 3.5, PAGE_W, 1.2, "F");

// Logo on Left
if (logoDataUrl) {
  try {
    // aspect ratio 1.96: 42mm x 21.4mm
    doc.addImage(logoDataUrl, "PNG", MARGIN_L, 8, 40, 20.4);
  } catch (e) {
    console.warn("Logo render error:", e);
  }
}

// Header Title on Right
doc.setFont("helvetica", "bold");
doc.setFontSize(14);
doc.setCharSpace(0.2);
doc.setTextColor(...COLOR_NAVY);
doc.text("OFFICIAL BUDGET QUOTATION", PAGE_W - MARGIN_R, 13, { align: "right" });
doc.setCharSpace(0);

doc.setFont("helvetica", "bold");
doc.setFontSize(8);
doc.setTextColor(...COLOR_ORANGE);
doc.text("APP INFRASTRUCTURE & LEAD ENGINEERING SERVICES", PAGE_W - MARGIN_R, 17.5, { align: "right" });

doc.setFont("helvetica", "normal");
doc.setFontSize(7.5);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("REF: RTT-QUO-2026-001   |   DATE: OCTOBER 2026", PAGE_W - MARGIN_R, 21.5, { align: "right" });
doc.text("NAHCON LICENSED OPERATOR   |   NIGERIA & SAUDI ARABIA", PAGE_W - MARGIN_R, 25.5, { align: "right" });

// Hairline Divider
doc.setDrawColor(...COLOR_BORDER);
doc.setLineWidth(0.4);
doc.line(MARGIN_L, 30.5, PAGE_W - MARGIN_R, 30.5);

currentY = 34;

// ═══════════════════════════════════════════════════════════════════════════
// MEMORANDUM / RECIPIENT & SENDER CARD
// ═══════════════════════════════════════════════════════════════════════════

doc.setFillColor(...COLOR_BG_CARD);
doc.setDrawColor(...COLOR_BORDER);
doc.setLineWidth(0.3);
doc.roundedRect(MARGIN_L, currentY, CONTENT_W, 19, 1.5, 1.5, "FD");

// Left accent line
doc.setFillColor(...COLOR_ROYAL);
doc.roundedRect(MARGIN_L, currentY, 2, 19, 1, 1, "F");

// TO:
doc.setFont("helvetica", "bold");
doc.setFontSize(7);
doc.setCharSpace(0.15);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("TO (EXECUTIVE MANAGEMENT):", MARGIN_L + 5, currentY + 4.5);
doc.setCharSpace(0);

doc.setFont("helvetica", "bold");
doc.setFontSize(8.2);
doc.setTextColor(...COLOR_NAVY);
doc.text("The Chairman & CEO", MARGIN_L + 5, currentY + 8.5);

doc.setFont("helvetica", "normal");
doc.setFontSize(7.5);
doc.setTextColor(...COLOR_TEXT_MAIN);
doc.text("Raudah Travels & Tours Limited — Kano & Abuja, Nigeria", MARGIN_L + 5, currentY + 12.5);

// FROM:
const colRightX = MARGIN_L + 96;
doc.setFont("helvetica", "bold");
doc.setFontSize(7);
doc.setCharSpace(0.15);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("FROM (LEAD ENGINEERING):", colRightX, currentY + 4.5);
doc.setCharSpace(0);

doc.setFont("helvetica", "bold");
doc.setFontSize(8.2);
doc.setTextColor(...COLOR_NAVY);
doc.text("Aliyu Wada — Lead Software Engineer", colRightX, currentY + 8.5);

doc.setFont("helvetica", "normal");
doc.setFontSize(7.5);
doc.setTextColor(...COLOR_TEXT_MAIN);
doc.text("Full-Time On-Ground Lead Engineer (Kano State Base)", colRightX, currentY + 12.5);

currentY += 22.5;

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTIVE VISION 2027 & GROWTH PROJECTION BOX
// ═══════════════════════════════════════════════════════════════════════════

const visionBoxH = 22;
doc.setFillColor(240, 249, 255); // Soft Sky Blue Fill
doc.setDrawColor(186, 230, 253); // Sky Border
doc.setLineWidth(0.4);
doc.roundedRect(MARGIN_L, currentY, CONTENT_W, visionBoxH, 1.5, 1.5, "FD");

// Left Orange Accent Line
doc.setFillColor(...COLOR_ORANGE);
doc.roundedRect(MARGIN_L, currentY, 2.5, visionBoxH, 1, 1, "F");

doc.setFont("helvetica", "bold");
doc.setFontSize(8);
doc.setTextColor(...COLOR_NAVY);
doc.text("STRATEGIC OBJECTIVE: 100% DIGITAL OPERATIONS & 50%+ CUSTOMER SURGE BEFORE 2027", MARGIN_L + 5.5, currentY + 4.8);

doc.setFont("helvetica", "normal");
doc.setFontSize(7.2);
doc.setTextColor(...COLOR_TEXT_MAIN);
const visionText =
  "By or before 2027, all Raudah Travels operations (Hajj, Umrah, Flight Ticketing, Visa Verification, and Payments) will run fully online. Integrating the commercial Booking Engine and automated AI Registration will boost customer acquisition by at least 50%, amplified across strategic advertising channels (Meta/Google digital ads, targeted video reels, branded promotional flyers, and regional/national broadcast news channels).";
const vLines = doc.splitTextToSize(visionText, CONTENT_W - 10);
for (let i = 0; i < vLines.length; i++) {
  doc.text(vLines[i], MARGIN_L + 5.5, currentY + 8.8 + i * 3.4);
}

currentY += visionBoxH + 3.5;

// ═══════════════════════════════════════════════════════════════════════════
// ITEMIZED QUOTATION & FINANCIAL SCHEDULE (TABLE)
// ═══════════════════════════════════════════════════════════════════════════

doc.setFont("helvetica", "bold");
doc.setFontSize(8.5);
doc.setCharSpace(0.1);
doc.setTextColor(...COLOR_NAVY);
doc.text("ITEMIZED FINANCIAL SCHEDULE & BUDGET BREAKDOWN", MARGIN_L, currentY + 1);
doc.setCharSpace(0);

currentY += 3.5;

// Conversion benchmark: $1 USD = ₦1,600 NGN
const tableData = [
  [
    "01",
    "Commercial Flight Booking Engine License & API Support\nFull domestic (Air Peace, Max Air, Ibom, etc.) and international airline booking API integration, live GDS inventory, instant PNR generation, and automated ticket issuance to massively scale Raudah's flight operations nationwide.",
    "Software License\n& API Setup",
    "$2,300.00",
    "NGN 3,680,000.00",
  ],
  [
    "02",
    "AI Fast-Registration Agent & Smart OCR Subsystem\nCustom AI WhatsApp/Telegram chatbot registration agent, automated passport biodata OCR scanning in <3 seconds, auto-face cropping, and automatic duplicate detection to speed up pilgrim onboarding with zero manual errors.",
    "AI Technology\nSubsystem",
    "$250.00",
    "NGN 400,000.00",
  ],
  [
    "03",
    "Lead Software Engineer Monthly Retainer / Salary\nFull-time Lead Software Engineer dedicated to Raudah Travels. Covers on-ground relocation to Kano State, technical operations, server management, 24/7 app maintenance, feature rollouts, and accommodation transition.",
    "Engineering\nMonthly Salary",
    "—",
    "NGN 350,000.00",
  ],
];

autoTable(doc, {
  startY: currentY,
  head: [["#", "Item Description & Operational Purpose", "Category", "USD Cost", "NGN Equivalent (@ NGN 1,600/$)"]],
  body: tableData,
  foot: [
    [
      { content: "SUBTOTAL (SOFTWARE LICENSES & AI SUBSYSTEM)", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
      { content: "$2,550.00", styles: { halign: "right", fontStyle: "bold", textColor: COLOR_NAVY } },
      { content: "NGN 4,080,000.00", styles: { halign: "right", fontStyle: "bold", textColor: COLOR_NAVY } },
    ],
    [
      { content: "MONTHLY ENGINEERING SALARY (ON-GROUND LEAD ENGINEER)", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
      { content: "NGN 350,000.00", styles: { halign: "right", fontStyle: "bold", textColor: COLOR_NAVY } },
    ],
    [
      { content: "TOTAL INITIAL COMMITMENT & DISBURSEMENT", colSpan: 3, styles: { halign: "right", fontStyle: "bold", fontSize: 8, textColor: [255, 255, 255], fillColor: COLOR_NAVY } },
      { content: "$2,550.00", styles: { halign: "right", fontStyle: "bold", fontSize: 8, textColor: [255, 255, 255], fillColor: COLOR_NAVY } },
      { content: "NGN 4,430,000.00", styles: { halign: "right", fontStyle: "bold", fontSize: 8.5, textColor: [255, 215, 0], fillColor: COLOR_NAVY } },
    ],
  ],
  theme: "grid",
  headStyles: {
    fillColor: COLOR_NAVY,
    textColor: [255, 255, 255],
    fontStyle: "bold",
    fontSize: 7.2,
    cellPadding: 2,
  },
  bodyStyles: {
    fontSize: 7,
    textColor: COLOR_TEXT_MAIN,
    cellPadding: 2,
    lineColor: COLOR_BORDER,
  },
  footStyles: {
    fillColor: [241, 245, 249],
    textColor: COLOR_NAVY,
    fontStyle: "bold",
    fontSize: 7.2,
    cellPadding: 2,
  },
  columnStyles: {
    0: { cellWidth: 8, halign: "center", fontStyle: "bold", textColor: COLOR_ORANGE },
    1: { cellWidth: 98 },
    2: { cellWidth: 26, fontStyle: "bold", textColor: COLOR_ROYAL },
    3: { cellWidth: 22, halign: "right", fontStyle: "bold" },
    4: { cellWidth: 28, halign: "right", fontStyle: "bold", textColor: COLOR_NAVY },
  },
  margin: { left: MARGIN_L, right: MARGIN_R },
});

currentY = doc.lastAutoTable.finalY + 4.5;

// Note on Exchange Rate
doc.setFont("helvetica", "italic");
doc.setFontSize(6.5);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("* Note: Dollar components ($2,550 total) are converted at a benchmark rate of 1 USD = 1,600 NGN or the prevailing commercial market rate at the date of disbursement.", MARGIN_L, currentY);

currentY += 4.5;

// ═══════════════════════════════════════════════════════════════════════════
// KEY OPERATIONAL BENEFITS & ROI (3 BULLETS)
// ═══════════════════════════════════════════════════════════════════════════

doc.setFont("helvetica", "bold");
doc.setFontSize(8);
doc.setCharSpace(0.1);
doc.setTextColor(...COLOR_NAVY);
doc.text("KEY OPERATIONAL DELIVERABLES & BUSINESS IMPACT", MARGIN_L, currentY);
doc.setCharSpace(0);

currentY += 3.5;

const deliverables = [
  {
    title: "Instant Multi-Airline Booking Engine",
    desc: "Enables pilgrims and agents to search, reserve, and pay for domestic & international flights directly on Raudah's portal with real-time seat availability and instant e-ticket issuance.",
  },
  {
    title: "Frictionless AI Pilgrim Registration",
    desc: "Reduces registration time from 15 minutes to under 30 seconds via WhatsApp/Telegram and front-desk OCR, eliminating manual typing errors and passport scanning bottlenecks.",
  },
  {
    title: "Dedicated On-Ground Lead Technical Leadership",
    desc: "Aliyu Wada relocates full-time to Kano State to work directly from the head office, guaranteeing zero platform downtime, swift feature rollouts, on-demand staff training, and continuous innovation.",
  },
];

deliverables.forEach((d, idx) => {
  doc.setFillColor(...COLOR_ROYAL);
  doc.circle(MARGIN_L + 2, currentY + 1.2, 0.9, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.3);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(`${d.title}: `, MARGIN_L + 5, currentY + 2);

  const titleW = doc.getTextWidth(`${d.title}: `);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...COLOR_TEXT_MAIN);

  const lines = doc.splitTextToSize(d.desc, CONTENT_W - 5 - titleW);
  doc.text(lines[0], MARGIN_L + 5 + titleW, currentY + 2);

  if (lines.length > 1) {
    for (let li = 1; li < lines.length; li++) {
      doc.text(lines[li], MARGIN_L + 5, currentY + 2 + li * 3.2);
    }
    currentY += lines.length * 3.2 + 1.2;
  } else {
    currentY += 4;
  }
});

currentY += 1.5;

// ═══════════════════════════════════════════════════════════════════════════
// OFFICIAL PAYMENT & SETTLEMENT DETAILS (BANK CARD)
// ═══════════════════════════════════════════════════════════════════════════

const bankCardH = 21;
doc.setFillColor(...COLOR_BG_CARD);
doc.setDrawColor(...COLOR_GOLD);
doc.setLineWidth(0.6);
doc.roundedRect(MARGIN_L, currentY, CONTENT_W, bankCardH, 1.8, 1.8, "FD");

// Gold Left Accent
doc.setFillColor(...COLOR_GOLD);
doc.roundedRect(MARGIN_L, currentY, 2.5, bankCardH, 1, 1, "F");

// Header Label
doc.setFont("helvetica", "bold");
doc.setFontSize(7.2);
doc.setCharSpace(0.15);
doc.setTextColor(...COLOR_GOLD);
doc.text("OFFICIAL SETTLEMENT ACCOUNT DETAILS (DIRECT TRANSFER)", MARGIN_L + 6, currentY + 4.8);
doc.setCharSpace(0);

// Bank Fields Grid
const bankFields = [
  { label: "ACCOUNT NAME", val: "Aliyu Wada" },
  { label: "BANK NAME", val: "OPay (Digital Services)" },
  { label: "ACCOUNT NUMBER", val: "9063412927" },
  { label: "TOTAL PAYABLE", val: "NGN 4,430,000.00" },
];

bankFields.forEach((b, i) => {
  const bx = MARGIN_L + 6 + i * 44;
  const by = currentY + 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(b.label, bx, by);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(i === 3 ? COLOR_ORANGE[0] : COLOR_NAVY[0], i === 3 ? COLOR_ORANGE[1] : COLOR_NAVY[1], i === 3 ? COLOR_ORANGE[2] : COLOR_NAVY[2]);
  doc.text(b.val, bx, by + 4.5);
});

currentY += bankCardH + 3.5;

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTIVE SIGN-OFF & APPROVAL BLOCK
// ═══════════════════════════════════════════════════════════════════════════

const signH = 19;
doc.setFillColor(255, 255, 255);
doc.setDrawColor(...COLOR_BORDER);
doc.setLineWidth(0.3);
doc.roundedRect(MARGIN_L, currentY, CONTENT_W, signH, 1.5, 1.5, "FD");

// Prepared By
doc.setFont("helvetica", "bold");
doc.setFontSize(6.8);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("SUBMITTED & PREPARED BY:", MARGIN_L + 5, currentY + 4.5);

doc.setFont("helvetica", "bold");
doc.setFontSize(8);
doc.setTextColor(...COLOR_NAVY);
doc.text("Aliyu Wada", MARGIN_L + 5, currentY + 9);

doc.setFont("helvetica", "normal");
doc.setFontSize(6.8);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("Lead Software Engineer — Raudah Travels & Tours", MARGIN_L + 5, currentY + 12.5);
doc.text("Signature: __________________________  Date: __/10/2026", MARGIN_L + 5, currentY + 16.5);

// Approved By
const signRightX = MARGIN_L + 96;
doc.setFont("helvetica", "bold");
doc.setFontSize(6.8);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("APPROVED & AUTHORIZED BY:", signRightX, currentY + 4.5);

doc.setFont("helvetica", "bold");
doc.setFontSize(8);
doc.setTextColor(...COLOR_NAVY);
doc.text("The Chairman & CEO", signRightX, currentY + 9);

doc.setFont("helvetica", "normal");
doc.setFontSize(6.8);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("Raudah Travels & Tours Limited", signRightX, currentY + 12.5);
doc.text("Signature: __________________________  Date: __/10/2026", signRightX, currentY + 16.5);

// Bottom Footer
doc.setFont("helvetica", "normal");
doc.setFontSize(6.5);
doc.setTextColor(...COLOR_TEXT_MUTED);
doc.text("CONFIDENTIAL   —   FOR INTERNAL EXECUTIVE MANAGEMENT & FINANCIAL APPROVAL ONLY", PAGE_W / 2, 292, { align: "center" });

// Output PDF
const pdfOutput = doc.output();
const pdfBuffer = Buffer.from(pdfOutput, "binary");

fs.writeFileSync(outputPath, pdfBuffer);
fs.writeFileSync(publicOutputPath, pdfBuffer);

// Also copy to brain artifact directory
const brainDir = path.resolve("C:/Users/DEEPMIND/.gemini/antigravity-ide/brain/838d4c92-fb87-4e7b-8715-e788703b0e75");
if (fs.existsSync(brainDir)) {
  fs.writeFileSync(path.join(brainDir, "Raudah_App_Infrastructure_and_Engineering_Quotation.pdf"), pdfBuffer);
}

console.log("Quotation PDF Generation Complete!");
console.log(`Saved to docs: ${outputPath}`);
console.log(`Saved to public: ${publicOutputPath}`);
console.log(`Total Pages: ${doc.internal.getNumberOfPages()}`);
