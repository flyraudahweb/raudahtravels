import {
  pgTable,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const flightBookingsTable = pgTable("flight_bookings", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clerkUserId: text("clerk_user_id"),
  duffelOrderId: text("duffel_order_id").unique(),
  pnr: text("pnr"),
  passengerName: text("passenger_name").notNull(),
  passengerEmail: text("passenger_email"),
  passengerPhone: text("passenger_phone"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  departureAt: text("departure_at"),
  arrivalAt: text("arrival_at"),
  airline: text("airline"),
  airlineCode: text("airline_code"),
  totalAmountGbp: text("total_amount_gbp"),
  totalAmountNgn: text("total_amount_ngn"),
  exchangeRate: text("exchange_rate").default("1818.56"),
  currency: text("currency").default("GBP"),
  paystackReference: text("paystack_reference"),
  paystackStatus: text("paystack_status"),
  bookingStatus: text("booking_status").default("pending").notNull(),
  rawDuffelData: jsonb("raw_duffel_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FlightBooking = typeof flightBookingsTable.$inferSelect;
