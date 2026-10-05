/**
 * Raudah Travels & Tours — Staff Operational Training Manual & Handbook
 * Version 1.0 (Official Release)
 *
 * Ultra-professional, clean, publication-grade executive handbook generator.
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
const MARGIN_L = 18;
const MARGIN_R = 18;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R; // 174 mm
const TOP_MARGIN = 24;
const BOTTOM_MARGIN = 22;

// Premium Corporate Color Palette
const COLOR_NAVY = [28, 31, 102];       // #1C1F66 Dark Corporate Indigo
const COLOR_ROYAL = [45, 49, 153];      // #2D3199 Brand Royal Indigo
const COLOR_ORANGE = [255, 59, 0];      // #FF3B00 Brand Accent Orange
const COLOR_GOLD = [180, 130, 40];      // #B48228 Elegant Gold accent
const COLOR_TEXT_MAIN = [30, 41, 59];   // #1E293B Slate 800 (Clean, high contrast)
const COLOR_TEXT_MUTED = [100, 116, 139];// #64748B Slate 500 (Soft grey)
const COLOR_BG_CARD = [248, 250, 252];  // #F8FAFC Ultra-light background
const COLOR_BORDER = [226, 232, 240];   // #E2E8F0 Subtle border
const COLOR_SUCCESS = [16, 185, 129];   // #10B981 Emerald
const COLOR_WARNING = [245, 158, 11];   // #F59E0B Amber
const COLOR_DANGER = [239, 68, 68];     // #EF4444 Red

let currentY = TOP_MARGIN;

// Logo Base64
let logoDataUrl = null;
try {
  const logoBuf = fs.readFileSync("./logo.png");
  logoDataUrl = "data:image/png;base64," + logoBuf.toString("base64");
} catch (e) {
  console.warn("Could not read logo.png:", e.message);
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
  checkPageBreak(40);

  // Small Top Tag
  doc.setFillColor(...COLOR_ROYAL);
  doc.roundedRect(MARGIN_L, currentY, 26, 5.5, 1.2, 1.2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`MODULE ${modNum}`, MARGIN_L + 3.2, currentY + 3.9);

  currentY += 9;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(title, MARGIN_L, currentY);
  currentY += 5.5;

  // Summary
  if (summary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    const lines = doc.splitTextToSize(summary, CONTENT_W);
    doc.text(lines, MARGIN_L, currentY);
    currentY += lines.length * 4.2 + 4;
  }

  // Elegant divider rule
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_L, currentY, MARGIN_L + CONTENT_W, currentY);

  // Tiny orange accent tick
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(MARGIN_L, currentY - 0.4, 18, 0.8, "F");

  currentY += 6;
}

// Helper: Section Header (H2)
function addSectionHeader(title) {
  checkPageBreak(18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_ROYAL);

  // Left vertical accent bar
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(MARGIN_L, currentY - 3.2, 1.8, 4.5, "F");

  doc.text(title, MARGIN_L + 4, currentY);
  currentY += 5.5;
}

// Helper: Sub-Section Header (H3)
function addSubSectionHeader(title) {
  checkPageBreak(12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(title, MARGIN_L, currentY);
  currentY += 4.5;
}

// Helper: Standard Paragraph
function addParagraph(text, extraSpacing = 2.5) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_TEXT_MAIN);
  const lines = doc.splitTextToSize(text, CONTENT_W);
  checkPageBreak(lines.length * 4.1 + extraSpacing);
  doc.text(lines, MARGIN_L, currentY);
  currentY += lines.length * 4.1 + extraSpacing;
}

// Helper: Bullet Point with Bold Tag
function addBullet(tag, text, indent = 4) {
  doc.setFontSize(8.5);
  const textW = CONTENT_W - indent;
  const fullText = tag ? `${tag}: ${text}` : text;
  const lines = doc.splitTextToSize(fullText, textW);

  checkPageBreak(lines.length * 4.1 + 1.8);

  // Crisp diamond or circle bullet
  doc.setFillColor(...COLOR_ROYAL);
  doc.circle(MARGIN_L + indent / 2, currentY - 1.1, 0.8, "F");

  if (tag) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_NAVY);
    doc.text(`${tag}: `, MARGIN_L + indent, currentY);

    const tagWidth = doc.getTextWidth(`${tag}: `);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MAIN);

    const firstLine = doc.splitTextToSize(text, textW - tagWidth)[0] || "";
    doc.text(firstLine, MARGIN_L + indent + tagWidth, currentY);

    if (lines.length > 1) {
      const remaining = lines.slice(1);
      doc.text(remaining, MARGIN_L + indent, currentY + 4.1);
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MAIN);
    doc.text(lines, MARGIN_L + indent, currentY);
  }

  currentY += lines.length * 4.1 + 1.8;
}

// Helper: Styled Process Step Card
function addStepCard(stepNumber, stepTitle, instructions) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const textLines = doc.splitTextToSize(instructions, CONTENT_W - 20);
  const cardHeight = Math.max(15, textLines.length * 4.1 + 9);

  checkPageBreak(cardHeight + 3);

  // Outer Card
  doc.setFillColor(...COLOR_BG_CARD);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, currentY, CONTENT_W, cardHeight, 1.8, 1.8, "FD");

  // Step Number Badge (Pill)
  doc.setFillColor(...COLOR_ROYAL);
  doc.roundedRect(MARGIN_L + 3.5, currentY + 3.5, 9, 8.5, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(String(stepNumber), MARGIN_L + 8 - doc.getTextWidth(String(stepNumber)) / 2, currentY + 9.2);

  // Step Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_NAVY);
  doc.text(stepTitle, MARGIN_L + 15, currentY + 6.2);

  // Step Content
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MAIN);
  doc.text(textLines, MARGIN_L + 15, currentY + 10.8);

  currentY += cardHeight + 3;
}

// Helper: Refined Callout Box
function addCalloutBox(type, header, message) {
  let bg = [240, 244, 255];      // Indigo light
  let bar = COLOR_ROYAL;
  let textTitle = COLOR_ROYAL;
  let tag = "OPERATIONAL NOTE";

  if (type === "warning") {
    bg = [255, 247, 237];        // Warm Orange light
    bar = COLOR_ORANGE;
    textTitle = [194, 65, 12];
    tag = "MANDATORY COMPLIANCE";
  } else if (type === "success") {
    bg = [240, 253, 244];        // Emerald light
    bar = COLOR_SUCCESS;
    textTitle = [4, 120, 87];
    tag = "STAFF BEST PRACTICE";
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const msgLines = doc.splitTextToSize(message, CONTENT_W - 14);
  const boxH = msgLines.length * 3.9 + 10;

  checkPageBreak(boxH + 3);

  // Box background
  doc.setFillColor(...bg);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, currentY, CONTENT_W, boxH, 1.8, 1.8, "FD");

  // Solid left indicator bar
  doc.setFillColor(...bar);
  doc.rect(MARGIN_L, currentY, 2.5, boxH, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...textTitle);
  doc.text(`[${tag}]  ${header}`, MARGIN_L + 6, currentY + 5.2);

  // Message
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_MAIN);
  doc.text(msgLines, MARGIN_L + 6, currentY + 9.5);

  currentY += boxH + 3.5;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1: EXECUTIVE COVER PAGE
// ═══════════════════════════════════════════════════════════════════════════

function renderExecutiveCover() {
  // Top Navy Header Bar (Sleek 115mm deep)
  doc.setFillColor(...COLOR_NAVY);
  doc.rect(0, 0, PAGE_W, 115, "F");

  // Crisp Accent Strip (Gold & Orange dual line)
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(0, 113, PAGE_W, 1, "F");
  doc.setFillColor(...COLOR_ORANGE);
  doc.rect(0, 114, PAGE_W, 1.5, "F");

  // Logo in Top Card (aspect ratio 1.93: 56mm x 29mm)
  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(MARGIN_L, 16, 64, 32, 2.5, 2.5, "F");
      doc.addImage(logoDataUrl, "PNG", MARGIN_L + 4, 18, 56, 28);
    } catch (e) {
      console.warn("Error rendering cover logo:", e);
    }
  }

  // Official Compliance Chip
  doc.setFillColor(255, 255, 255, 0.12);
  doc.setDrawColor(255, 255, 255, 0.25);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN_L, 56, 92, 6.5, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("NAHCON LICENSED OPERATOR  •  NIGERIA & SAUDI ARABIA", MARGIN_L + 4, 60.5);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("STAFF OPERATIONAL", MARGIN_L, 75);
  doc.setTextColor(255, 120, 80); // Bright warm coral
  doc.text("TRAINING MANUAL", MARGIN_L, 84);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(220, 228, 245);
  doc.text("Standard Operating Procedures (SOP) & Comprehensive System Handbook", MARGIN_L, 93);

  // Version 1.0 Highlight Badge (Exact user specification: "version is 1 not 2")
  doc.setFillColor(...COLOR_ORANGE);
  doc.roundedRect(MARGIN_L, 98, 38, 7, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("VERSION 1.0 (OFFICIAL)", MARGIN_L + 4, 102.8);

  // Lower Half: Crisp White Background with Cards
  currentY = 128;

  // Metadata Card
  doc.setFillColor(...COLOR_BG_CARD);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN_L, currentY, CONTENT_W, 34, 2.5, 2.5, "FD");

  const metaData = [
    { label: "ORGANIZATION", val: "Raudah Travels & Tours Limited" },
    { label: "HEAD OFFICE", val: "City Scape/Shariff Plaza, Wuse 2, Abuja" },
    { label: "DOCUMENT REF", val: "RTT-SOP-2026-V1.0" },
    { label: "DATE OF ISSUE", val: "October 2026" },
  ];

  metaData.forEach((m, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = MARGIN_L + 6 + col * 88;
    const y = currentY + 7.5 + row * 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(m.label, x, y);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_NAVY);
    doc.text(m.val, x, y + 4.5);
  });

  currentY += 43;

  // Department Grid Preview
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("Operational Department Modules Covered in this Edition:", MARGIN_L, currentY);
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
    const bx = MARGIN_L + col * 90;
    const by = currentY + row * 22;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, by, 84, 18, 1.8, 1.8, "FD");

    // Dot Accent
    doc.setFillColor(...COLOR_ORANGE);
    doc.circle(bx + 4.5, by + 5.5, 1.3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_ROYAL);
    doc.text(d.title, bx + 8, by + 6.2);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);
    const lines = doc.splitTextToSize(d.focus, 72);
    doc.text(lines, bx + 8, by + 10.5);
  });

  currentY += 3 * 22 + 10;

  // Cover Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("CONFIDENTIAL  •  FOR INTERNAL RAUDAH STAFF TRAINING & COMPLIANCE ONLY", PAGE_W / 2, 282, { align: "center" });

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2: TABLE OF CONTENTS & QUICK-START POLICY
// ═══════════════════════════════════════════════════════════════════════════

function renderTableOfContents() {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_NAVY);
  doc.text("TABLE OF CONTENTS", MARGIN_L, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text("Master reference guide to system functions, departmental responsibilities, and operational workflows.", MARGIN_L, currentY);
  currentY += 7;

  const tocList = [
    { num: "01", title: "System Architecture & Login", scope: "Portals overview, Clerk auth, roles, and console layout", page: "03" },
    { num: "02", title: "Registration & Front-Desk Department", scope: "Walk-in wizard, AI Passport OCR, batch upload, master list", page: "04" },
    { num: "03", title: "Passport & Document Verification", scope: "Saudi 6-month rule, expiry warning flags, photo cropping", page: "06" },
    { num: "04", title: "Visa Operations Department", scope: "Status pipeline, external providers, bulk approvals, e-Visa upload", page: "07" },
    { num: "05", title: "Accounting & Finance Department", scope: "Bank transfer verification, Paystack, balances, receipts", page: "09" },
    { num: "06", title: "Operations, Flights & Logistics", scope: "Package setup, departure dates, printable ID badges with QR", page: "11" },
    { num: "07", title: "Customer Support & Team Communication", scope: "Ticket assignment, priority queues, internal team chat", page: "13" },
    { num: "08", title: "Super Admin & Executive Tools", scope: "Staff roles & granular permissions, AI Assistant, audit logs", page: "14" },
    { num: "09", title: "Troubleshooting Guide & Escalations", scope: "Common error resolution, emergency procedures, contacts", page: "15" },
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Mod", "Operational Module Title", "Summary Scope & Workflows", "Page"]],
    body: tocList.map(t => [t.num, t.title, t.scope, t.page]),
    theme: "striped",
    headStyles: {
      fillColor: COLOR_NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLOR_TEXT_MAIN,
      cellPadding: 2.3,
    },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: "bold", textColor: COLOR_ORANGE, halign: "center" },
      1: { cellWidth: 60, fontStyle: "bold", textColor: COLOR_ROYAL },
      2: { cellWidth: 86 },
      3: { cellWidth: 14, halign: "center", fontStyle: "bold", textColor: COLOR_NAVY },
    },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  addCalloutBox(
    "success",
    "Staff Operational Standard: Zero Manual WhatsApp Operations",
    "All pilgrim records, passport photos, payment receipts, and e-visa documents must be uploaded and processed exclusively through the Raudah Web Application. Never store pilgrim passports or banking receipts on personal phones or personal spreadsheets. The application creates immutable audit trails for every transaction."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 1: SYSTEM ARCHITECTURE & NAVIGATION
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
  addParagraph(
    "Every staff account is created by Super Admin and assigned strict page-level permissions to safeguard financial and pilgrim data:"
  );

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
    headStyles: { fillColor: COLOR_ROYAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT_MAIN },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 7;

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
    "Staff working on laptops can collapse the sidebar using the toggle at the bottom-left to maximize screen width when inspecting wide pilgrim manifests. On mobile devices, tap the top menu icon to open the full navigation drawer."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 2: REGISTRATION & FRONT-DESK DEPARTMENT
// ═══════════════════════════════════════════════════════════════════════════

function renderModule2() {
  addChapterTitle(
    "02",
    "Registration & Front-Desk Department",
    "Step-by-step walk-in booking wizard, AI Passport OCR, Mahram compliance, batch group upload, and Master Directory management."
  );

  addSectionHeader("2.1 The 5-Step Pilgrim Registration Wizard (/admin/book-pilgrim)");
  addParagraph(
    "When a walk-in or telephone pilgrim registers, follow this exact 5-step wizard to ensure complete compliance:"
  );

  addStepCard(
    1,
    "Package Selection & Departure Route",
    "Select the active Hajj or Umrah package. Choose the departure flight date, departure city (e.g. Kano, Abuja, Lagos), and room occupancy preference (Single, Double, Triple, Quad). If booking through an agent, select the agent name."
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

  addCalloutBox(
    "warning",
    "Saudi Mahram Regulations for Female Pilgrims",
    "Saudi consular policy requires that female pilgrims below age 45 traveling without special ministerial group waivers must be linked to a recognized Mahram traveling on the same package. The system alerts staff if this field is missing."
  );

  addSectionHeader("2.2 Batch Passport Registration for Groups & Families");
  addParagraph(
    "For tour groups, corporate delegations, or families, do not register pilgrims one by one. In /admin/book-pilgrim, click 'Batch Passport Upload':"
  );
  addBullet("Step 1", "Select multiple passport images from your computer (up to 20 files at once).");
  addBullet("Step 2", "The AI parses all passports concurrently and displays an editable summary table.");
  addBullet("Step 3", "Review all pilgrims in the grid, make any quick corrections, and select a shared package & departure date.");
  addBullet("Step 4", "Click 'Register All Pilgrims' to create linked booking records with individual reference numbers.");

  addSectionHeader("2.3 Reviewing AI WhatsApp / Telegram Submissions (/admin/ai-registrations)");
  addParagraph(
    "Pilgrims and agents can initiate registrations via Raudah's AI Chatbot on WhatsApp or Telegram. These arrive in the AI Registrations queue:"
  );
  addBullet("1. Duplicate Alert", "The system flags duplicate passport numbers or names before approval (possible_duplicate / duplicate_confirmed).");
  addBullet("2. Document Inspection", "Inspect the raw passport photo sent by the user alongside the extracted fields.");
  addBullet("3. Approval", "Click 'Approve' to promote the submission into an active booking. The pilgrim receives an automatic WhatsApp confirmation.");

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 3: PASSPORT & DOCUMENT VERIFICATION
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
    headStyles: { fillColor: COLOR_ROYAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT_MAIN },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 7;

  addSectionHeader("3.2 Consular Image Quality Standards");
  addParagraph("Inspect every uploaded passport against these five mandatory consular standards:");
  addBullet("MRZ Legibility", "All characters on the machine-readable zone (two bottom lines P<NGA...) must be sharp and unbroken.");
  addBullet("No Flash Glare", "Ensure there is no bright white camera flash covering the name, passport number, or date of birth.");
  addBullet("Four Corners Visible", "The entire page must be visible within the frame without cut-off borders.");
  addBullet("Physical Document", "Must be a direct photo of the physical passport, not a screenshot of a photocopy.");
  addBullet("Clear Portrait Crop", "The pilgrim's face crop must be clear, forward-facing, with no sunglasses or tinted lenses.");

  addSectionHeader("3.3 Batch Exporting Documents for Consular Submissions");
  addParagraph(
    "When preparing group submissions for NAHCON or external visa partners: Filter by package -> Select all pilgrims -> Click 'Download Selected Passports' to download a clean ZIP archive of high-resolution passport scans organized by pilgrim name and reference."
  );

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 4: VISA OPERATIONS DEPARTMENT
// ═══════════════════════════════════════════════════════════════════════════

function renderModule4() {
  addChapterTitle(
    "04",
    "Visa Operations Department",
    "Managing the end-to-end visa pipeline, external visa providers, bulk approvals, and e-Visa PDF synchronization."
  );

  addSectionHeader("4.1 The Five-Stage Visa Pipeline (/admin/visa-management)");
  addParagraph(
    "The Visa Management console tracks every pilgrim from initial registration through final visa issuance:"
  );

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
    headStyles: { fillColor: COLOR_NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT_MAIN },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 7;

  addSectionHeader("4.2 Managing External Visa Providers");
  addParagraph(
    "Raudah works with specialized visa processing partners. In the 'Visa Providers' tab, staff can register providers, contact persons, phone numbers, and specializations (e.g., Umrah B2B, Hajj Nuwabs, Tourist e-Visas). When assigning pilgrims, track which provider holds the physical passport."
  );

  addSectionHeader("4.3 Approving Visas & Uploading Travel Documents (Closing Workflow)");
  addParagraph(
    "When issued e-visas and tickets are received from the consular portal:"
  );
  addStepCard(1, "Locate Pilgrim Record", "Search by Passport Number, Booking Reference, or filter by Package.");
  addStepCard(2, "Open Visa Editor", "Click 'Update Visa' on the target row to open the details modal.");
  addStepCard(3, "Enter Official Numbers", "Input the official Visa Number and Visa Expiry Date issued by the Saudi portal.");
  addStepCard(4, "Attach Official Files", "Upload the Visa Document (PDF) and Flight Ticket (PDF). These are stored securely in cloud storage.");
  addStepCard(5, "Set Approved & Save", "Change status to 'Approved' and click 'Save'. The pilgrim's dashboard and agent portal immediately update with a green 'Visa Issued' badge and instant PDF download access!");

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 5: ACCOUNTING & FINANCE DEPARTMENT
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
  addStepCard(2, "Bank Statement Reconciliation", "Log in to Raudah's corporate bank portal (e.g., Jaiz Bank, Stanbic IBTC, Zenith) to confirm funds have cleared.");
  addStepCard(3, "Approve or Reject", "If cleared, click 'Verify Payment'. If fraudulent or incorrect amount, click 'Reject' with clear notes.");

  addSectionHeader("5.2 Outstanding Balances & Installment Management");
  addParagraph(
    "Many pilgrims pay in installments. The 'Outstanding Balances' tab displays real-time debt tracking:"
  );
  addBullet("Balance Calculator", "Displays Total Package Price, Total Amount Paid to date, and Outstanding Balance in Nigerian Naira (NGN).");
  addBullet("Progress Bar", "Visual completion percentage (e.g. 25%, 50%, 100% Fully Paid).");
  addBullet("Recording Installments", "Click 'Record Payment' on any pilgrim row. Enter amount paid, payment method (Cash, Bank Transfer, POS), transaction reference, and optional notes.");
  addBullet("Official Receipt Generation", "Click 'Print Receipt' to instantly generate a branded thermal receipt or full A4 payment voucher complete with booking reference, pilgrim name, amount paid, and remaining balance.");

  addSectionHeader("5.3 Managing Company Bank Accounts (/admin/bank-accounts)");
  addParagraph(
    "Ensure bank details shown to pilgrims on invoices and the public portal remain up to date. Only Accounting and Super Admin staff have access to add, edit, or archive bank accounts (Account Name, Bank Name, Account Number, Currency)."
  );

  addSectionHeader("5.4 Travel Agent Wallet Management & Commissions (/admin/agents)");
  addParagraph(
    "Accredited agents maintain a prepaid wallet to pay for client bookings seamlessly:"
  );
  addBullet("Wallet Top-Ups", "When an agent transfers funds to Raudah's account for their wallet: go to /admin/agents -> Select Agent -> Click 'Top-Up Wallet' -> Enter amount and reference.");
  addBullet("Double-Entry Audit Ledger", "Every debit and credit transaction is permanently recorded with timestamps and operator IDs.");
  addBullet("Commission Payouts", "Track commissions earned per package and mark payouts when settled.");

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 6: OPERATIONS, FLIGHTS & LOGISTICS
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
  addBullet("Pricing Overrides", "Configure room occupancy surcharges (Single room +₦800,000, Double room +₦350,000) and child/infant discounts.");
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
// MODULE 7: CUSTOMER SUPPORT & TEAM COLLABORATION
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
    headStyles: { fillColor: COLOR_ROYAL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT_MAIN },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 7;

  addSectionHeader("7.2 Internal Team Chat (/admin/chat)");
  addParagraph(
    "To eliminate chaotic WhatsApp groups, Raudah incorporates a secure, internal staff communication platform:"
  );
  addBullet("#flights-transport", "Flight manifests, delays, terminal arrangements, and bus transfers.");
  addBullet("#visa-processing", "Consular quota updates, portal maintenance alerts, and rejected cases.");
  addBullet("#finance-billing", "High-value transfer alerts, refund authorizations, and agent credit limits.");
  addBullet("#accommodation", "Room assignments, hotel check-in lists in Makkah & Madinah.");
  addBullet("#emergency", "Urgent on-ground issues in Saudi Arabia or pre-departure medical alerts.");
  addBullet("Direct Messaging (DMs)", "Private, encrypted 1-on-1 staff conversations.");

  doc.addPage();
  currentY = TOP_MARGIN;
}

// ═══════════════════════════════════════════════════════════════════════════
// MODULE 8 & 9: SUPER ADMIN, TROUBLESHOOTING & EMERGENCY
// ═══════════════════════════════════════════════════════════════════════════

function renderModule8And9() {
  addChapterTitle(
    "08",
    "Super Admin, Security & Troubleshooting",
    "Staff account provisioning, permissions matrix, AI Business Assistant, audit logs, and troubleshooting."
  );

  addSectionHeader("8.1 Creating Staff & Assigning Permissions (/admin/staff)");
  addParagraph(
    "Super Admins create staff accounts and assign strict page-level permissions:"
  );
  addStepCard(1, "Click 'Invite Staff'", "Enter full name, corporate email address, and initial temporary password.");
  addStepCard(2, "Select Role", "Choose 'Admin' or 'Staff'.");
  addStepCard(3, "Assign Page Permissions", "Check only the modules required for their daily duties (e.g. Visa staff receive: pilgrims, passports, visa_management).");
  addStepCard(4, "Assign Support Specialties", "Check support categories so pilgrim tickets route directly to them.");

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
    headStyles: { fillColor: COLOR_NAVY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: COLOR_TEXT_MAIN },
    margin: { left: MARGIN_L, right: MARGIN_R },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  addCalloutBox(
    "warning",
    "Emergency Operational Contacts & Escalations",
    "For critical system issues, payment gateway discrepancies, or consular emergencies: Contact IT Systems Administration via #emergency chat or call 08036264607 / 08034803504."
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
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_ROYAL);
    doc.text("RAUDAH TRAVELS & TOURS", MARGIN_L, 13);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(" •  STAFF OPERATIONAL TRAINING MANUAL", MARGIN_L + doc.getTextWidth("RAUDAH TRAVELS & TOURS"), 13);

    // Header Right
    doc.text("VERSION 1.0", PAGE_W - MARGIN_R, 13, { align: "right" });

    // Header Divider Rule (fine 0.3mm hairline)
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_L, 15, PAGE_W - MARGIN_R, 15);

    // Running Footer
    doc.line(MARGIN_L, PAGE_H - 14, PAGE_W - MARGIN_R, PAGE_H - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_MUTED);

    // Footer Left
    doc.text("CONFIDENTIAL  •  STRICTLY FOR INTERNAL STAFF TRAINING & COMPLIANCE", MARGIN_L, PAGE_H - 9);

    // Footer Right
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${i} of ${totalPages}`, PAGE_W - MARGIN_R, PAGE_H - 9, { align: "right" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILE & WRITE PDF
// ═══════════════════════════════════════════════════════════════════════════

console.log("Generating redesigned Version 1.0 PDF manual...");

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
