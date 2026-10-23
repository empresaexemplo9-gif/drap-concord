import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DRAP Concord",
    short_name: "Concord",
    description: "Agenda inteligente, CRM e atendimentos para profissionais e clientes.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#FBF7F2",
    theme_color: "#1F4E5A",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Agenda", url: "/app/agenda" },
      { name: "Meus agendamentos", url: "/minha-conta" },
    ],
  };
}
