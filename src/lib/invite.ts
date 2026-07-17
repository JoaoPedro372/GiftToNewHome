import { event } from "@/lib/event";

export function inviteUrl(origin: string, inviteCode: string) {
  return `${origin.replace(/\/$/, "")}/c/${inviteCode}`;
}

export function inviteWhatsAppUrl(origin: string, input: {
  inviteCode: string;
  displayName: string;
}) {
  const url = inviteUrl(origin, input.inviteCode);
  const text = [
    `Oi, ${input.displayName}!`,
    "",
    `Vocês estão convidados para o ${event.title} de ${event.coupleNames}.`,
    "",
    `Confirme presença e veja a lista de presentes aqui:`,
    url,
  ].join("\n");

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** "Ana & Carlos" → "ana-carlos" */
export function slugifyInviteName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function makeInviteCode(displayName: string) {
  const slug = slugifyInviteName(displayName) || "convidado";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${slug}-${suffix}`;
}
