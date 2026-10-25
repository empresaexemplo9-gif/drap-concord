import { defineConfig, devices } from "@playwright/test";

// E2E dos fluxos principais. Requer banco com dados de demonstração (npm run db:seed:demo) e build (npm run build).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    // Câmera e microfone simulados para testar chamadas de áudio e vídeo.
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
  },
  webServer: { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] }, grep: /@mobile/ },
  ],
});
