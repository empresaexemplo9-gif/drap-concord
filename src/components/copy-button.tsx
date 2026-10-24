"use client";

import { useState } from "react";
import { Button } from "./ui";

export function CopyButton({ text, label = "Copiar link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copie o link:", text);
        }
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      <span aria-live="polite">{done ? "Copiado!" : label}</span>
    </Button>
  );
}
