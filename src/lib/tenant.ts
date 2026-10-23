import type { AppointmentStatus, Prisma } from "@prisma/client";
import { db } from "./db";

// Acesso a dados de uma organização (tenant). TODA consulta passa o orgId no
// filtro; nunca buscar por id sem o orgId. Coberto por testes de isolamento.

export function tenant(orgId: string) {
  return {
    clients: {
      list: (where: Prisma.ClientWhereInput = {}) =>
        db.client.findMany({ where: { ...where, orgId }, orderBy: { name: "asc" } }),
      get: (id: string) => db.client.findFirst({ where: { id, orgId } }),
      update: (id: string, data: Prisma.ClientUpdateManyMutationInput) =>
        db.client.updateMany({ where: { id, orgId }, data }),
    },
    appointments: {
      list: (where: Prisma.AppointmentWhereInput = {}) =>
        db.appointment.findMany({
          where: { ...where, orgId },
          include: { client: true, service: true },
          orderBy: { startsAt: "asc" },
        }),
      get: (id: string) =>
        db.appointment.findFirst({ where: { id, orgId }, include: { client: true, service: true } }),
      setStatus: (id: string, status: AppointmentStatus, cancelReason?: string) =>
        db.appointment.updateMany({ where: { id, orgId }, data: { status, cancelReason } }),
    },
    services: {
      list: (professionalId: string) =>
        db.service.findMany({ where: { orgId, professionalId }, orderBy: { createdAt: "asc" } }),
      get: (id: string) => db.service.findFirst({ where: { id, orgId } }),
    },
    records: {
      forClient: (clientId: string) =>
        db.attendanceRecord.findMany({
          where: { orgId, clientId },
          orderBy: { createdAt: "desc" },
          include: { appointment: { include: { service: true } } },
        }),
    },
    rules: {
      list: (professionalId: string) =>
        db.rule.findMany({ where: { orgId, professionalId }, orderBy: { createdAt: "asc" } }),
      get: (id: string) => db.rule.findFirst({ where: { id, orgId } }),
    },
  };
}
