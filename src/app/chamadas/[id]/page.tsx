import { notFound } from "next/navigation";
import { CallRoom } from "@/components/call/call-room";
import { requireUser } from "@/lib/auth";
import { contactsFor, MAX_PARTICIPANTS, participantView, roomFor } from "@/lib/calls";

export const metadata = { title: "Chamada", robots: { index: false } };

export default async function Chamada({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ atender?: string }> }) {
  const { id } = await params;
  const { atender } = await searchParams;
  const user = await requireUser(undefined, `/entrar?next=/chamadas/${id}`);
  const room = await roomFor(user.id, id);
  if (!room) notFound();
  const contacts = room.ownerId === user.id ? (await contactsFor(user)).map(({ id, name, label }) => ({ id, name, label })) : [];
  return (
    <CallRoom
      roomId={room.id}
      title={room.title}
      kind={room.kind === "AUDIO" ? "AUDIO" : "VIDEO"}
      me={{ id: user.id, name: user.name }}
      ownerId={room.ownerId}
      status={room.status}
      participants={participantView(room)}
      contacts={contacts}
      autoJoin={atender === "1" || room.ownerId === user.id}
      backHref="/chamadas"
      maxParticipants={MAX_PARTICIPANTS}
    />
  );
}
