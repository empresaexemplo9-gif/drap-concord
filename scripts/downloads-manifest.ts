// Lista os instaladores de public/downloads (tamanho e SHA-256) para a página /baixar.
// Rode depois de gerar os instaladores: npx tsx scripts/downloads-manifest.ts
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const dir = "public/downloads";
const files = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => !f.startsWith("."))
    .sort()
    .map((f) => {
      const buf = readFileSync(`${dir}/${f}`);
      return [f, { size: statSync(`${dir}/${f}`).size, sha256: createHash("sha256").update(buf).digest("hex") }];
    }),
);
writeFileSync("src/lib/downloads.json", JSON.stringify(files, null, 2) + "\n");
console.log(Object.keys(files).join("\n"));
