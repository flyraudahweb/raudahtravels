import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const hotelBookingsTable = pgTable("hotel_bookings", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  clerkUserId: text("clerk_user_id"),
  hotelId: text("hotel_id").notNull(),
  hotelName: text("hotel_name").notNull(),
  hotelDestination: text("hotel_destination").notNull(), // "makkah" | "madinah"
  checkIn: text("check_in").notNull(),   // YYYY-MM-DD
  checkOut: text("check_out").notNull(), // YYYY-MM-DD
  nights: integer("nights").notNull().default(1),
  rooms: integer("rooms").notNull().default(1),
  guests: integer("guests").notNull().default(1),
  boardType: text("board_type").default("room_only"), // "room_only" | "breakfast"
  rateType: text("rate_type").default("live_rate"),   // "raudah_direct" | "live_rate"
  totalAmountNgn: text("total_amount_ngn").notNull(),
  paystackReference: text("paystack_reference"),
  paystackStatus: text("paystack_status"),
  bookingStatus: text("booking_status").notNull().default("pending"),
  guestName: text("guest_name"),
  guestEmail: text("guest_email"),
  guestPhone: text("guest_phone"),
  rawHotelData: jsonb("raw_hotel_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type HotelBooking = typeof hotelBookingsTable.$inferSelect;
export type InsertHotelBooking = typeof hotelBookingsTable.$inferInsert;
