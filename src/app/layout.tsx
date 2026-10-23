import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Fraunces, Inter } from "next/font/google";
import { PwaClient } from "@/components/pwa-client";
import { ViewAsBanner } from "@/components/view-as-banner";
import { THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "DRAP Concord: agenda e atendimento", template: "%s · DRAP Concord" },
  description:
    "Encontre profissionais e agende online. Para profissionais: agenda inteligente, CRM e organização de atendimentos para qualquer área.",
  applicationName: "DRAP Concord",
  appleWebApp: { capable: true, title: "Concord", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F2",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
  return (
    <html lang="pt-BR" data-theme={theme} className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh antialiased">
        <ViewAsBanner />
        {children}
        <PwaClient />
      </body>
    </html>
  );
}
