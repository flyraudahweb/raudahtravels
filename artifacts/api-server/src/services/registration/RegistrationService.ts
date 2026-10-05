import { registrationDb as db, registrationTransaction } from "./database";
import {
  bookingsTable, packagesTable, profilesTable, visaApplicationsTable, packageDatesTable,
  paymentsTable, commissionsTable, agentsTable, agentPackageDiscountsTable,
  siteSettingsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const nullify = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export interface CreateBookingInput {
  packageId: string;
  packageDateId?: string | null;
  agentId?: string | null;
  paymentMethod?: string;
  markVerified?: boolean;
  totalPrice?: number;
  amountPaid?: number;
  paymentReference?: string;
  paymentProofUrl?: string;
  userId?: string;

  civility?: string; firstName?: string; lastName?: string; fullName?: string;
  passportNumber?: string; passportIssueDate?: string; passportExpiry?: string;
  passportIssuingAuthority?: string; passportCopyUrl?: string; profilePhotoUrl?: string;
  dateOfBirth?: string; placeOfBirth?: string; gender?: string; nationality?: string;
  ethnicGroup?: string; maritalStatus?: string; levelOfStudy?: string; visaNumber?: string;
  observation?: string;
  partner?: string; underCover?: string;
  phone?: string; email?: string; country?: string; city?: string; address?: string;
  departureCity?: string; roomPreference?: string; specialRequests?: string;
  emergencyContactName?: string; emergencyContactPhone?: string; emergencyContactRelationship?: string;
  meningitisVaccineDate?: string; fathersName?: string; mothersName?: string;
  mahramName?: string; mahramRelationship?: string; mahramPassport?: string;
  roomSurcharge?: number;
  pilgrimType?: "adult" | "child" | "infant";
  parentBookingId?: string | null;
  batchId?: string | null;
  customCommission?: number;

  /** Who performed this registration (staff profile id), if any */
  registeredByStaffId?: string;
  /** Intake source — defaults to "direct" to preserve existing behavior */
  source?: "direct" | "whatsapp_ai" | "telegram_ai";
  aiSessionId?: string;
  reviewedById?: string;
  duplicateStatus?: string;
  duplicateMatches?: unknown[];
}

export class RegistrationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

/**
 * Shared booking-creation path used by both staff walk-in registration
 * (routes/admin.ts `/admin/book-pilgrim`) and AI-submission approval
 * (routes/ai-registration.ts). Pricing, capacity locking, agent discount /
 * commission, visa application, and payment record creation are identical
 * for both callers — only the caller-supplied fields and attribution differ.
 */
export async function createBooking(input: CreateBookingInput): Promise<{ booking: any; reference: string }> {
  const agentIdValue = nullify(input.agentId) as string | undefined;
  const reference = `RDH-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
  const resolvedFullName = (nullify(input.fullName) as string | undefined)
    || [nullify(input.firstName), nullify(input.lastName)].filter(Boolean).join(" ")
    || undefined;

  let booking: any;

  await registrationTransaction(async () => {
    const tx = db;
    // Row-level lock on the package to prevent overbooking race condition
    const lockResult = await tx.execute(sql`SELECT * FROM packages WHERE id = ${input.packageId} FOR UPDATE`);
    const pkgRow = (lockResult as any).rows?.[0] ?? (Array.isArray(lockResult) ? lockResult[0] : null);
    if (!pkgRow) throw new RegistrationError("Package not found", 400);

    if (input.source && input.source !== "direct" && (pkgRow.status !== "active" || !pkgRow.is_active)) throw new RegistrationError("Package is not available", 400);
    if (pkgRow.capacity && (pkgRow.current_bookings || 0) >= pkgRow.capacity) {
      throw new RegistrationError("Package is fully booked — no more capacity available", 409);
    }

    if (input.packageDateId) {
      const date = await tx.query.packageDatesTable.findFirst({ where: eq(packageDatesTable.id, input.packageDateId) });
      if (!date || date.packageId !== input.packageId) throw new RegistrationError("Package date does not belong to package", 400);
    }
    let price = Number(pkgRow.price);
    const surcharge = Number(input.roomSurcharge) || 0;
    price += surcharge;

    if (input.pilgrimType === "infant" || input.pilgrimType === "child") {
      const pkgOverrides = pkgRow.pricing_overrides || {};
      const hasOverride = input.pilgrimType === "infant" ? pkgOverrides.infantPrice != null : pkgOverrides.childPrice != null;

      if (hasOverride) {
        const overridePrice = input.pilgrimType === "infant" ? Number(pkgOverrides.infantPrice) : Number(pkgOverrides.childPrice);
        if (overridePrice) price += overridePrice;
      } else {
        const pricingSetting = await tx.query.siteSettingsTable.findFirst({
          where: eq(siteSettingsTable.key, "child_infant_pricing"),
        });
        if (pricingSetting && pricingSetting.value) {
          try {
            const pricing = JSON.parse(pricingSetting.value as string);
            if (input.pilgrimType === "infant" && pricing.infantPrice) {
              price += Number(pricing.infantPrice);
            } else if (input.pilgrimType === "child" && pricing.childPrice) {
              price += Number(pricing.childPrice);
            }
          } catch {
            // Ignore parse error
          }
        }
      }
    }

    let commissionAmount = 0;
    let agentRecord: any = null;
    let hasAgentDiscount = false;

    if (agentIdValue) {
      agentRecord = await tx.query.agentsTable.findFirst({ where: eq(agentsTable.id, agentIdValue) });

      const agentDiscount = await tx.query.agentPackageDiscountsTable.findFirst({
        where: sql`${agentPackageDiscountsTable.agentId} = ${agentIdValue} AND ${agentPackageDiscountsTable.packageId} = ${input.packageId}`,
      });
      if (agentDiscount) {
        hasAgentDiscount = true;
        if (agentDiscount.discountType === "percentage") {
          price = Math.round((price - (price * Number(agentDiscount.discountValue) / 100)) * 100) / 100;
        } else {
          price = Math.max(0, price - Number(agentDiscount.discountValue));
        }
      }

      if (agentRecord) {
        if (input.customCommission != null && Number(input.customCommission) >= 0) {
          commissionAmount = Number(input.customCommission);
          price = Math.max(0, price - commissionAmount);
        } else if (!hasAgentDiscount) {
          const commRate = Number(agentRecord.commissionRate);
          if (commRate > 0) {
            commissionAmount = agentRecord.commissionType === "percentage"
              ? Math.round(price * commRate / 100 * 100) / 100
              : Math.min(commRate, price);
            price = Math.max(0, price - commissionAmount);
          }
        }
      }
    }

    let userId = input.userId;
    if (!userId) {
      const walkinUuid = randomUUID();
      const [newProfile] = await tx.insert(profilesTable).values({
        id: randomUUID(),
        clerkUserId: `walkin-${walkinUuid}`,
        email: `walkin-${walkinUuid}@raudah.internal`,
        fullName: input.fullName || "Walk-in Pilgrim",
        role: "user",
      }).returning();
      userId = newProfile.id;
    }

    const markVerified = Boolean(input.markVerified);
    const amountPaidInput = Number(input.amountPaid) || 0;

    [booking] = await tx.insert(bookingsTable).values({
      id: randomUUID(),
      reference,
      userId,
      packageId: input.packageId,
      packageDateId: nullify(input.packageDateId) as string | undefined,
      agentId: nullify(input.agentId) as string | undefined,
      registeredByStaffId: input.registeredByStaffId || undefined,
      status: markVerified && (amountPaidInput || price) >= price ? "confirmed" : "pending",
      totalPrice: String(price),
      amountPaid: markVerified ? String(amountPaidInput || price) : "0",
      pilgrimCount: 1,
      civility: nullify(input.civility) as string | undefined,
      firstName: nullify(input.firstName) as string | undefined,
      lastName: nullify(input.lastName) as string | undefined,
      fullName: resolvedFullName,
      passportNumber: nullify(input.passportNumber) as string | undefined,
      passportIssueDate: nullify(input.passportIssueDate) as string | undefined,
      passportExpiry: nullify(input.passportExpiry) as string | undefined,
      passportIssuingAuthority: nullify(input.passportIssuingAuthority) as string | undefined,
      passportCopyUrl: nullify(input.passportCopyUrl) as string | undefined,
      profilePhotoUrl: nullify(input.profilePhotoUrl) as string | undefined,
      dateOfBirth: nullify(input.dateOfBirth) as string | undefined,
      placeOfBirth: nullify(input.placeOfBirth) as string | undefined,
      gender: nullify(input.gender) as string | undefined,
      nationality: nullify(input.nationality) as string | undefined,
      ethnicGroup: nullify(input.ethnicGroup) as string | undefined,
      maritalStatus: nullify(input.maritalStatus) as string | undefined,
      levelOfStudy: nullify(input.levelOfStudy) as string | undefined,
      visaNumber: nullify(input.visaNumber) as string | undefined,
      observation: nullify(input.observation) as string | undefined,
      partner: nullify(input.partner) as string | undefined,
      underCover: nullify(input.underCover) as string | undefined,
      phone: nullify(input.phone) as string | undefined,
      email: nullify(input.email) as string | undefined,
      country: nullify(input.country) as string | undefined,
      city: nullify(input.city) as string | undefined,
      address: nullify(input.address) as string | undefined,
      departureCity: nullify(input.departureCity) as string | undefined,
      roomPreference: nullify(input.roomPreference) as string | undefined,
      specialRequests: nullify(input.specialRequests) as string | undefined,
      emergencyContactName: nullify(input.emergencyContactName) as string | undefined,
      emergencyContactPhone: nullify(input.emergencyContactPhone) as string | undefined,
      emergencyContactRelationship: nullify(input.emergencyContactRelationship) as string | undefined,
      meningitisVaccineDate: nullify(input.meningitisVaccineDate) as string | undefined,
      fathersName: nullify(input.fathersName) as string | undefined,
      mothersName: nullify(input.mothersName) as string | undefined,
      mahramName: nullify(input.mahramName) as string | undefined,
      mahramRelationship: nullify(input.mahramRelationship) as string | undefined,
      mahramPassport: nullify(input.mahramPassport) as string | undefined,
      roomSurcharge: String(surcharge),
      pilgrimType: input.pilgrimType || "adult",
      parentBookingId: nullify(input.parentBookingId) as string | undefined,
      batchId: nullify(input.batchId) as string | undefined,
      source: input.source || "direct",
      aiSessionId: nullify(input.aiSessionId) as string | undefined,
      reviewStatus: input.aiSessionId ? "approved" : undefined,
      reviewedById: input.reviewedById,
      reviewedAt: input.aiSessionId ? new Date() : undefined,
      duplicateStatus: input.duplicateStatus,
      duplicateMatches: input.duplicateMatches,
    }).returning();

    await tx.update(packagesTable)
      .set({ currentBookings: sql`${packagesTable.currentBookings} + 1` })
      .where(eq(packagesTable.id, input.packageId));

    const isFullyPaid = Number(booking.amountPaid) >= price;
    if (markVerified && isFullyPaid) {
      await tx.execute(sql`
        UPDATE bookings
        SET id_number = nextval('bookings_id_number_seq')
        WHERE id = ${booking.id} AND id_number IS NULL
      `);
    }

    const existingVisa = await tx.query.visaApplicationsTable.findFirst({
      where: eq(visaApplicationsTable.bookingId, booking.id),
    });
    if (!existingVisa) {
      await tx.insert(visaApplicationsTable).values({
        id: randomUUID(),
        bookingId: booking.id,
        pilgrimName: booking.fullName ?? null,
        passportNumber: booking.passportNumber ?? null,
        status: (markVerified && isFullyPaid) ? "pending" : "awaiting_payment",
      });
    }

    const initialAmountPaid = Number(booking.amountPaid);
    if (initialAmountPaid > 0) {
      await tx.insert(paymentsTable).values({
        id: randomUUID(),
        bookingId: booking.id,
        userId: booking.userId,
        amount: String(initialAmountPaid),
        method: (input.paymentMethod || "cash") as "paystack" | "bank_transfer" | "ussd" | "cash" | "wallet",
        status: markVerified ? "verified" : "pending",
        reference: input.paymentReference || `INIT-${booking.reference}`,
        proofUrl: input.paymentProofUrl || null,
        notes: agentIdValue ? "Initial payment during admin-agent registration" : "Initial payment during registration",
      });
    }

    if (agentIdValue && commissionAmount > 0) {
      await tx.insert(commissionsTable).values({
        id: randomUUID(),
        agentId: agentIdValue,
        bookingId: booking.id,
        amount: String(commissionAmount),
        status: "pending",
      });
    }
  });

  return { booking, reference };
}
