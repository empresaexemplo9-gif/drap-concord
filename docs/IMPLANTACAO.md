# Implantação

Recomendado: **Vercel** (app) + **PostgreSQL gerenciado** (Supabase, Neon ou similar).

1. Crie o banco e copie a string de conexão.
2. Na Vercel, importe o repositório e configure as variáveis:
   - `DATABASE_URL`: conexão do Postgres (com pooling, se o provedor oferecer).
   - `APP_URL`: URL pública (ex.: `https://concord.exemplo.com.br`), usada em SEO e sitemap.
   - `CRON_SECRET`: segredo longo e aleatório para o job diário.
3. Rode as migrações e o seed uma vez, apontando para o banco de produção:
   ```bash
   DATABASE_URL=... npx prisma migrate deploy
   DATABASE_URL=... npm run db:seed   # perfis profissionais; remova os usuários de demonstração depois
   ```
4. Agende o job diário das regras, chamando `GET /api/cron/regras` com o cabeçalho `Authorization: Bearer $CRON_SECRET` (ex.: Vercel Cron, 1x por dia).
5. Troque a senha do `admin@concord.dev` ou crie seu próprio admin e apague as contas de demonstração.

## Antes de abrir ao público

- Revisar **termos de uso** e **política de privacidade** com advogado (os textos atuais são modelos).
- Validar com especialistas as regras de compliance de cada perfil (marcadas como pendentes).
- Trocar o limite de tentativas em memória por Redis se houver mais de uma instância.
- Configurar backups automáticos do banco.
