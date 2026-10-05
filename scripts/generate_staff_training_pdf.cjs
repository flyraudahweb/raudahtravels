/**
 * Raudah Travels & Tours — Staff Operational Training Manual & Handbook
 * Version 1.0 (Official Release)
 *
 * Ultra-professional, executive-grade corporate handbook generator.
 * Features:
 * - High-contrast readable typography with generous line-height
 * - Executive cover page with high-contrast visible compliance badge
 * - Authentic high-resolution company logo with proper aspect ratio
 * - Beautiful section headers with colored indicator ribbons & tracking
 * - Circular numbered badges for process step cards
 * - High-contrast styled tables with status badges
 * - Exactly 10 carefully budgeted pages (1 page per core module)
 * - Two-pass running headers & footers with page numbers
 */

const fs = require("fs");
const path = require("path");
const { jsPDF } = require("../artifacts/raudah-travels/node_modules/jspdf");
const autoTableModule = require("../artifacts/raudah-travels/node_modules/jspdf-autotable");
const autoTable = autoTableModule.default || autoTableModule;

const outputPath = path.resolve("./docs/Raudah_Travels_Staff_Training_Manual.pdf");
const publicOutputPath = path.resolve("./artifacts/raudah-travels/public/Raudah_Travels_Staff_Training_Manual.pdf");

// Initialize A4 Document (210mm x 297mm)
const doc = new jsPDF({
  orientation: "portrait",
  unit: "mm",
  format: "a4",
  compress: true,
});

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_L = 16;
const MARGIN_R = 16;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 178 mm
const TOP_MARGIN = 22;
const BOTTOM_MARGIN = 20;

// Premium Corporate Color Palette
const COLOR_NAVY = [28, 31, 102];        // #1C1F66 Dark Corporate Indigo
const COLOR_ROYAL = [45, 49, 153];       // #2D3199 Brand Royal Indigo
const COLOR_ORANGE = [255, 59, 0];       // #FF3B00 Brand Accent Orange
const COLOR_GOLD = [190, 140, 45];       // #BE8C2D Rich Gold accent
const COLOR_TEXT_MAIN = [30, 41, 59];    // #1E293B Slate 800 (High contrast readability)
const COLOR_TEXT_MUTED = [100, 116, 139];// #64748B Slate 500 (Clean secondary)
const COLOR_BG_CARD = [248, 250, 252];   // #F8FAFC Ultra-light background
const COLOR_BORDER = [226, 232, 240];    // #E2E8F0 Clean border line
const COLOR_HEADER_BG = [241, 245, 249]; // #F1F5F9 Section banner fill

let currentY = TOP_MARGIN;

// Load Authentic Logo from public/logo.png
let logoDataUrl = null;
try {
  const logoBuf = fs.readFileSync("./artifacts/raudah-travels/public/logo.png");
  logoDataUrl = "data:image/png;base64," + logoBuf.toString("base64");
} catch (e) {
  console.warn("Could not read logo.png from public folder:", e.message);
}

// Helper: Ensure Space on Page
function checkPageBreak(neededHeight) {
  if (currentY + neededHeight > PAGE_H - BOTTOM_MARGIN) {
    doc.addPage();
    currentY = TOP_MARGIN;
    return true;
  }
  return false;
}

// Helper: Chapter / Module Title Block
function addChapterTitle(modNum, title, summary) {
  // Module Pill Badge
  doc.setFillColor(...COLOR_ROYAL);
  doc.roundedRect(MARGIN_L, currentY, 28, 5.8, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setCharSpace(0.2);
  doc.setTextColor(255, 255, 255);
  doc.text(`MODULE ${modNum}`, MARGIN_L + 3.8, currentY + 4.1);
  doc.setCharSpace(0);

  // Generous vertical spacing so the title NEVER touches or collides with the pill badge
  currentY += 11;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setCharSpace(0.1);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(title, MARGIN_L, currentY);
  doc.setCharSpace(0);
  currentY += 5.2;

  // Summary with relaxed line height
  if (summary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    const lines = doc.splitTextToSize(summary, CONTENT_W);
    const lineH = 4.2;
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], MARGIN_L, currentY + i * lineH);
    }
    currentY += lines.length * lineH + 2.5;
  }

  // Divider rule with subtle orange accent tick
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_L, currentY, MARGIN_L + CONTENT_W, currentY);

  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(MARGIN_L, currentY - 0.4, 18, 0.8, "F");

  currentY += 5.5;
}

// Helper: Modern Section Header (H2) with clean background ribbon
function addSectionHeader(title) {
  checkPageBreak(14);

  const bannerH = 6.8;
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, currentY - 2.2, CONTENT_W, bannerH, 1.2, 1.2, "FD");

  // Left solid accent bar
  doc.setFillColor(...COLOR_ORANGE);
  doc.roundedRect(MARGIN_L, currentY - 2.2, 2.2, bannerH, 1, 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setCharSpace(0.1);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(title, MARGIN_L + 5, currentY + 2.3);
  doc.setCharSpace(0);

  currentY += bannerH + 3;
}

// Helper: High-Readability Paragraph with Spacious Line Height
function addParagraph(text, extraSpacing = 2.5) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setCharSpace(0);
  doc.setTextColor(...COLOR_TEXT_MAIN);

  const lines = doc.splitTextToSize(text, CONTENT_W);
  const lineH = 4.2; // Relaxed, comfortable line height

  checkPageBreak(lines.length * lineH + extraSpacing);

  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], MARGIN_L, currentY + i * lineH);
  }

  currentY += lines.length * lineH + extraSpacing;
}

// Helper: Clean Bullet Point with Proper Word Wrapping
function addBullet(tag, text, indent = 4.5) {
  doc.setFontSize(8);
  doc.setCharSpace(0);
  const textW = CONTENT_W - indent;
  const lineH = 4.1;

  // Clean bullet circle
  doc.setFillColor(...COLOR_ROYAL);
  doc.circle(MARGIN_L + indent / 2, currentY - 0.9, 0.7, "F");

  if (tag) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    const tagStr = `${tag}: `;
    const tagW = doc.getTextWidth(tagStr);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MAIN);

    // Compute lines properly
    const fullText = tagStr + text;
    const lines = doc.splitTextToSize(fullText, textW);
    checkPageBreak(lines.length * lineH + 1.5);

    // First line: bold tag + remainder of first line
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(tagStr, MARGIN_L + indent, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MAIN);
    const line0AfterTag = lines[0].substring(tagStr.length);
    doc.text(line0AfterTag, MARGIN_L + indent + tagW, currentY);

    for (let i = 1; i < lines.length; i++) {
      doc.text(lines[i], MARGIN_L + indent, currentY + i * lineH);
    }
    currentY += lines.length * lineH + 1.8;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MAIN);
    const lines = doc.splitTextToSize(text, textW);
    checkPageBreak(lines.length * lineH + 1.5);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], MARGIN_L + indent, currentY + i * lineH);
    }
    currentY += lines.length * lineH + 1.8;
  }
}

// Helper: Styled Process Step Card
function addStepCard(stepNumber, stepTitle, instructions) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setCharSpace(0);
  const textLines = doc.splitTextToSize(instructions, CONTENT_W - 20);
  const lineH = 3.8;
  const cardHeight = Math.max(13, textLines.length * lineH + 8);

  checkPageBreak(cardHeight + 2);

  // Outer Card Box
  doc.setFillColor(...COLOR_BG_CARD);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, currentY, CONTENT_W, cardHeight, 1.5, 1.5, "FD");

  // Step Number Circular Badge
  doc.setFillColor(...COLOR_ROYAL);
  doc.circle(MARGIN_L + 6.5, currentY + 6.5, 3.8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(stepNumber), MARGIN_L + 6.5 - doc.getTextWidth(String(stepNumber)) / 2, currentY + 7.7);

  // Step Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(stepTitle, MARGIN_L + 13.5, currentY + 5.2);

  // Step Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT_MAIN);
  for (let i = 0; i < textLines.length; i++) {
    doc.text(textLines[i], MARGIN_L + 13.5, currentY + 9.5 + i * lineH);
  }

  currentY += cardHeight + 2.2;
}

// Helper: Styled Callout / Warning Box
function addCalloutBox(type, title, message) {
  let strokeColor, fillColor, barColor, badgeText;
  if (type === "warning") {
    strokeColor = [254, 215, 170];
    fillColor = [255, 247, 237];
    barColor = COLOR_ORANGE;
    badgeText = "[COMPLIANCE ALERT]";
  } else if (type === "success") {
    strokeColor = [187, 247, 208];
    fillColor = [240, 253, 244];
    barColor = [22, 163, 74];
    badgeText = "[STAFF STANDARD]";
  } else {
    strokeColor = [191, 219, 254];
    fillColor = [239, 246, 255];
    barColor = COLOR_ROYAL;
    badgeText = "[OPERATIONAL TIP]";
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setCharSpace(0);
  const msgLines = doc.splitTextToSize(message, CONTENT_W - 12);
  const lineH = 3.8;
  const boxH = Math.max(16, msgLines.length * lineH + 9.5);

  checkPageBreak(boxH + 3);

  doc.setFillColor(...fillColor);
  doc.setDrawColor(...strokeColor);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN_L, currentY, CONTENT_W, boxH, 1.5, 1.5, "FD");

  // Left solid color bar
  doc.setFillColor(...barColor);
  doc.roundedRect(MARGIN_L, currentY, 2.5, boxH, 1, 1, "F");

  // Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...barColor);
  doc.text(`${badgeText}  ${title}`, MARGIN_L + 6, currentY + 5.2);

  // Message Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT_MAIN);
  for (let i = 0; i < msgLines.length; i++) {
    doc.text(msgLines[i], MARGIN_L + 6, currentY + 9.2 + i * lineH);
  }

  currentY += boxH + 3;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1: EXECUTIVE COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════

function renderExecutiveCover() {
  // Top Navy Hero Header (116mm deep)
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, PAGE_W, 116, "F");

  // Crisp Accent Strip (Gold & Orange dual line)
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(0, 114, PAGE_W, 1, "F");
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, 115, PAGE_W, 1.5, "F");

  // Authentic Brand Logo in White Card (aspect ratio 1.96: 46mm x 23.4mm)
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN_L, 14, 56, 30, 2.5, 2.5, "F");
      doc.addImage(logoDataUrl, "PNG", MARGIN_L + 5, 17, 46, 23.5);
    } catch (e) {
      console.warn("Error rendering cover logo:", e);
    }
  }

  // Official Compliance Badge (100% HIGH CONTRAST: Solid white card with gold border and deep navy text)
  // Generous width 126mm so letter-spaced text fits with ample breathing room
  const badgeText = "NAHCON LICENSED OPERATOR   |   NIGERIA & SAUDI ARABIA";
  const badgeW = 126;
  const badgeH = 7.5;
  const badgeX = MARGIN_L;
  const badgeY = 50;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.7);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.8, 1.8, "FD");

  // Gold indicator dot
  doc.setFillColor(...COLOR_GOLD);
  doc.circle(badgeX + 4.5, badgeY + badgeH / 2, 1.4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setCharSpace(0.25);
  doc.setTextColor(...COLOR_NAVY); // Deep crisp navy text
  doc.text(badgeText, badgeX + 8, badgeY + 5.1);
  doc.setCharSpace(0);

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setCharSpace(0.15);
  doc.setTextColor(255, 255, 255);
  doc.text("STAFF OPERATIONAL", MARGIN_L, 70);
  doc.setTextColor(255, 130, 80); // Warm Coral Orange
  doc.text("TRAINING MANUAL", MARGIN_L, 79);
  doc.setCharSpace(0);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(220, 228, 245);
  doc.text("Standard Operating Procedures (SOP) & Comprehensive System Handbook", MARGIN_L, 88);

  // Version 1.0 Highlight Badge (Exact user specification: "version is 1 not 2")
  // Width 60mm ensures "VERSION 1.0 (OFFICIAL RELEASE)" fits with generous padding
  doc.setFillColor(...COLOR_ORANGE);
  doc.roundedRect(MARGIN_L, 94, 60, 7.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setCharSpace(0.2);
  doc.setTextColor(255, 255, 255);
  doc.text("VERSION 1.0 (OFFICIAL RELEASE)", MARGIN_L + 4.5, 99.1);
  doc.setCharSpace(0);

  // Lower Half: White Body with Cards
  currentY = 126;

  // Metadata Card
  doc.setFillColor(...COLOR_BG_CARD);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN_L, currentY, CONTENT_W, 32, 2, 2, "FD");

  const metaData = [
    { label: "ORGANIZATION", val: "Raudah Travels & Tours Limited" },
    { label: "HEAD OFFICE", val: "City Scape/Shariff Plaza, Wuse 2, Abuja" },
    { label: "DOCUMENT REF", val: "RTT-SOP-2026-V1.0" },
    { label: "DATE OF ISSUE", val: "October 2026 (Official Edition)" },
  ];

  metaData.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = MARGIN_L + 6 + col * 90;
    const y = currentY + 7 + row * 13;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setCharSpace(0.2);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(m.label, x, y);
    doc.setCharSpace(0);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(m.val, x, y + 4.2);
  });

  currentY += 40;

  // Department Grid Preview
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setCharSpace(0.1);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("Operational Department Modules Covered in this Manual:", MARGIN_L, currentY);
  doc.setCharSpace(0);
  currentY += 6;

  const deptGrid = [
    { title: "Registration & Front-Desk", focus: "5-Step wizard, AI OCR scan, Mahram matching, bulk upload" },
    { title: "Passport & Document Vetting", focus: "Saudi 6-month validity rule, quality check, batch export" },
    { title: "Visa Operations Desk", focus: "5-Stage pipeline, provider dispatch, e-Visa PDF upload" },
    { title: "Accounting & Finance", focus: "Bank transfer verification, Paystack reconciliation, thermal receipts" },
    { title: "Flight Logistics & Operations", focus: "Package dates, Hijri schedule, color ID badges with QR" },
    { title: "Executive Administration", focus: "Staff permissions, AI Business Assistant, security audit trail" },
  ];

  deptGrid.forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const bx = MARGIN_L + col * 92;
    const by = currentY + row * 22;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, 86, 18, 1.5, 1.5, "FD");

    // Dot Accent
    doc.setFillColor(...COLOR_ORANGE);
    doc.circle(bx + 4.5, by + 5.5, 1.2, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_ROYAL);
    doc.text(d.title, bx + 8, by + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    const lines = doc.splitTextToSize(d.focus, 74);
    for (let li = 0; li < lines.length; li++) {
      doc.text(lines[li], bx + 8, by + 10.2 + li * 3.4);
    }
  });

  // Cover Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setCharSpace(0.2);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("CONFIDENTIAL   |   FOR INTERNAL RAUDAH STAFF TRAINING & OPERATIONAL COMPLIANCE ONLY", PAGE_W / 2, 282, { align: "center" });
  doc.setCharSpace(0);

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2: TABLE OF CONTENTS & OPERATIONAL POLICY
// ═══════════════════════════════════════════════════════════════════════════

function renderTableOfContents() {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setCharSpace(0.1);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("TABLE OF CONTENTS & OPERATIONAL STANDARDS", MARGIN_L, currentY);
  doc.setCharSpace(0);
  currentY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("Master reference index to core system modules, departmental duties, and operational workflows.", MARGIN_L, currentY);
  currentY += 6;

  const tocList = [
    { num: "01", title: "System Architecture & Navigation", scope: "Portals overview, Clerk auth, roles, and console layout", page: "03" },
    { num: "02", title: "Registration & Front-Desk Department", scope: "5-Step walk-in wizard, AI Passport OCR, batch upload, master list", page: "04" },
    { num: "03", title: "Passport & Document Verification", scope: "Saudi 6-month rule, expiry warning flags, photo cropping", page: "05" },
    { num: "04", title: "Visa Operations Department", scope: "5-Stage pipeline, external providers, bulk approvals, e-Visa upload", page: "06" },
    { num: "05", title: "Accounting & Finance Department", scope: "Bank transfer verification, Paystack, balances, receipts", page: "07" },
    { num: "06", title: "Operations, Flights & Logistics", scope: "Package setup, departure dates, printable ID badges with QR", page: "08" },
    { num: "07", title: "Customer Support & Team Communication", scope: "Ticket assignment, priority queues, internal team chat", page: "09" },
    { num: "08", title: "Super Admin, Troubleshooting & Escalations", scope: "Staff roles & granular permissions, troubleshooting, emergency lines", page: "10" },
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Mod", "Operational Module Title", "Summary Scope & Key Workflows", "Page"]],
    body: tocList.map(t => [t.num, t.title, t.scope, t.page]),
    theme: "striped",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7.6,
      textColor: COLOR_TEXT_MAIN,
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { cellWidth: 12, fontStyle: "bold", textColor: COLOR_ORANGE, halign: "center" },
      1: { cellWidth: 62, fontStyle: "bold", textColor: COLOR_ROYAL },
      2: { cellWidth: 92 },
      3: { cellWidth: 12, halign: "center", fontStyle: "bold", textColor: COLOR_NAVY },
    },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 6;

  addCalloutBox(
    "success",
    "Staff Operational Standard: Zero Manual WhatsApp Operations",
    "All pilgrim records, passport photos, payment receipts, and e-visa documents must be uploaded and processed exclusively through the Raudah Web Application. Never store pilgrim passports or banking receipts on personal phones or personal spreadsheets. The application creates immutable audit trails for every transaction."
  );

  addCalloutBox(
    "info",
    "Data Protection & Client Privacy Protocol",
    "Pilgrim National Identification Numbers (NIN), international passport biodata, and home contact details are classified as confidential. Staff members must never export, screenshot, or share pilgrim manifests with third parties outside of verified NAHCON and consular submissions."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 3: MODULE 1 — SYSTEM ARCHITECTURE & NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function renderModule1() {
  addChapterTitle(
    "01",
    "System Architecture & Navigation",
    "Overview of the four synchronized system portals, Clerk authentication, user roles, and Admin Console interface."
  );

  addSectionHeader("1.1 The Four Unified System Portals");
  addParagraph(
    "The Raudah digital platform connects four synchronized portals sharing a central PostgreSQL database and Express API server:"
  );

  addBullet("1. Public Portal (/)", "The public website for marketing, package discovery, company profile, and agent partnership applications.");
  addBullet("2. Pilgrim Self-Service Portal (/dashboard)", "Where pilgrims monitor booking progress, pay online via Paystack, download issued e-visas and flight tickets, and open support tickets.");
  addBullet("3. Agent B2B Portal (/agent)", "Where accredited travel agencies register pilgrim clients with AI Passport OCR, manage commissions, and pay via prepaid wallet.");
  addBullet("4. Admin Operations Console (/admin)", "The operational engine used by Raudah staff across Front-Desk, Visa, Accounting, Logistics, and Management.");

  addSectionHeader("1.2 Staff Role Hierarchy & Access Matrix");

  autoTable(doc, {
    startY: currentY,
    head: [["Staff Role", "Access Level", "Key Operational Permissions", "Safeguard Rules"]],
    body: [
      ["Super Admin", "Total System Access", "Configures site settings, manages bank accounts, creates staff, views all financials", "Full audit logging; irreversible actions protected"],
      ["Admin", "Managerial Control", "Approves visas, overrides package pricing, authorizes agent top-ups", "Cannot delete staff accounts or edit API keys"],
      ["Staff", "Role-Restricted", "Registration, passport review, payment verification, ticketing, support", "Access strictly limited to assigned module permissions"],
      ["Agent", "Agent Portal Only", "Registers pilgrim clients, pays via agent wallet, tracks client visa status", "Isolated strictly to their own registered clients"],
    ],
    theme: "grid",
    headStyles: { fillColor: COLOR_ROYAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2.2 },
    bodyStyles: { fontSize: 7.2, textColor: COLOR_TEXT_MAIN, cellPadding: 2 },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  addSectionHeader("1.3 Navigating the Admin Console");
  addParagraph(
    "Upon signing in at /sign-in with your assigned work email, the Admin Console features an intelligent sidebar organized into five functional groups:"
  );

  addBullet("Main Group", "Platform Overview stats, Business Analytics, and the Gemini AI Business Assistant.");
  addBullet("Operations Group", "Packages catalog, Bookings management, Payments & accounting, Pilgrims master list, and Register Pilgrim wizard.");
  addBullet("Pilgrims & Travel Group", "Printable ID Tags, Passports verification queue, Visa Management console, Amendments review, and AI WhatsApp registrations.");
  addBullet("Agents & Finance Group", "Agent accounts, commission rates, wallet top-ups, and Company Bank Accounts.");
  addBullet("System Group", "User accounts, Customer support tickets, Contact enquiries, Internal Team Chat, Staff management, Audit activity log, and Backup.");

  addCalloutBox(
    "info",
    "Screen Space Tip: Sidebar Collapse Mode",
    "Staff working on laptops can collapse the sidebar using the bottom-left toggle to maximize screen width when inspecting wide manifests. On mobile devices, tap the top menu icon to open the full navigation drawer."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 4: MODULE 2 — REGISTRATION & FRONT-DESK DEPARTMENT
// ═══════════════════════════════════════════════════════════════════════════

function renderModule2() {
  addChapterTitle(
    "02",
    "Registration & Front-Desk Department",
    "Step-by-step walk-in booking wizard, AI Passport OCR, Mahram compliance, batch group upload, and Master Directory management."
  );

  addSectionHeader("2.1 The 5-Step Pilgrim Registration Wizard (/admin/book-pilgrim)");

  addStepCard(
    1,
    "Package Selection & Departure Route",
    "Select the active Hajj or Umrah package. Choose departure date, departure city (e.g. Kano, Abuja, Lagos), and room occupancy preference (Single, Double, Triple, Quad). If booking through an agent, select the agent name."
  );

  addStepCard(
    2,
    "Passport OCR Scan & Automatic Face Crop",
    "Click 'Upload Passport Image' or use the front-desk webcam. Google Gemini AI scans the biodata page and auto-populates passport number, full name, date of birth, expiry date, gender, and nationality in <3 seconds, while cropping a 400x400 portrait photo."
  );

  addStepCard(
    3,
    "Personal & Mahram Compliance Details",
    "Verify extracted fields. Enter Title (Alhaji, Hajiya, etc.), Arabic Name (optional), NIN, occupation, and marital status. MANDATORY: For female pilgrims under 45 traveling under standard rules, assign a registered male relative (Mahram) from the dropdown."
  );

  addStepCard(
    4,
    "Contact & Next of Kin Information",
    "Enter primary phone number (include +234 country code) and email. Input residential address, State of origin, and LGA. Record Next of Kin's full name, relationship, and reachable emergency phone number."
  );

  addStepCard(
    5,
    "Payment Mode & Instant Confirmation",
    "Choose payment method: Cash, Bank Transfer (with receipt upload), or Paystack online. Enter initial deposit amount. Click 'Confirm Booking' to generate the official reference (e.g. RD-2026-UMR-0042) and print registration confirmation vouchers."
  );

  addSectionHeader("2.2 Batch Group Uploads & AI WhatsApp Queue");
  addBullet("Batch Passport Upload", "In /admin/book-pilgrim, click 'Batch Passport Upload' to select up to 20 passport photos at once. The AI parses all files concurrently into an editable table for single-click group registration.");
  addBullet("AI WhatsApp / Telegram Queue", "Pilgrim registrations submitted via Raudah's AI Chatbot appear at /admin/ai-registrations. Staff review duplicate checks and passport photos before clicking 'Approve' to issue active bookings.");

  addCalloutBox(
    "warning",
    "Saudi Mahram Regulations for Female Pilgrims",
    "Saudi consular policy requires that female pilgrims below age 45 traveling without ministerial group waivers must be linked to a recognized Mahram traveling on the same package. The system alerts staff if this field is missing."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 5: MODULE 3 — PASSPORT & DOCUMENT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

function renderModule3() {
  addChapterTitle(
    "03",
    "Passport & Document Verification",
    "Quality standards, the Saudi 6-month validity rule, expiry warning flags, and batch document export."
  );

  addSectionHeader("3.1 The Passports Review Queue (/admin/passports)");
  addParagraph(
    "Every uploaded passport must be vetted before the pilgrim is submitted for visa processing. The Passports queue displays real-time statistics:"
  );

  autoTable(doc, {
    startY: currentY,
    head: [["Status Flag", "Visual Badge", "Meaning & Criteria", "Mandatory Staff Action"]],
    body: [
      ["Valid", "Green (Shield)", "Passport valid for more than 6 months from travel date", "Cleared for visa submission queue"],
      ["Expiring Soon", "Orange (Clock)", "Passport expires within 3 to 6 months", "URGENT: Request immediate passport renewal from pilgrim"],
      ["Expired", "Red (Alert)", "Passport has already passed its expiry date", "STOP: Reject for visa. Pilgrim cannot travel on this document"],
      ["Missing Doc", "Grey (File)", "Pilgrim booked but passport image not yet uploaded", "Follow up with pilgrim or agent via phone/WhatsApp"],
    ],
    theme: "grid",
    headStyles: { fillColor: COLOR_ROYAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2.2 },
    bodyStyles: { fontSize: 7.2, textColor: COLOR_TEXT_MAIN, cellPadding: 2 },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  addSectionHeader("3.2 Consular Image Quality Standards");
  addParagraph("Inspect every uploaded passport against these five mandatory consular standards:");
  addBullet("MRZ Legibility", "All characters on the machine-readable zone (two bottom lines P<NGA...) must be sharp and unbroken.");
  addBullet("No Flash Glare", "Ensure there is no bright white camera flash covering the name, passport number, or date of birth.");
  addBullet("Four Corners Visible", "The entire page must be visible within the frame without cut-off borders.");
  addBullet("Physical Document", "Must be a direct photo of the physical passport, not a screenshot of a photocopy.");
  addBullet("Clear Portrait Crop", "The pilgrim's face crop must be clear, forward-facing, with no sunglasses or tinted lenses.");

  addSectionHeader("3.3 Batch Document Export for Consular Submissions");
  addParagraph(
    "When preparing group submissions for NAHCON or external visa partners: Filter by package -> Select all pilgrims -> Click 'Download Selected Passports' to download a clean ZIP archive of high-resolution passport scans organized by pilgrim name and reference."
  );

  addCalloutBox(
    "info",
    "Staff Action: Pre-Submission Sign-Off",
    "Never mark a passport as 'Verified' if the expiry date falls within 6 months of the return flight date. Saudi border control will reject the pilgrim at immigration and issue severe financial penalties against the agency."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 6: MODULE 4 — VISA OPERATIONS DEPARTMENT
// ═══════════════════════════════════════════════════════════════════════════

function renderModule4() {
  addChapterTitle(
    "04",
    "Visa Operations Department",
    "Managing the end-to-end visa pipeline, external visa providers, bulk approvals, and e-Visa PDF synchronization."
  );

  addSectionHeader("4.1 The Five-Stage Visa Pipeline (/admin/visa-management)");

  autoTable(doc, {
    startY: currentY,
    head: [["Stage", "Badge Color", "Operational Meaning", "Department Protocol"]],
    body: [
      ["Awaiting Payment", "Purple Badge", "Booking created but required deposit or full fee not yet verified", "DO NOT submit for visa. Accounting must verify funds first"],
      ["Pending", "Orange Badge", "Payment verified; passport verified; waiting for provider assignment", "Assign to registered Visa Provider agency"],
      ["Submitted", "Blue Badge", "Passport submitted to Saudi Visa Portal or external service provider", "Monitor application status daily for issuance"],
      ["Approved", "Green Badge", "Visa successfully issued with valid visa number and expiry date", "Upload issued e-Visa PDF and Flight Ticket PDF immediately"],
      ["Rejected", "Red Badge", "Application rejected by consular portal (e.g. overstay, blacklisted, data mismatch)", "Record detailed rejection reason and inform pilgrim/agent"],
    ],
    theme: "grid",
    headStyles: { fillColor: COLOR_NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2.2 },
    bodyStyles: { fontSize: 7.2, textColor: COLOR_TEXT_MAIN, cellPadding: 2 },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  addSectionHeader("4.2 Managing External Visa Providers");
  addParagraph(
    "In the 'Visa Providers' tab, staff register service partners, contact persons, phone numbers, and specializations (e.g., Umrah B2B, Hajj Nuwabs, Tourist e-Visas). When assigning pilgrims, track which provider holds the physical passport and record the provider dispatch date."
  );

  addSectionHeader("4.3 Approving Visas & Uploading Travel Documents (Closing Workflow)");
  addStepCard(1, "Locate Pilgrim Record", "Search by Passport Number, Booking Reference, or filter by active Package.");
  addStepCard(2, "Open Visa Editor", "Click 'Update Visa' on the target row to open the details modal.");
  addStepCard(3, "Enter Official Numbers", "Input the official Visa Number and Visa Expiry Date issued by the Saudi portal.");
  addStepCard(4, "Attach Official Files", "Upload the Visa Document (PDF) and Flight Ticket (PDF) to the secure storage vault.");
  addStepCard(5, "Set Approved & Save", "Change status to 'Approved' and click 'Save'. The pilgrim's dashboard and agent portal immediately update with a green 'Visa Issued' badge and instant PDF download access!");

  addCalloutBox(
    "success",
    "Staff Operational Standard: Mandatory PDF Attachment",
    "Never mark a visa status as 'Approved' without uploading both the issued e-Visa PDF and Flight Ticket PDF. The pilgrim portal relies on these files to display the download button."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 7: MODULE 5 — ACCOUNTING & FINANCE DEPARTMENT
// ═══════════════════════════════════════════════════════════════════════════

function renderModule5() {
  addChapterTitle(
    "05",
    "Accounting & Finance Department",
    "Verifying bank transfers, Paystack audit, outstanding balance management, thermal receipts, and agent wallets."
  );

  addSectionHeader("5.1 Verifying Manual Bank Transfers (/admin/payments)");
  addParagraph(
    "When a pilgrim or agent pays via direct bank transfer, the payment sits in 'Pending Verification' until verified by finance staff:"
  );
  addStepCard(1, "Inspect Payment Proof", "Click the payment row to view the uploaded bank receipt, teller, or mobile app screenshot.");
  addStepCard(2, "Bank Statement Reconciliation", "Log in to Raudah's corporate bank portal (Jaiz Bank, Stanbic IBTC, Zenith) to confirm funds have cleared.");
  addStepCard(3, "Approve or Reject", "If cleared, click 'Verify Payment'. If fraudulent or incorrect amount, click 'Reject' with clear notes.");

  addSectionHeader("5.2 Outstanding Balances & Installment Management");
  addParagraph(
    "Many pilgrims pay in installments. The 'Outstanding Balances' tab displays real-time debt tracking:"
  );
  addBullet("Balance Calculator", "Displays Total Package Price, Total Amount Paid to date, and Outstanding Balance in Nigerian Naira (NGN).");
  addBullet("Progress Bar", "Visual completion percentage (e.g. 25%, 50%, 100% Fully Paid).");
  addBullet("Recording Installments", "Click 'Record Payment' on any pilgrim row. Enter amount paid, payment method (Cash, Bank Transfer, POS), transaction reference, and optional notes.");
  addBullet("Official Receipt Generation", "Click 'Print Receipt' to instantly generate a branded thermal receipt or full A4 payment voucher complete with booking reference, pilgrim name, amount paid, and remaining balance.");

  addSectionHeader("5.3 Company Bank Accounts & Agent Prepaid Wallets");
  addBullet("Bank Accounts Setup (/admin/bank-accounts)", "Ensure company bank details shown on pilgrim invoices remain up to date. Only Accounting and Super Admin staff have access to add, edit, or archive accounts.");
  addBullet("Agent Wallet Top-Ups (/admin/agents)", "When an accredited agency transfers funds to top up their booking balance, verify the bank credit, open /admin/agents -> Select Agent -> Click 'Top-Up Wallet' -> Enter amount and transaction reference.");

  addCalloutBox(
    "warning",
    "Audit Rule: Immutable Transaction Logs",
    "Every payment approval, rejection, and manual balance adjustment is permanently recorded in the system audit log with the operating staff member's timestamp and user ID. Cash collections must be receipted immediately."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 8: MODULE 6 — OPERATIONS, FLIGHTS & LOGISTICS
// ═══════════════════════════════════════════════════════════════════════════

function renderModule6() {
  addChapterTitle(
    "06",
    "Operations, Flights & Logistics",
    "Package creation, flight dates with Hijri calendar, printable ID badges with QR codes, and booking amendments."
  );

  addSectionHeader("6.1 Package Creation & Date Scheduling (/admin/packages)");
  addParagraph(
    "Operations staff configure Hajj and Umrah packages to meet seasonal market demand:"
  );
  addBullet("Package Types", "Hajj, Umrah, Visa Only, Ticket Only, Accommodation Only, or custom combined bundles.");
  addBullet("Departure Dates & Flight Routes", "Set multi-date options with airline partner, outbound route (e.g. KAN -> JED), return route (MED -> KAN), and corresponding Islamic Hijri date.");
  addBullet("Pricing Overrides", "Configure room occupancy surcharges (Single room +NGN 800,000, Double room +NGN 350,000) and child or infant discounts.");
  addBullet("Live Countdown Timer", "Enable countdown timers with automatic registration closure when capacity or deadline is reached.");

  addSectionHeader("6.2 Pilgrim ID Badge & Tag Generator (/admin/id-tags)");
  addParagraph(
    "Before departure, every pilgrim must receive an official Raudah ID Tag for identification in Makkah, Madinah, Mina, and airports:"
  );
  addStepCard(1, "Select Target Package", "Filter by Hajj or Umrah package and departure flight date.");
  addStepCard(2, "Select Pilgrims", "Select individual pilgrims or click 'Select All' for the flight manifest.");
  addStepCard(3, "Automatic Color Coding", "Badges are styled by tier: Gold gradient for Premium/VIP, Silver for Standard/Luxury, and Royal Indigo for Economy.");
  addStepCard(4, "Embedded QR Code", "Each badge features a dynamic QR code that when scanned by staff or Saudi authorities displays pilgrim emergency contacts, hotel details, and medical notes.");
  addStepCard(5, "Print or Export to PDF", "Click 'Print ID Tags' or 'Download PDF' for standard A6 laminator format.");

  addSectionHeader("6.3 Booking Amendments Review (/admin/amendments)");
  addParagraph(
    "Pilgrims may request changes through their dashboard (room upgrades, phone number updates, date changes). Staff review the before/after comparison and approve or reject with explanatory notes."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 9: MODULE 7 — CUSTOMER SUPPORT & TEAM COLLABORATION
// ═══════════════════════════════════════════════════════════════════════════

function renderModule7() {
  addChapterTitle(
    "07",
    "Customer Support & Team Communication",
    "Specialty ticket routing, priority resolution, website inquiries, and internal staff team chat channels."
  );

  addSectionHeader("7.1 Support Ticket Management (/admin/support)");
  addParagraph(
    "Support tickets opened by pilgrims or agents are automatically routed according to staff specialties:"
  );

  autoTable(doc, {
    startY: currentY,
    head: [["Ticket Category", "Assigned Department", "Typical Pilgrim Issues", "Target SLA"]],
    body: [
      ["Payment Issues", "Accounting & Finance", "Transfer receipts, card charge queries, refund requests", "Under 2 Hours"],
      ["Visa Processing", "Visa Operations Desk", "Status inquiries, document resubmission, biometrics info", "Under 4 Hours"],
      ["Flights & Transport", "Flight Logistics", "Flight schedule updates, luggage allowance, seat preferences", "Under 4 Hours"],
      ["Booking Issues", "Front-Desk / Registration", "Name corrections, Mahram changes, room adjustments", "Under 3 Hours"],
      ["General Inquiry", "Customer Care", "Package inclusions, packing tips, vaccination rules", "Under 6 Hours"],
    ],
    theme: "grid",
    headStyles: { fillColor: COLOR_ROYAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2.2 },
    bodyStyles: { fontSize: 7.2, textColor: COLOR_TEXT_MAIN, cellPadding: 2 },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  addSectionHeader("7.2 Internal Team Chat (/admin/chat)");
  addParagraph(
    "To eliminate chaotic WhatsApp groups, Raudah incorporates a secure, internal staff communication platform:"
  );
  addBullet("#flights-transport", "Flight manifests, delays, terminal arrangements, and bus transfers.");
  addBullet("#visa-processing", "Consular quota updates, portal maintenance alerts, and rejected cases.");
  addBullet("#finance-billing", "High-value transfer alerts, refund authorizations, and agent credit limits.");
  addBullet("#accommodation", "Room assignments, hotel check-in lists in Makkah & Madinah.");
  addBullet("#emergency", "Urgent on-ground issues in Saudi Arabia or pre-departure medical alerts.");
  addBullet("Direct Messaging (DMs)", "Private, encrypted 1-on-1 staff conversations for operational coordination.");

  addCalloutBox(
    "info",
    "Pilgrim Service Excellence Standard",
    "Always update ticket statuses promptly to 'In Progress' or 'Resolved'. When answering pilgrims, use warm, respectful tone and sign off with 'Raudah Travels Support Team'."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 10: MODULE 8 & 9 — SUPER ADMIN, TROUBLESHOOTING & EMERGENCY
// ═══════════════════════════════════════════════════════════════════════════

function renderModule8And9() {
  addChapterTitle(
    "08 & 09",
    "Super Admin, Troubleshooting & Escalations",
    "Staff account provisioning, permissions matrix, AI Business Assistant, audit logs, and troubleshooting."
  );

  addSectionHeader("8.1 Staff Provisioning & Permission Matrix (/admin/staff)");
  addParagraph(
    "Super Admins create staff accounts and assign strict page-level permissions: Click 'Invite Staff' -> Enter full name, corporate email, and initial password -> Select role ('Admin' or 'Staff') -> Check only required modules -> Check support categories for automated ticket routing."
  );

  addSectionHeader("8.2 Security Audit Logs (/admin/activity)");
  addParagraph(
    "Every key action (payment verified, visa status changed, booking modified, staff created) is logged with the operator's user ID, IP address, timestamp, and details for complete accountability."
  );

  addSectionHeader("8.3 Staff Troubleshooting & Quick FAQ");

  autoTable(doc, {
    startY: currentY,
    head: [["Symptom / Error", "Root Cause", "Immediate Solution"]],
    body: [
      ["Passport OCR fails / timeout", "Blurry image, heavy glare, or low light", "Ask pilgrim for a flat, well-lit photo or enter details manually"],
      ["Pilgrim cannot see issued visa", "Visa marked approved but PDF not uploaded", "Upload the e-Visa PDF in Visa Management -> click Save"],
      ["Bank transfer not showing verified", "Awaiting accounting reconciliation", "Finance staff must confirm bank credit before verifying"],
      ["Agent cannot book client", "Insufficient prepaid wallet balance", "Agent must transfer funds to Raudah bank and request top-up"],
      ["Session expired error", "Inactivity timeout on Clerk auth", "Refresh browser and sign in again with work email"],
    ],
    theme: "striped",
    headStyles: { fillColor: COLOR_NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, cellPadding: 2.2 },
    bodyStyles: { fontSize: 7.2, textColor: COLOR_TEXT_MAIN, cellPadding: 2 },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 5;

  addCalloutBox(
    "warning",
    "Emergency Operational Contacts & Escalations",
    "For critical system issues, payment gateway discrepancies, or consular emergencies: Contact IT Systems Administration via #emergency chat or call direct lines: 08036264607 / 08034803504. Head Office: City Scape/Shariff Plaza, Wuse 2, Abuja."
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TWO-PASS RUNNING HEADERS & FOOTERS (Page X of Y)
// ═══════════════════════════════════════════════════════════════════════════

function addHeadersAndFooters() {
  const totalPages = doc.internal.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Skip Cover Page
    if (i === 1) continue;

    // Running Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setCharSpace(0.1);
    doc.setTextColor(...COLOR_ROYAL);
    doc.text("RAUDAH TRAVELS & TOURS", MARGIN_L, 12);
    doc.setCharSpace(0);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MUTED);
    const brandW = doc.getTextWidth("RAUDAH TRAVELS & TOURS");
    doc.text("   |   STAFF OPERATIONAL TRAINING MANUAL", MARGIN_L + brandW, 12);

    // Header Right
    doc.setFont("helvetica", "bold");
    doc.setCharSpace(0.15);
    doc.text("VERSION 1.0 (OFFICIAL)", PAGE_W - MARGIN_R, 12, { align: "right" });
    doc.setCharSpace(0);

    // Header Divider Rule (fine hairline 0.3mm)
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, 14.5, PAGE_W - MARGIN_R, 14.5);

    // Running Footer
    doc.line(MARGIN_L, PAGE_H - 13, PAGE_W - MARGIN_R, PAGE_H - 13);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setCharSpace(0.1);
    doc.setTextColor(...COLOR_TEXT_MUTED);

    // Footer Left
    doc.text("CONFIDENTIAL   —   STRICTLY FOR INTERNAL STAFF TRAINING & OPERATIONAL COMPLIANCE", MARGIN_L, PAGE_H - 8.5);
    doc.setCharSpace(0);

    // Footer Right
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN_R, PAGE_H - 8.5, { align: "right" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE & WRITE PDF
// ═══════════════════════════════════════════════════════════════════════════

console.log("Generating redesigned Version 1.0 PDF manual with relaxed line-height and high-contrast badges...");

renderExecutiveCover();
renderTableOfContents();
renderModule1();
renderModule2();
renderModule3();
renderModule4();
renderModule5();
renderModule6();
renderModule7();
renderModule8And9();

addHeadersAndFooters();

const pdfOutput = doc.output();
const pdfBuffer = Buffer.from(pdfOutput, "binary");

fs.writeFileSync(outputPath, pdfBuffer);
fs.writeFileSync(publicOutputPath, pdfBuffer);

// Also copy to brain artifact directory
const brainDir = path.resolve("C:/Users/DEEPMIND/.gemini/antigravity-ide/brain/838d4c92-fb87-4e7b-8715-e788703b0e75");
if (fs.existsSync(brainDir)) {
  fs.writeFileSync(path.join(brainDir, "Raudah_Travels_Staff_Training_Manual.pdf"), pdfBuffer);
}

console.log("PDF Generation Complete!");
console.log(`Saved to docs: ${outputPath}`);
console.log(`Saved to public: ${publicOutputPath}`);
console.log(`Total Pages: ${doc.internal.getNumberOfPages()}`);
