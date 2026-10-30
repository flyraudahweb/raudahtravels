import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const frontendRequire = createRequire(
  new URL("../raudah-travels/package.json", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../raudah-travels/src", import.meta.url)),
      wouter: frontendRequire.resolve("wouter"),
      "openapi-fetch": createRequire(import.meta.url).resolve("openapi-fetch"),
      "@clerk/react": frontendRequire.resolve("@clerk/react"),
      "@workspace/api-client-react": frontendRequire.resolve(
        "@workspace/api-client-react",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 120000,
    testTimeout: 30000,
  },
});
