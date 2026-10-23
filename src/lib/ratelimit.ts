// Limite simples em memória (por instância). Em produção, trocar por Redis.
const hits = new Map<string, { n: number; reset: number }>();

export function rateLimit(key: string, max = 10, windowMs = 10 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}

/** Bloqueio por tentativas que falharam (ex.: senha errada). Sucesso zera a contagem. */
export const failures = {
  blocked(key: string, max = 8) {
    const h = hits.get(`fail:${key}`);
    return !!h && h.reset > Date.now() && h.n >= max;
  },
  add(key: string, windowMs = 15 * 60_000) {
    rateLimit(`fail:${key}`, Number.MAX_SAFE_INTEGER, windowMs);
  },
  clear(key: string) {
    hits.delete(`fail:${key}`);
  },
};
