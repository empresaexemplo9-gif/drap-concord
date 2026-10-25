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
   DATABASE_URL=... npm run db:seed   # perfis, temas e admin do ambiente; sem dados fictícios
   ```
4. Agende o job diário das regras, chamando `GET /api/cron/regras` com o cabeçalho `Authorization: Bearer $CRON_SECRET` (ex.: Vercel Cron, 1x por dia).
5. Troque a senha do `admin@concord.dev` ou crie seu próprio admin e apague as contas de demonstração.

## Antes de abrir ao público

- Revisar **termos de uso** e **política de privacidade** com advogado (os textos atuais são modelos).
- Validar com especialistas as regras de compliance de cada perfil (marcadas como pendentes).
- Trocar o limite de tentativas em memória por Redis se houver mais de uma instância.
- Configurar backups automáticos do banco.

## Chamadas de áudio e vídeo

As chamadas são da própria plataforma (WebRTC): a mídia vai direto entre os
navegadores e o servidor só faz a sinalização (canal em tempo real em
`/api/tempo-real`). Funcionam sem configuração na maioria das redes.

Para redes corporativas ou móveis que bloqueiam conexão direta, configure um
servidor TURN (retransmissão). Opções, em variáveis de ambiente:

- Cloudflare Realtime TURN (recomendado, credenciais temporárias geradas a cada chamada):
  `CF_TURN_KEY_ID` e `CF_TURN_API_TOKEN`.
- Servidor TURN próprio (ex.: coturn): `TURN_URLS` (separadas por vírgula),
  `TURN_USERNAME` e `TURN_CREDENTIAL`.

As salas são em malha (cada participante conversa direto com todos), sem
servidor de mídia de terceiros, com até 8 pessoas por sala. A qualidade se
ajusta ao tamanho da sala: Full HD em 1:1 e resolução menor conforme entram
mais pessoas.
