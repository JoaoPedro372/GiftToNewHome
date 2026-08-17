import { event } from "@/lib/event";

/** Site público — WhatsApp não consegue ler localhost. */
const PRODUCTION_URL = "https://cha-casa-nova-omega.vercel.app";

/** Garante origem pública para links de convite / WhatsApp. */
export function resolveInviteOrigin(origin: string) {
  const base = (origin || "").replace(/\/$/, "");
  if (!base || /localhost|127\.0\.0\.1/i.test(base)) {
    return PRODUCTION_URL;
  }
  return base;
}

export function inviteUrl(origin: string, inviteCode: string) {
  return `${resolveInviteOrigin(origin)}/c/${inviteCode}`;
}

/** Casal (tem "&") → plural; nome sozinho → singular. */
export function isCoupleInvite(displayName: string) {
  return displayName.includes("&");
}

/** Texto completo do convite (WhatsApp e "Copiar"). */
export function inviteMessageText(
  origin: string,
  input: {
    inviteCode: string;
    displayName: string;
  },
) {
  const url = inviteUrl(origin, input.inviteCode);
  const couple = isCoupleInvite(input.displayName);
  const greeting = couple
    ? `Vocês estão convidados para o ${event.title} ${event.title2} de ${event.coupleNames}.`
    : `Você está convidado para o ${event.title} ${event.title2} de ${event.coupleNames}.`;
  const reminderMessage = `🏠✨ Está chegando o dia do nosso almoço de noivado e chá de casa nova!

Estamos super animados para comemorar esse momento com vocês! 

Como estamos entrando na reta final dos preparativos, precisamos organizar tudo certinho de acordo com a quantidade de pessoas.

Por isso, pedimos que confirme sua presença até o dia 20/08. 

Sua confirmação nos ajuda a preparar tudo com carinho e na quantidade certa!

Esperamos vocês! ❤️🏠`;

  return [
    `Oi, ${input.displayName}!`,
    "",
    reminderMessage,
    "",
    `Confirme presença e se quiser nos ajudar nessa nova etapa, veja a lista de presentes aqui:`,
    url,
  ].join("\n");
}

export function inviteWhatsAppUrl(
  origin: string,
  input: {
    inviteCode: string;
    displayName: string;
  },
) {
  return `https://wa.me/?text=${encodeURIComponent(
    inviteMessageText(origin, input),
  )}`;
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
