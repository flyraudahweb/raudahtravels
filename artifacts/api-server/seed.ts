import { db, pool, packagesTable } from "@workspace/db";
import pg from "pg";

const rawPackages = [
  {"id":"PKG-HAJJ-2026-001","name":"Hajj 2026 — The Ultimate Journey","type":"hajj","description":"Experience the spiritual pinnacle of a lifetime with our all-inclusive Hajj 2026 package. Fly with EgyptAir or Saudi Airlines and stay in premium 4-star hotels within walking distance of the Haram. Covers all pillars of Hajj with expert Nigerian guides, pre-departure training, and every essential included.","price":"7800000.00","deposit_amount":"2000000.00","duration_days":42,"departure_date":"2026-06-01","return_date":"2026-07-12","max_capacity":200,"current_bookings":49,"inclusions":["Visa processing","Return flight ticket","Ground transportation in Saudi Arabia","Accommodation in Makkah and Madinah","Breakfast daily","Ziyarat tours","Pre-departure training","Hajj guidebook","Travel bag and essentials"],"image_url":null,"is_active":true,"star_rating":4,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-03T03:32:46.070Z","category":"premium","season":null,"agent_discount":"500000.00","departure_cities":["Abuja","Kano","Lagos"],"airlines":["EgyptAir","Saudi Airlines"],"is_featured":true,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":200,"featured":true,"status":"active","countdown_enabled":true,"countdown_expiry":"2026-05-04T01:12","countdown_action":"disable"},
  {"id":"PKG-UMRAH-RAM-PREM-ABJ-001","name":"Ramadan Umrah 2026 — Premium (Abuja)","type":"umrah","description":"Spend the blessed month of Ramadan performing Umrah, departing from Abuja on EgyptAir. Stay at Poinciana Hotel (300m from Haram) and Shaza Regency Madinah (250m from Masjid). Full-service premium package with travel insurance, ziyarat tours, and daily breakfast included.","price":"5500000.00","deposit_amount":"2000000.00","duration_days":18,"departure_date":"2026-03-03","return_date":"2026-03-20","max_capacity":80,"current_bookings":28,"inclusions":["Visa processing","Return flight ticket (EgyptAir)","Ground transportation","Premium hotel accommodation","Breakfast daily","Ziyarat tours","Travel insurance"],"image_url":null,"is_active":true,"star_rating":4,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-02T17:26:37.674Z","category":"premium","season":"Ramadan","agent_discount":"400000.00","departure_cities":["Abuja"],"airlines":["EgyptAir"],"is_featured":true,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":80,"featured":true,"status":"active","countdown_enabled":false,"countdown_expiry":null,"countdown_action":"disable"},
  {"id":"PKG-UMRAH-RAM-PREM-KNO-001","name":"Ramadan Umrah 2026 — Premium (Kano)","type":"umrah","description":"Perform Umrah in the blessed month of Ramadan, departing from Kano on Saudi Airlines. Stay at Poinciana Hotel Makkah (300m from Haram) and Shaza Regency Madinah. Premium 4-star accommodation with full inclusions, travel insurance, and expert Nigerian guides throughout.","price":"5500000.00","deposit_amount":"2000000.00","duration_days":15,"departure_date":"2026-03-06","return_date":"2026-03-20","max_capacity":60,"current_bookings":18,"inclusions":["Visa processing","Return flight ticket (Saudi Airlines)","Ground transportation","Premium hotel accommodation","Breakfast daily","Ziyarat tours","Travel insurance"],"image_url":null,"is_active":true,"star_rating":4,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-02T17:26:37.674Z","category":"premium","season":"Ramadan","agent_discount":"400000.00","departure_cities":["Kano"],"airlines":["Saudi Airlines"],"is_featured":true,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":60,"featured":true,"status":"active","countdown_enabled":false,"countdown_expiry":null,"countdown_action":"disable"},
  {"id":"PKG-UMRAH-RAM-STD-KNO-001","name":"Ramadan Umrah 2026 — Standard (Kano)","type":"umrah","description":"Affordable Ramadan Umrah departing from Kano on MaxAir with 9 flexible departure dates throughout the season. 3-star hotel accommodation within 800m of the Haram. Covers all essentials including visa, flights, ground transport, and ziyarat tours.","price":"4500000.00","deposit_amount":"1500000.00","duration_days":15,"departure_date":"2026-02-18","return_date":"2026-03-25","max_capacity":120,"current_bookings":47,"inclusions":["Visa processing","Return flight ticket (MaxAir)","Ground transportation","Standard hotel accommodation","Breakfast daily","Ziyarat tours"],"image_url":null,"is_active":true,"star_rating":3,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-02T17:26:37.674Z","category":"standard","season":"Ramadan","agent_discount":"350000.00","departure_cities":["Kano"],"airlines":["MaxAir"],"is_featured":true,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":120,"featured":true,"status":"active","countdown_enabled":false,"countdown_expiry":null,"countdown_action":"disable"},
  {"id":"PKG-UMRAH-SHAB-BUDGET-001","name":"Sha'ban Umrah 2026 — Budget","type":"umrah","description":"Our most affordable Umrah option — a 14-day Sha'ban package flying Fly Adeal from Kano. Budget-friendly 2-star hotel accommodation with daily breakfast and ground transport covered. Ideal for first-time pilgrims or those travelling on a tight budget without compromising on the spiritual experience.","price":"3000000.00","deposit_amount":"750000.00","duration_days":14,"departure_date":"2026-02-03","return_date":"2026-02-16","max_capacity":60,"current_bookings":22,"inclusions":["Visa processing","Return flight ticket (Fly Adeal)","Ground transportation","Budget hotel accommodation","Breakfast daily"],"image_url":null,"is_active":true,"star_rating":2,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-02T17:26:37.674Z","category":"budget","season":"Sha'ban","agent_discount":"250000.00","departure_cities":["Kano"],"airlines":["Fly Adeal"],"is_featured":false,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":60,"featured":false,"status":"active","countdown_enabled":false,"countdown_expiry":null,"countdown_action":"disable"},
  {"id":"PKG-UMRAH-SHAB-STD-EGA-001","name":"Sha'ban Umrah 2026 — Standard (EgyptAir)","type":"umrah","description":"Perform Umrah in the peaceful month of Sha'ban before Ramadan, flying EgyptAir from Kano. 17-day package with 3-star hotels, daily breakfast, ground transportation, and a basic ziyarat tour. An excellent value option for those seeking a quieter pilgrimage experience.","price":"3700000.00","deposit_amount":"1000000.00","duration_days":17,"departure_date":"2026-02-15","return_date":"2026-03-03","max_capacity":80,"current_bookings":29,"inclusions":["Visa processing","Return flight ticket (EgyptAir)","Ground transportation","Standard hotel accommodation","Breakfast daily","Basic ziyarat tour"],"image_url":null,"is_active":true,"star_rating":3,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-02T17:26:37.674Z","category":"standard","season":"Sha'ban","agent_discount":"300000.00","departure_cities":["Kano"],"airlines":["EgyptAir"],"is_featured":false,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":80,"featured":false,"status":"active","countdown_enabled":false,"countdown_expiry":null,"countdown_action":"disable"},
  {"id":"PKG-UMRAH-SHAB-STD-FDA-001","name":"Sha'ban Umrah 2026 — Standard (Fly Adeal)","type":"umrah","description":"A 16-day Sha'ban Umrah package from Kano flying Fly Adeal. 3-star hotels near the Haram and Masjid al-Nabawi with daily breakfast, full ground transport, and a basic ziyarat tour. Perfect for pilgrims who prefer an early, less-crowded season.","price":"3700000.00","deposit_amount":"1000000.00","duration_days":16,"departure_date":"2026-02-16","return_date":"2026-03-03","max_capacity":80,"current_bookings":29,"inclusions":["Visa processing","Return flight ticket (Fly Adeal)","Ground transportation","Standard hotel accommodation","Breakfast daily","Basic ziyarat tour"],"image_url":null,"is_active":true,"star_rating":3,"created_at":"2026-05-02T17:26:37.674Z","updated_at":"2026-05-02T17:26:37.674Z","category":"standard","season":"Sha'ban","agent_discount":"300000.00","departure_cities":["Kano"],"airlines":["Fly Adeal"],"is_featured":false,"year":null,"currency":"NGN","deposit_allowed":false,"minimum_deposit":null,"duration":null,"capacity":80,"featured":false,"status":"active","countdown_enabled":false,"countdown_expiry":null,"countdown_action":"disable"}
];

async function run() {
  console.log("Running DB Migration...");
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "payments_reference_unique"
        ON "payments" ("reference")
        WHERE "reference" IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS "payments_paystack_reference_unique"
        ON "payments" ("paystack_reference")
        WHERE "paystack_reference" IS NOT NULL;
    `);
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration error:", err);
  }

  const { ensureDefaultData } = await import("./src/utils/init-db.js");
  try {
    await ensureDefaultData();
    console.log("Default data ensured!");
  } catch(err) {
    console.error("Default data error:", err);
  }

  console.log("Inserting packages...");
  const mappedPackages = rawPackages.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as "hajj" | "umrah",
    category: p.category as "premium" | "standard" | "budget",
    season: p.season,
    year: p.year,
    description: p.description,
    price: p.price,
    currency: p.currency,
    agentDiscount: p.agent_discount,
    depositAllowed: p.deposit_allowed,
    depositAmount: p.deposit_amount,
    minimumDeposit: p.minimum_deposit,
    duration: p.duration,
    durationDays: p.duration_days,
    departureDate: p.departure_date,
    returnDate: p.return_date,
    departureCities: p.departure_cities,
    airlines: p.airlines,
    capacity: p.capacity,
    maxCapacity: p.max_capacity,
    currentBookings: p.current_bookings,
    inclusions: p.inclusions,
    imageUrl: p.image_url,
    status: p.status as "active" | "draft" | "archived",
    isActive: p.is_active,
    featured: p.featured,
    isFeatured: p.is_featured,
    starRating: p.star_rating,
    countdownEnabled: p.countdown_enabled,
    countdownExpiry: p.countdown_expiry,
    countdownAction: p.countdown_action,
    createdAt: new Date(p.created_at),
    updatedAt: new Date(p.updated_at),
  }));

  try {
    await db.insert(packagesTable)
      .values(mappedPackages)
      .onConflictDoNothing({ target: packagesTable.id });
    console.log(`Inserted ${mappedPackages.length} packages!`);
  } catch (err) {
    console.error("Insert error:", err);
  }

  process.exit(0);
}

run();
