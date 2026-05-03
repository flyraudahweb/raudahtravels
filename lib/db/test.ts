import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./src/schema";
import { config } from "dotenv";
import { inArray, eq } from "drizzle-orm";

config({ path: "../../.env" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
  const staff = await db.select({ id: schema.profilesTable.id, fullName: schema.profilesTable.fullName, role: schema.profilesTable.role })
    .from(schema.profilesTable)
    .where(inArray(schema.profilesTable.role, ["admin", "super_admin", "staff"]));
    
  console.log("Staff:", staff);

  const agents = await db.select({
    id: schema.agentsTable.id,
    businessName: schema.agentsTable.businessName,
  })
    .from(schema.agentsTable)
    .where(eq(schema.agentsTable.status, "active"));
    
  console.log("Agents:", agents);
}

main().catch(console.error);
