import type { MetadataRoute } from "next";

const icon = (s: number) => ({ src: `/icons/icon-${s}.png`, sizes: `${s}x${s}`, type: "image/png", purpose: "any" as const });

// Manifesto do app instalável. Completo para Android, iOS/iPadOS, Windows,
// macOS, Linux e ChromeOS, e para gerar pacotes de loja (PWABuilder/Bubblewrap).
export default function manifest(): MetadataRoute.Manifest {
  const playId = process.env.ANDROID_PACKAGE_NAME;
  return {
    id: "/",
    name: "DRAP Concord",
    short_name: "Concord",
    description: "Agenda inteligente, atendimentos, chamadas de vídeo e CRM para profissionais e seus clientes.",
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#FBF7F2",
    theme_color: "#1F4E5A",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["business", "productivity", "health", "education", "lifestyle"],
    icons: [
      ...[48, 72, 96, 128, 144, 152, 192, 256, 384, 512, 1024].map(icon),
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/monochrome-512.png", sizes: "512x512", type: "image/png", purpose: "monochrome" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    screenshots: [
      { src: "/screenshots/inicio-largo.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Encontre profissionais e agende" },
      { src: "/screenshots/agenda-largo.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Agenda do profissional" },
      { src: "/screenshots/inicio-celular.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Busca no celular" },
      { src: "/screenshots/agenda-celular.png", sizes: "780x1688", type: "image/png", form_factor: "narrow", label: "Agenda no celular" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/app/agenda", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "Chamadas", url: "/chamadas", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "Meus agendamentos", url: "/minha-conta", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
      { name: "Buscar profissionais", url: "/vitrine", icons: [{ src: "/icons/icon-96.png", sizes: "96x96" }] },
    ],
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    prefer_related_applications: false,
    ...(playId ? { related_applications: [{ platform: "play", id: playId, url: `https://play.google.com/store/apps/details?id=${playId}` }] } : {}),
  } as MetadataRoute.Manifest;
}
