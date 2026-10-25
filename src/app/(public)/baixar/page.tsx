import QRCode from "qrcode";
import { DownloadCenter } from "@/components/download-center";

export const metadata = {
  title: "Baixar o app",
  description: "Instale o DRAP Concord no Android, iPhone, iPad, Windows, macOS, Linux e ChromeOS.",
  alternates: { canonical: "/baixar" },
};

const features = [
  ["Atualiza sozinho", "Você sempre usa a versão mais nova, sem baixar de novo."],
  ["Leve", "Ocupa poucos megabytes e abre em janela própria, como um app nativo."],
  ["Chamadas e avisos", "Chamadas de áudio e vídeo, lembretes e notificações na hora."],
  ["Seguro", "Conexão criptografada e os mesmos dados da sua conta em todos os aparelhos."],
];

export default async function Baixar() {
  const url = `${process.env.APP_URL ?? "https://drap-concord.vercel.app"}/baixar`;
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#1F4E5A", light: "#FFFFFF" } });
  const play = process.env.ANDROID_PACKAGE_NAME;
  const stores = {
    play: play ? `https://play.google.com/store/apps/details?id=${play}` : undefined,
    appStore: process.env.IOS_APP_STORE_URL || undefined,
    microsoft: process.env.MICROSOFT_STORE_URL || undefined,
  };
  return (
    <div className="gutter space-y-8 py-10 sm:py-14">
      <section className="flex flex-col items-start gap-6 rounded-3xl border border-line bg-card/80 p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático do app */}
        <img src="/icons/icon-192.png" alt="Ícone do DRAP Concord" width={96} height={96} className="size-24 rounded-[1.6rem] shadow-soft" />
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Baixe o app DRAP Concord</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">Para computadores, tablets e celulares: Android, iPhone, iPad, Windows, macOS, Linux e ChromeOS. Gratuito, para profissionais e clientes.</p>
        </div>
      </section>
      <DownloadCenter stores={stores} qrSvg={qrSvg} />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {features.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-line bg-card p-5">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
