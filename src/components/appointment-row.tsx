import Link from "next/link";
import { Badge } from "./ui";
import { modalityLabel, statusLabel, statusTone, time } from "@/lib/format";

type Row = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  modality: string;
  client: { name: string };
  service: { name: string };
};

export function AppointmentRow({ a, href, tz }: { a: Row; href: string; tz?: string }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-soft transition-colors hover:border-primary">
      <div className="w-14 shrink-0 text-center">
        <p className="font-serif text-lg font-semibold text-primary">{time(a.startsAt, tz)}</p>
        <p className="text-xs text-muted">{time(a.endsAt, tz)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{a.client.name}</p>
        <p className="truncate text-sm text-muted">{a.service.name} · {modalityLabel[a.modality]}</p>
      </div>
      <Badge tone={statusTone[a.status]}>{statusLabel[a.status]}</Badge>
    </Link>
  );
}
