import { createRequire } from "node:module";
import { writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";

const root=fileURLToPath(new URL("../",import.meta.url));
const require=createRequire(new URL("../artifacts/api-server/package.json",import.meta.url));
const {build}=require("esbuild");
const temporary=path.join(root,`.ota-doc-export-${randomUUID()}.cjs`);
process.env.APP_URL=process.env.OTA_DOCS_APP_URL||"https://flyraudah.com.ng";
try {
  await build({entryPoints:[path.join(root,"artifacts/api-server/src/services/ota/apiDocumentation.ts")],bundle:true,platform:"node",format:"cjs",outfile:temporary,logLevel:"silent"});
  const docs=require(temporary),spec=docs.otaOpenApi();
  await writeFile(path.join(root,"docs/ota-openapi.json"),JSON.stringify(spec,null,2)+"\n");
  await writeFile(path.join(root,"docs/OTA_MOBILE_API.md"),docs.mobileIntegrationGuide());
  console.log(`Exported OTA v${spec.info.version}: docs/ota-openapi.json and docs/OTA_MOBILE_API.md`);
} finally {await unlink(temporary).catch(()=>{});}
