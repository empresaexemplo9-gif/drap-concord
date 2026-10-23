import { runDailyRules } from "@/lib/rules/run";

// Chamado por um agendador (ex.: Vercel Cron) com o cabeçalho Authorization: Bearer CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Não autorizado", { status: 401 });
  const fired = await runDailyRules();
  return Response.json({ fired });
}
