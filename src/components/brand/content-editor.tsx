"use client";

import { useState } from "react";

/** Ordem das seções da página (subir/descer). */
export function SectionOrder({ initial, labels }: { initial: string[]; labels: Record<string, string> }) {
  const [order, setOrder] = useState(initial);
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const n = [...o];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  return (
    <ol className="space-y-2">
      {order.map((k, i) => (
        <li key={k} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-1.5">
          <input type="hidden" name="sectionOrder" value={k} />
          <span className="w-6 text-sm text-muted">{i + 1}.</span>
          <span className="flex-1 font-medium">{labels[k]}</span>
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Subir ${labels[k]}`} className="min-h-11 min-w-11 rounded-lg hover:bg-surface disabled:opacity-30">↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Descer ${labels[k]}`} className="min-h-11 min-w-11 rounded-lg hover:bg-surface disabled:opacity-30">↓</button>
        </li>
      ))}
    </ol>
  );
}

const field = "w-full rounded-xl border border-line bg-card px-3.5 py-2 text-base text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/** Perguntas frequentes: adicionar, editar e remover. */
export function FaqEditor({ initial }: { initial: { q: string; a: string }[] }) {
  const [items, setItems] = useState(() => initial.map((x, i) => ({ ...x, id: i })));
  const [next, setNext] = useState(initial.length);
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.id} className="space-y-2 rounded-xl border border-line p-3">
          <input name="faqQ" defaultValue={it.q} placeholder="Pergunta" aria-label={`Pergunta ${i + 1}`} maxLength={200} className={`${field} min-h-11 font-medium`} />
          <textarea name="faqA" defaultValue={it.a} placeholder="Resposta" aria-label={`Resposta ${i + 1}`} maxLength={1500} rows={3} className={field} />
          <button type="button" onClick={() => setItems((x) => x.filter((y) => y.id !== it.id))} className="min-h-11 text-sm font-semibold text-danger">Remover pergunta</button>
        </div>
      ))}
      {items.length < 15 && (
        <button
          type="button"
          onClick={() => {
            setItems((x) => [...x, { q: "", a: "", id: next }]);
            setNext((n) => n + 1);
          }}
          className="min-h-11 rounded-xl border border-dashed border-line px-4 text-sm font-semibold text-primary hover:bg-surface"
        >
          + Adicionar pergunta
        </button>
      )}
    </div>
  );
}
