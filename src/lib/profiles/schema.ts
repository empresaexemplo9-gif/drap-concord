import { z } from "zod";

// Configuração de um Perfil Profissional. É DADO, não código: cadastrar um
// novo perfil válido por este schema basta para a profissão aparecer no
// cadastro, na vitrine e nos filtros.

export const fieldTypes = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "multiselect",
  "scale",
  "checklist",
  "upload",
  "signature",
] as const;

export const formFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/, "use letras, números e _"),
  label: z.string().min(1),
  type: z.enum(fieldTypes),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  help: z.string().optional(),
  // Campo condicional: só aparece se outro campo tiver um valor.
  showIf: z.object({ field: z.string(), equals: z.string() }).optional(),
});

export const formSectionSchema = z.object({
  title: z.string().min(1),
  fields: z.array(formFieldSchema).min(1),
});

export const formTemplateSchema = z.object({
  name: z.string().min(1),
  sections: z.array(formSectionSchema).min(1),
});

export const ruleTriggers = [
  "NO_SHOW",
  "CANCELLATION",
  "UNCONFIRMED",
  "PACKAGE_END",
  "BIRTHDAY",
  "DAYS_WITHOUT_RETURN",
  "DEADLINE_APPROACHING",
  "PAYMENT_OVERDUE",
] as const;

export const ruleActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NOTIFY_CLIENT"), message: z.string().min(1) }),
  z.object({ type: z.literal("NOTIFY_PROFESSIONAL"), message: z.string().min(1) }),
  z.object({
    type: z.literal("CANCEL_FUTURE"),
    graceDays: z.number().int().min(0),
    message: z.string().min(1),
  }),
  z.object({ type: z.literal("BLOCK_BOOKING"), message: z.string().min(1) }),
  z.object({ type: z.literal("OPEN_TASK"), message: z.string().min(1) }),
]);

export const SENSITIVE_ACTIONS = ["CANCEL_FUTURE", "BLOCK_BOOKING"] as const;

export const ruleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  trigger: z.enum(ruleTriggers),
  conditions: z.object({
    consecutiveGte: z.number().int().min(1).optional(),
    days: z.number().int().min(1).optional(),
  }),
  actions: z.array(ruleActionSchema).min(1),
  mode: z.enum(["SUGGEST", "AUTO"]).default("SUGGEST"),
});

export const profileConfigSchema = z
  .object({
    category: z.string().min(1),
    description: z.string().min(1),
    terminology: z.object({
      client: z.object({ singular: z.string(), plural: z.string() }),
      appointment: z.object({ singular: z.string(), plural: z.string() }),
      record: z.string(),
      professional: z.string(),
    }),
    professionalFields: z.array(formFieldSchema).default([]),
    registry: z
      .object({ label: z.string(), required: z.boolean() })
      .optional(),
    clientFields: z.array(formFieldSchema).default([]),
    intakeForm: formTemplateSchema.optional(),
    services: z
      .array(
        z.object({
          name: z.string().min(1),
          durationMin: z.number().int().min(5),
          priceCents: z.number().int().min(0).default(0),
          modality: z.enum(["IN_PERSON", "ONLINE", "HOME"]).default("IN_PERSON"),
          recurrence: z.string().optional(),
          returnDays: z.number().int().optional(),
        }),
      )
      .min(1),
    recordTemplate: formTemplateSchema,
    documents: z.array(
      z.object({
        key: z.string(),
        name: z.string(),
        direction: z.enum(["OUT", "IN", "BOTH"]),
        signatureRequired: z.boolean().default(false),
      }),
    ),
    compliance: z.object({
      // Regras legais/éticas nunca são assumidas como definitivas.
      validation: z.enum(["PENDENTE_VALIDACAO", "VALIDADO"]).default("PENDENTE_VALIDACAO"),
      confidentiality: z.enum(["NORMAL", "SIGILOSO"]),
      retentionYears: z.number().int().min(0),
      signatureRequired: z.boolean(),
      consents: z.array(z.string()),
      // Papéis que NÃO podem ver o registro do atendimento.
      recordHiddenFrom: z.array(z.enum(["RECEPTION", "FINANCE"])),
      notes: z.string().optional(),
    }),
    cancellationPolicy: z.object({ minHoursBefore: z.number().int().min(0) }),
    rules: z.array(ruleSchema).default([]),
  })
  .superRefine((cfg, ctx) => {
    cfg.rules.forEach((rule, i) => {
      const sensitive = rule.actions.some((a) =>
        (SENSITIVE_ACTIONS as readonly string[]).includes(a.type),
      );
      if (sensitive && rule.mode === "AUTO") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules", i, "mode"],
          message:
            "Regras sensíveis começam em modo SUGGEST; o profissional ativa o automático.",
        });
      }
    });
  });

export type ProfileConfig = z.infer<typeof profileConfigSchema>;
export type FormField = z.infer<typeof formFieldSchema>;
export type FormTemplate = z.infer<typeof formTemplateSchema>;
export type RuleConfig = z.infer<typeof ruleSchema>;
export type RuleAction = z.infer<typeof ruleActionSchema>;

export const profileOverridesSchema = z
  .object({
    terminology: profileConfigSchema.innerType().shape.terminology.partial().optional(),
    recordTemplate: formTemplateSchema.optional(),
    cancellationPolicy: z.object({ minHoursBefore: z.number().int().min(0) }).optional(),
  })
  .default({});

export type ProfileOverrides = z.infer<typeof profileOverridesSchema>;

/** Aplica as personalizações do profissional por cima do perfil-base. */
export function resolveProfile(base: ProfileConfig, overrides: unknown): ProfileConfig {
  const o = profileOverridesSchema.parse(overrides ?? {});
  return {
    ...base,
    terminology: { ...base.terminology, ...(o.terminology ?? {}) },
    recordTemplate: o.recordTemplate ?? base.recordTemplate,
    cancellationPolicy: o.cancellationPolicy ?? base.cancellationPolicy,
  };
}

export function parseProfileConfig(input: unknown) {
  return profileConfigSchema.safeParse(input);
}
