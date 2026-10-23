"use client";

import { useState } from "react";
import type { FormField, FormTemplate } from "@/lib/profiles/schema";

const inputCls =
  "w-full min-h-11 rounded-xl border border-line bg-card px-3.5 py-2 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/** Formulário dinâmico montado a partir de um modelo do Perfil Profissional. */
export function DynamicFields({ template, prefix = "f_", initial = {} }: { template: FormTemplate; prefix?: string; initial?: Record<string, unknown> }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, Array.isArray(v) ? "" : String(v ?? "")])),
  );
  const visible = (f: FormField) => !f.showIf || values[f.showIf.field] === f.showIf.equals;
  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6">
      {template.sections.map((section) => (
        <fieldset key={section.title} className="space-y-4">
          <legend className="mb-1 font-serif text-lg font-semibold">{section.title}</legend>
          {section.fields.filter(visible).map((f) => {
            const id = `${prefix}${f.key}`;
            const label = (
              <span className="mb-1.5 block text-sm font-medium">
                {f.label} {f.required && <span className="text-danger" aria-hidden>*</span>}
              </span>
            );
            switch (f.type) {
              case "textarea":
                return <label key={f.key} className="block">{label}<textarea id={id} name={id} required={f.required} defaultValue={values[f.key]} className={`${inputCls} min-h-24`} /></label>;
              case "select":
                return (
                  <label key={f.key} className="block">{label}
                    <select id={id} name={id} required={f.required} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={inputCls}>
                      <option value="">Selecione…</option>
                      {f.options?.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </label>
                );
              case "multiselect":
              case "checklist":
                return (
                  <fieldset key={f.key}>
                    <legend className="mb-1.5 text-sm font-medium">{f.label}</legend>
                    <div className="flex flex-wrap gap-2">
                      {f.options?.map((o) => (
                        <label key={o} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-info-bg">
                          <input type="checkbox" name={id} value={o} defaultChecked={Array.isArray(initial[f.key]) && (initial[f.key] as string[]).includes(o)} className="size-4 accent-[var(--primary)]" />
                          {o}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              case "scale": {
                const min = f.min ?? 1, max = f.max ?? 10;
                return (
                  <fieldset key={f.key}>
                    <legend className="mb-1.5 text-sm font-medium">{f.label}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                        <label key={n} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-card text-sm font-medium has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary">
                          <input type="radio" name={id} value={n} required={f.required} defaultChecked={values[f.key] === String(n)} className="sr-only" />
                          {n}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              }
              case "upload":
                return <label key={f.key} className="block">{label}<input type="file" disabled className={inputCls} /><span className="mt-1 block text-xs text-muted">Envio de arquivos com criptografia: em breve.</span></label>;
              case "signature":
                return <label key={f.key} className="block">{label}<input id={id} name={id} placeholder="Digite seu nome completo para assinar" required={f.required} className={inputCls} /></label>;
              default:
                return (
                  <label key={f.key} className="block">{label}
                    <input id={id} name={id} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} required={f.required} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className={inputCls} />
                  </label>
                );
            }
          })}
        </fieldset>
      ))}
    </div>
  );
}
