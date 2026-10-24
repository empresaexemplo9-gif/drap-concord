import { CopyButton } from "./copy-button";
import { inviteUrl, shareLinks } from "@/lib/invites";

const ext = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold";

/** Link do convite com copiar e enviar por WhatsApp ou e-mail. */
export function InviteShare({ token, professionalName, clientName }: { token: string; professionalName: string; clientName?: string | null }) {
  const url = inviteUrl(token);
  const share = shareLinks(url, professionalName, clientName);
  return (
    <div className="space-y-3">
      <input readOnly value={url} aria-label="Link do convite" className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm" />
      <div className="flex flex-wrap gap-2">
        <CopyButton text={url} />
        <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" className={`${ext} bg-[#25D366] text-[#0b2e17]`}>Enviar no WhatsApp</a>
        <a href={share.email} className={`${ext} border border-line hover:bg-surface`}>Enviar por e-mail</a>
      </div>
    </div>
  );
}
