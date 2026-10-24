import { Avatar } from "./ui";

/** Logo do profissional (quando enviado) ou as iniciais do nome. */
export function BrandMark({ name, logoUrl, size = 48 }: { name: string; logoUrl?: string | null; size?: number }) {
  if (!logoUrl) return <Avatar name={name} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo servido pela API da marca, já otimizado
    <img src={logoUrl} alt={`Logo de ${name}`} width={size} height={size} className="shrink-0 rounded-2xl bg-white/80 object-contain p-1" style={{ width: size, height: size }} />
  );
}
