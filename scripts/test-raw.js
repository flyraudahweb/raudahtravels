import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: "./.env" });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const staff = await sql`SELECT id, full_name, role FROM profiles WHERE role IN ('admin', 'super_admin', 'staff')`;
  console.log("Staff:", staff);

  const agents = await sql`SELECT id, business_name FROM agents WHERE status = 'active'`;
  console.log("Agents:", agents);
}

main().catch(console.error);
