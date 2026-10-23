import { db } from "@/lib/db";

// Imagem de tema da profissão. A URL leva a versão (?v=), então o cache pode ser eterno.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = await db.professionTheme.findUnique({ where: { id }, select: { data: true, mime: true } });
  if (!theme) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(theme.data), {
    headers: {
      "Content-Type": theme.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
