// Job diário do motor de regras (gatilhos por tempo). Agende 1x por dia.
import { runDailyRules } from "../src/lib/rules/run";
import { db } from "../src/lib/db";

runDailyRules()
  .then((n) => console.log(`Regras diárias executadas: ${n} disparo(s).`))
  .finally(() => db.$disconnect());
