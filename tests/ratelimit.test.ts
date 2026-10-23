import { expect, it } from "vitest";
import { failures } from "@/lib/ratelimit";

it("bloqueia após tentativas erradas e libera após acerto", () => {
  const key = `t-${Math.random()}`;
  for (let i = 0; i < 7; i++) failures.add(key);
  expect(failures.blocked(key)).toBe(false);
  failures.add(key);
  expect(failures.blocked(key)).toBe(true);
  failures.clear(key);
  expect(failures.blocked(key)).toBe(false);
});
