"use client";

import { useEffect } from "react";

/** Volta ao topo ao montar (ex.: entrar na demonstração vindo de um cartão no meio da página). */
export function ScrollToTop() {
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);
  return null;
}
