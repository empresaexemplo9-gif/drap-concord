# Como adicionar uma nova profissão

Sem código e sem deploy.

1. Entre como admin e abra **Perfis profissionais** (`/admin/perfis`).
2. Digite o nome da profissão e clique em **Criar perfil**. Ele nasce como rascunho, copiando o perfil "Personalizado". Para partir de um perfil parecido, use **Duplicar**.
3. Edite o JSON (formato abaixo). Ao salvar, ele é validado pelo schema (`src/lib/profiles/schema.ts`); erros aparecem com o caminho do campo.
4. Clique em **Enviar para validação** para um especialista revisar as regras legais e éticas.
5. Clique em **Publicar nova versão**. Na hora, a profissão aparece no cadastro de profissionais, nas categorias da vitrine e nos filtros.

## Regras do JSON

- `compliance.validation` fica `PENDENTE_VALIDACAO` até um especialista revisar. A interface mostra esse aviso.
- Regras com ações sensíveis (`CANCEL_FUTURE`, `BLOCK_BOOKING`) precisam de `"mode": "SUGGEST"`. O profissional pode ativar o automático depois.
- `recordHiddenFrom` lista os papéis da equipe que não podem ver o registro (`RECEPTION`, `FINANCE`).
- Tipos de campo: `text`, `textarea`, `number`, `date`, `select`, `multiselect`, `scale`, `checklist`, `upload`, `signature`. Um campo com `showIf` só aparece quando outro campo tem o valor indicado.
- Variáveis nas mensagens de regra: `{{client}}`, `{{count}}`, `{{days}}`, `{{graceDays}}`.

## Exemplo: Veterinário(a)

```json
{
  "category": "Pets",
  "description": "Consultas, vacinas e acompanhamento de cães e gatos.",
  "terminology": {
    "client": { "singular": "tutor", "plural": "tutores" },
    "appointment": { "singular": "consulta", "plural": "consultas" },
    "record": "Prontuário do pet",
    "professional": "Veterinário(a)"
  },
  "registry": { "label": "CRMV", "required": true },
  "professionalFields": [],
  "clientFields": [
    { "key": "petName", "label": "Nome do pet", "type": "text", "required": true },
    { "key": "species", "label": "Espécie", "type": "select", "options": ["Cão", "Gato", "Outro"], "required": true }
  ],
  "intakeForm": {
    "name": "Antes da consulta",
    "sections": [{ "title": "Seu pet", "fields": [
      { "key": "reason", "label": "Motivo da consulta", "type": "textarea", "required": true },
      { "key": "vaccinated", "label": "Vacinas em dia?", "type": "select", "options": ["Sim", "Não", "Não sei"] }
    ]}]
  },
  "services": [
    { "name": "Consulta", "durationMin": 30, "priceCents": 18000, "modality": "IN_PERSON" },
    { "name": "Vacinação", "durationMin": 15, "priceCents": 9000, "modality": "IN_PERSON", "returnDays": 365 },
    { "name": "Atendimento a domicílio", "durationMin": 60, "priceCents": 30000, "modality": "HOME" }
  ],
  "recordTemplate": {
    "name": "Consulta",
    "sections": [{ "title": "Registro", "fields": [
      { "key": "weight", "label": "Peso (kg)", "type": "number" },
      { "key": "exam", "label": "Exame clínico", "type": "textarea", "required": true },
      { "key": "conduct", "label": "Conduta e prescrição", "type": "textarea", "required": true }
    ]}]
  },
  "documents": [
    { "key": "receita", "name": "Receita", "direction": "OUT", "signatureRequired": true },
    { "key": "carteira-vacina", "name": "Carteira de vacinação", "direction": "BOTH" }
  ],
  "compliance": {
    "validation": "PENDENTE_VALIDACAO",
    "confidentiality": "NORMAL",
    "retentionYears": 5,
    "signatureRequired": true,
    "consents": ["Tratamento de dados pessoais do tutor (LGPD)"],
    "recordHiddenFrom": ["FINANCE"],
    "notes": "Validar com especialista as normas do conselho de Medicina Veterinária."
  },
  "cancellationPolicy": { "minHoursBefore": 12 },
  "rules": [
    {
      "key": "vacina-anual",
      "name": "Lembrar revacinação",
      "trigger": "DAYS_WITHOUT_RETURN",
      "conditions": { "days": 365 },
      "actions": [{ "type": "NOTIFY_CLIENT", "message": "Faz {{days}} dias desde a última visita. Está na hora de revacinar!" }],
      "mode": "AUTO"
    }
  ]
}
```

## Tipos de atendimento e triagem (`careTypes`)

Cada profissão pode ter vários tipos de atendimento. O cliente escolhe um ("O que você procura?"), responde a triagem e a plataforma configura o atendimento.

```json
{
  "key": "terapia-adulto",
  "name": "Terapia individual (adultos)",
  "description": "Ansiedade, tristeza, luto, conflitos…",
  "services": ["Primeira sessão (acolhimento)", "Sessão online"],
  "triage": {
    "intro": "Suas respostas são confidenciais.",
    "questions": [
      { "key": "risco", "label": "Tem pensamentos de se machucar?", "type": "select", "options": ["Não", "Às vezes", "Sim"], "required": true },
      { "key": "modalidade", "label": "Como prefere?", "type": "select", "options": ["Presencial", "Online"], "required": true }
    ],
    "rules": [
      { "if": { "field": "modalidade", "equals": "Online" }, "then": { "service": "Sessão online", "modality": "ONLINE" } },
      { "if": { "field": "risco", "in": ["Às vezes", "Sim"] }, "then": { "priority": "URGENTE", "tags": ["atenção-risco"], "alert": "Ligue 188 (CVV)." } }
    ]
  }
}
```

- `services`: nomes de serviços da profissão que atendem esse tipo. O primeiro é o padrão.
- Perguntas usam os mesmos tipos de campo dos formulários (inclusive `showIf`).
- Condições: `equals` (igual a), `in` (alguma das opções, vale para múltipla escolha) e `gte` (número maior ou igual).
- Resultados: `service`, `modality`, `priority` (`NORMAL`, `ALTA`, `URGENTE`, prevalece a mais alta), `tags` (vão para o cadastro do cliente), `recommend`, `alert` e `stop` (interrompe o agendamento online e mostra a orientação, por exemplo em emergência).
- As regras rodam em ordem: se duas definem o serviço, vale a última.
- O schema recusa regras que apontam para pergunta ou serviço inexistente.

## Para quem desenvolve

Os perfis iniciais ficam em `prisma/profiles/*.json` e entram no banco com `npm run db:seed`. `tests/profiles.test.ts` valida todos eles. Adicionar um arquivo novo nessa pasta também funciona, mas o caminho principal é o painel admin.
