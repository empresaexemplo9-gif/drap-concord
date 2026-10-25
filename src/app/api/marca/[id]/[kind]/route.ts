import { db } from "@/lib/db";

const KINDS = { logo: "LOGO", fundo: "BACKGROUND" } as const;

// Logo e fundo próprios do profissional. A URL leva a versão (?v=), então o cache pode ser eterno.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  // logo, fundo ou foto-<chave> da galeria
  const k = kind.startsWith("foto-") && /^foto-[a-z0-9]{6,40}$/.test(kind) ? `GALLERY:${kind.slice(5)}` : KINDS[kind as keyof typeof KINDS];
  if (!k) return new Response("Não encontrado", { status: 404 });
  const asset = await db.brandAsset.findUnique({ where: { professionalId_kind: { professionalId: id, kind: k } }, select: { data: true, mime: true } });
  if (!asset) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: { "Content-Type": asset.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
