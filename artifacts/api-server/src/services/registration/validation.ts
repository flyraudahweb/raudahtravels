import { z } from "zod";

const text = z.string().trim().max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const parsed = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}, "Invalid calendar date");
const optionalDate = z.union([date, z.literal("")]).optional();
export const reviewFieldsSchema = z.object({
  fullName: text.min(2).optional(),
  firstName: text.optional(), lastName: text.optional(),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{7,25}$/).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  passportNumber: z.string().trim().max(30).regex(/^[A-Za-z0-9 -]*$/).optional(),
  passportIssueDate: optionalDate, passportExpiry: optionalDate, dateOfBirth: optionalDate,
  nationality: text.optional(), gender: z.enum(["M", "F", "male", "female", ""]).optional(),
  packageId: z.string().trim().max(100).optional(),
  country: text.optional(), city: text.optional(), address: z.string().trim().max(1000).optional(),
  specialRequests: z.string().trim().max(2000).optional(),
}).strict();
export const approveSchema = reviewFieldsSchema.extend({
  packageDateId: z.string().trim().max(100).optional(),
  agentId: z.string().trim().max(100).optional(),
  duplicateOverrideReason: z.string().trim().min(5).max(1000).optional(),
});
export const rejectSchema = z.object({ reason: z.string().trim().min(3).max(1000) }).strict();

export function extractionFields(data: Record<string, unknown>) {
  return {
    firstName: data.firstName, lastName: data.lastName,
    fullName: [data.firstName, data.lastName].filter(Boolean).join(" "),
    passportNumber: data.documentNumber, nationality: data.nationality,
    dateOfBirth: data.dateOfBirth, gender: data.sex,
    passportIssueDate: data.dateOfIssue, passportExpiry: data.dateOfExpiry,
  };
}
