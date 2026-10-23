import { defineConfig, devices } from "@playwright/test";

// E2E dos fluxos principais. Requer banco com seed (npm run db:seed) e build (npm run build).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://localhost:3000", locale: "pt-BR", timezoneId: "America/Sao_Paulo", trace: "retain-on-failure" },
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
