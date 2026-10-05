import { registrationDb as db } from "./database";
import { bookingsTable, profilesTable, agentClientsTable, aiRegistrationSubmissionsTable } from "@workspace/db";
import { eq, or, and, sql } from "drizzle-orm";
import {
  normalizePassport,
  normalizePhone,
  normalizeEmail,
  normalizeName,
  normalizeDate,
  similarity,
} from "./normalizers";

export type DuplicateStatus = "no_duplicate_detected" | "possible_duplicate" | "duplicate_confirmed";

export interface DuplicateMatch {
  source: "booking" | "profile" | "agent_client" | "submission";
  id: string;
  reason: string;
  fullName?: string | null;
}

export interface DuplicateCandidate {
  passportNumber?: string | null;
  passportImageHash?: string | null;
  excludeSessionId?: string;
  phone?: string | null;
  email?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
}

export interface DuplicateDetectionResult {
  status: DuplicateStatus;
  matches: DuplicateMatch[];
}

const NAME_SIMILARITY_THRESHOLD = 0.88;

/**
 * Three-tier duplicate detection, run against the existing booking/profile/
 * agent-client tables (no new index of PII — just normalized comparisons).
 *
 * duplicate_confirmed: exact normalized passport, identical passport image
 * hash, or same email with an active booking.
 * possible_duplicate: fuzzy name match (>= 0.88) + matching DOB, or same
 * phone with a different passport.
 * no_duplicate_detected: nothing matched.
 */
export async function detectDuplicate(
  candidate: DuplicateCandidate,
): Promise<DuplicateDetectionResult> {
  const passport = normalizePassport(candidate.passportNumber);
  const phone = normalizePhone(candidate.phone);
  const email = normalizeEmail(candidate.email);
  const name = normalizeName(candidate.fullName);
  const dob = normalizeDate(candidate.dateOfBirth);

  const confirmed: DuplicateMatch[] = [];
  const possible: DuplicateMatch[] = [];

  /* ── Tier: duplicate_confirmed — exact passport number ── */
  if (passport) {
    const bookingMatches = await db
      .select({ id: bookingsTable.id, fullName: bookingsTable.fullName, passportNumber: bookingsTable.passportNumber })
      .from(bookingsTable)
      .where(sql`UPPER(REGEXP_REPLACE(${bookingsTable.passportNumber}, '[^A-Za-z0-9]', '', 'g')) = ${passport}`);
    for (const m of bookingMatches) {
      confirmed.push({ source: "booking", id: m.id, reason: "exact_passport_match", fullName: m.fullName });
    }

    const profileMatches = await db
      .select({ id: profilesTable.id, fullName: profilesTable.fullName, passportNumber: profilesTable.passportNumber })
      .from(profilesTable)
      .where(sql`UPPER(REGEXP_REPLACE(${profilesTable.passportNumber}, '[^A-Za-z0-9]', '', 'g')) = ${passport}`);
    for (const m of profileMatches) {
      confirmed.push({ source: "profile", id: m.id, reason: "exact_passport_match", fullName: m.fullName });
    }

    const agentClientMatches = await db
      .select({ id: agentClientsTable.id, fullName: agentClientsTable.fullName, passportNumber: agentClientsTable.passportNumber })
      .from(agentClientsTable)
      .where(sql`UPPER(REGEXP_REPLACE(${agentClientsTable.passportNumber}, '[^A-Za-z0-9]', '', 'g')) = ${passport}`);
    for (const m of agentClientMatches) {
      confirmed.push({ source: "agent_client", id: m.id, reason: "exact_passport_match", fullName: m.fullName });
    }
  }

  /* ── Tier: duplicate_confirmed — identical passport image hash ── */
  if (candidate.passportImageHash) {
    const rows = await db.select({ id: aiRegistrationSubmissionsTable.id })
      .from(aiRegistrationSubmissionsTable)
      .where(and(eq(aiRegistrationSubmissionsTable.passportImageHash, candidate.passportImageHash),
        candidate.excludeSessionId ? sql`${aiRegistrationSubmissionsTable.sessionId} <> ${candidate.excludeSessionId}` : undefined));
    for (const row of rows) confirmed.push({ source: "submission", id: row.id, reason: "identical_passport_image" });
  }

  if (email) {
    const activeBookings = await db
      .select({ id: bookingsTable.id, fullName: bookingsTable.fullName })
      .from(bookingsTable)
      .where(
        and(
          sql`LOWER(TRIM(${bookingsTable.email})) = ${email}`,
          or(eq(bookingsTable.status, "pending"), eq(bookingsTable.status, "confirmed")),
        ),
      );
    for (const m of activeBookings) {
      confirmed.push({ source: "booking", id: m.id, reason: "same_email_active_booking", fullName: m.fullName });
    }
  }

  if (confirmed.length > 0) {
    return { status: "duplicate_confirmed", matches: dedupe(confirmed) };
  }

  /* ── Tier: possible_duplicate — fuzzy name + matching DOB ── */
  if (name && dob) {
    const dobMatches = await db
      .select({ id: bookingsTable.id, fullName: bookingsTable.fullName, dateOfBirth: bookingsTable.dateOfBirth })
      .from(bookingsTable)
      .where(eq(bookingsTable.dateOfBirth, dob));
    for (const m of dobMatches) {
      const score = similarity(name, normalizeName(m.fullName));
      if (score >= NAME_SIMILARITY_THRESHOLD) {
        possible.push({ source: "booking", id: m.id, reason: `fuzzy_name_dob_match (${score.toFixed(2)})`, fullName: m.fullName });
      }
    }
  }

  /* ── Tier: possible_duplicate — same phone, different passport ── */
  if (phone) {
    const phoneMatches = await db
      .select({ id: bookingsTable.id, fullName: bookingsTable.fullName, passportNumber: bookingsTable.passportNumber, phone: bookingsTable.phone })
      .from(bookingsTable)
      .where(sql`RIGHT(REGEXP_REPLACE(${bookingsTable.phone}, '[^0-9]', '', 'g'), 10) = ${phone}`);
    for (const m of phoneMatches) {
      const existingPassport = normalizePassport(m.passportNumber);
      if (!passport || !existingPassport || existingPassport !== passport) {
        possible.push({ source: "booking", id: m.id, reason: "same_phone_different_passport", fullName: m.fullName });
      }
    }
  }

  for (const [source, table] of [["profile", profilesTable], ["agent_client", agentClientsTable]] as const) {
    if (name && dob) {
      const matches = await db.select({ id: table.id, fullName: table.fullName }).from(table).where(eq(table.dateOfBirth, dob));
      for (const match of matches) {
        if (similarity(name, normalizeName(match.fullName)) >= NAME_SIMILARITY_THRESHOLD) possible.push({ source, id: match.id, fullName: match.fullName, reason: "fuzzy_name_dob_match" });
      }
    }
    if (phone) {
      const matches = await db.select({ id: table.id, fullName: table.fullName, passportNumber: table.passportNumber }).from(table)
        .where(sql`RIGHT(REGEXP_REPLACE(${table.phone}, '[^0-9]', '', 'g'), 10) = ${phone}`);
      for (const match of matches) {
        if (!passport || normalizePassport(match.passportNumber) !== passport) possible.push({ source, id: match.id, fullName: match.fullName, reason: "same_phone_different_passport" });
      }
    }
  }

  if (possible.length > 0) {
    return { status: "possible_duplicate", matches: dedupe(possible) };
  }

  return { status: "no_duplicate_detected", matches: [] };
}

function dedupe(matches: DuplicateMatch[]): DuplicateMatch[] {
  const seen = new Set<string>();
  const out: DuplicateMatch[] = [];
  for (const m of matches) {
    const key = `${m.source}:${m.id}:${m.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(m);
    }
  }
  return out;
}
