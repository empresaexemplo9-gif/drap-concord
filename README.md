# DRAP Concord

Agenda inteligente, CRM e organizador de atendimentos para **qualquer profissional que atende o público** (saúde, jurídico, esporte, educação, beleza, consultoria…), com portal do cliente, vitrine pública e app instalável (PWA).

**Nenhuma profissão está no código.** Cada profissão é um *Perfil Profissional*: um JSON validado e versionado que define terminologia, serviços, ficha de atendimento, documentos, compliance e regras automáticas. Uma profissão nova entra pelo painel admin, sem deploy.

## Rodar localmente

Requisitos: Node 22+, PostgreSQL 16+.

```bash
cp .env.example .env          # ajuste DATABASE_URL e os segredos
npm install
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # 10 perfis profissionais + dados de demonstração
npm run dev                   # http://localhost:3000
```

### Contas de demonstração (senha `concord123`)

| Quem | E-mail | Onde entra |
| --- | --- | --- |
| Psicóloga (com agenda cheia) | `ana@concord.dev` | `/app` |
| Advogado | `carlos@concord.dev` | `/app` |
| Personal trainer | `juliana@concord.dev` | `/app` |
| Professor de tênis | `rafael@concord.dev` | `/app` |
| Paciente | `maria@exemplo.com` | `/minha-conta` |
| Admin da plataforma | `admin@concord.dev` | `/admin/perfis` |

## As 4 interfaces

- **Vitrine pública** (`/`, `/p/[slug]`): busca por serviço, cidade, categoria, modalidade, preço e disponibilidade; página do profissional com selo de registro verificado, serviços, avaliações e horários livres; agendamento da 1ª consulta em 3 passos com pré-cadastro, formulário prévio do perfil e consentimento LGPD.
- **App do profissional** (`/app`): Hoje, agenda (semana e lista), novo agendamento/encaixe, detalhe do atendimento com status e registro (ficha dinâmica do perfil), clientes com linha do tempo/tags/funil/notas, serviços e preços, horários e bloqueios, regras automáticas com aprovação e desfazer, relatórios, perfil público e terminologia própria, notificações.
- **Portal do cliente** (`/minha-conta`): confirmar, reagendar (só horários livres) e cancelar respeitando a política do perfil, histórico, avaliação, baixar ou excluir seus dados.
- **Painel admin** (`/admin`): criar, duplicar, editar (JSON com validação), enviar para validação e publicar perfis com histórico de versões; moderação de avaliações e verificação de registros.

## Testes

```bash
npm test          # unitários + integração (regras, horários, perfis, isolamento multi-tenant)
npm run build && npm run e2e   # ponta a ponta no Chromium, desktop e celular
```

## Documentação

- [Arquitetura e modelo de dados](docs/ARQUITETURA.md)
- [Como adicionar uma nova profissão](docs/NOVA-PROFISSAO.md)
- [Design system](docs/DESIGN.md)
- [Implantação](docs/IMPLANTACAO.md)
- [Roteiro: o que está pronto e o que falta](docs/ROADMAP.md)
- Logo e variações: [`brand/`](brand/README.md)
