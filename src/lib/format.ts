import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

export const TZ = "America/Sao_Paulo";

export function money(cents: number) {
  if (cents === 0) return "Gratuito";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmt(date: Date, pattern: string, tz = TZ) {
  return formatInTimeZone(date, tz, pattern, { locale: ptBR });
}

export const dateLong = (d: Date, tz = TZ) => fmt(d, "EEEE, d 'de' MMMM", tz);
export const dateShort = (d: Date, tz = TZ) => fmt(d, "dd/MM/yyyy", tz);
export const time = (d: Date, tz = TZ) => fmt(d, "HH:mm", tz);

export const modalityLabel: Record<string, string> = {
  IN_PERSON: "Presencial",
  ONLINE: "Online",
  HOME: "A domicílio",
};

export const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  DONE: "Realizado",
  NO_SHOW: "Falta",
  CANCELED_BY_CLIENT: "Cancelado pelo cliente",
  CANCELED_BY_PROFESSIONAL: "Cancelado pelo profissional",
  RESCHEDULED: "Remarcado",
};

export const statusTone: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  CONFIRMED: "info",
  DONE: "success",
  NO_SHOW: "danger",
  CANCELED_BY_CLIENT: "neutral",
  CANCELED_BY_PROFESSIONAL: "neutral",
  RESCHEDULED: "neutral",
};

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function minToHHMM(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function hhmmToMin(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const stageLabel: Record<string, string> = { LEAD: "Interessado", FIRST_VISIT: "1º atendimento", ACTIVE: "Ativo", INACTIVE: "Inativo" };
