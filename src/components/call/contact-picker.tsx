"use client";

import { useState } from "react";

/** Escolha de quem chamar, com busca. Sem limite de pessoas. */
export function ContactPicker({ contacts }: { contacts: { id: string; name: string; label: string }[] }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const shown = contacts.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Quem você quer chamar {picked.length > 0 && <span className="text-muted">({picked.length} selecionado{picked.length > 1 ? "s" : ""})</span>}</legend>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome" aria-label="Buscar contato" className="mb-2 min-h-11 w-full rounded-xl border border-line bg-card px-3.5" />
      <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-1">
        {shown.map((c) => (
          <li key={c.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface">
              <input
                type="checkbox"
                name="participants"
                value={c.id}
                checked={picked.includes(c.id)}
                onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, c.id] : cur.filter((x) => x !== c.id)))}
                className="size-5 accent-[var(--primary)]"
              />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted">{c.label}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="p-2 text-sm text-muted">Ninguém encontrado.</li>}
      </ul>
      {/* Itens filtrados da busca continuam selecionados. */}
      {picked.filter((id) => !shown.some((c) => c.id === id)).map((id) => <input key={id} type="hidden" name="participants" value={id} />)}
    </fieldset>
  );
}
