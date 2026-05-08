import { ensureDefaultData } from "./artifacts/api-server/src/utils/init-db.js";

async function main() {
  console.log("Running ensureDefaultData...");
  try {
    await ensureDefaultData();
    console.log("Success");
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

main();
