# Arquitetura

**Stack:** Next.js 15 (App Router, Server Components e Server Actions) · TypeScript · Tailwind CSS 4 · PostgreSQL + Prisma · Zod · Vitest · Playwright.

Optamos por componentes próprios em vez do shadcn/ui: são poucos, acessíveis e seguem os tokens da marca (ver [DESIGN.md](DESIGN.md)).

## Camadas

```
src/
  app/                   rotas (vitrine, app do profissional, portal, admin, api)
  components/            UI compartilhada (ui.tsx, formulário dinâmico, seletor de horários…)
  lib/
    profiles/schema.ts   schema Zod do Perfil Profissional + resolveProfile (personalizações)
    profiles/registry.ts perfis publicados, categorias, config efetiva do profissional
    rules/engine.ts      motor de regras (funções puras)
    rules/run.ts         execução, aprovação e desfazer das regras
    slots.ts             cálculo de horários livres (fuso, buffer, antecedência)
    booking.ts           agendar, remarcar, cancelar, confirmar
    tenant.ts            acesso a dados sempre filtrado pela organização
    auth.ts              sessões por cookie httpOnly (token com hash no banco)
prisma/
  schema.prisma          modelo de dados
  profiles/*.json        perfis profissionais iniciais (dados)
```

## Núcleo genérico × configuração

O código só conhece conceitos genéricos: Organização, Profissional, Cliente, Serviço, Disponibilidade, Atendimento, Registro, Regra, Notificação, Avaliação, Consentimento, Log de auditoria. Tudo o que muda por profissão vem do `ProfessionProfile.config`:

| Camada | Campo do JSON |
| --- | --- |
| Cadastro e terminologia | `terminology`, `clientFields`, `professionalFields`, `registry`, `intakeForm` |
| Serviços padrão | `services` |
| Registro do atendimento | `recordTemplate` (renderizado pelo formulário dinâmico) |
| Documentos | `documents` |
| Compliance | `compliance` (sigilo, guarda, consentimentos, papéis sem acesso ao registro) |
| Regras automáticas | `rules` |

Perfis são versionados: publicar cria um `ProfileVersion`. O profissional fica na versão que adotou e pode personalizar terminologia, ficha e política de cancelamento (`Professional.overrides`) sem mudar o perfil-base.

## Multi-tenant

Cada profissional pertence a uma `Organization`; todas as tabelas de negócio têm `orgId`. O acesso passa por `tenant(orgId)`, que sempre filtra pela organização. `tests/tenant.test.ts` comprova que uma organização não lê nem altera dados de outra.

## Motor de regras

`gatilho + condições → ações`. Ações sensíveis (`CANCEL_FUTURE`, `BLOCK_BOOKING`) em modo `SUGGEST` geram um `RuleEvent` pendente que o profissional confirma ou descarta; o schema recusa um perfil que já traga uma ação sensível em `AUTO`. Toda execução é registrada, e cancelamentos/bloqueios podem ser desfeitos.

Exemplo (psicologia): 2 faltas seguidas → aviso automático ao paciente; 3 faltas → aviso de que as sessões futuras serão canceladas + pedido de confirmação ao profissional.

Gatilhos por tempo (ex.: dias sem retorno) rodam pelo job diário: `npm run rules:daily` ou `GET /api/cron/regras` com `Authorization: Bearer $CRON_SECRET`.

## Segurança e LGPD

- Senhas com bcrypt; sessão em cookie httpOnly, SameSite=Lax; token guardado só como hash.
- Bloqueio após tentativas de login erradas.
- Controle por papel: recepção e financeiro não veem registros quando o perfil restringe.
- Log de auditoria para criação/leitura de registros, mudanças de status, regras, login, exportação e exclusão de dados.
- Consentimentos registrados com finalidade e versão; o titular baixa (`/api/meus-dados`) ou exclui os próprios dados.
- Cabeçalhos de segurança (HSTS, X-Frame-Options, nosniff, Referrer-Policy).
