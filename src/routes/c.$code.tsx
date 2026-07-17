import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Gift,
  Loader2,
  MapPin,
} from "lucide-react";
import { getErrorMessage } from "@/lib/errors";
import { event } from "@/lib/event";
import { confirmGuestRsvp, getGuestByInviteCode } from "@/lib/guests";

export const Route = createFileRoute("/c/$code")({
  loader: async ({ params }) => {
    try {
      return await getGuestByInviteCode({ data: { code: params.code } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.displayName} · ${event.title}`
          : event.title,
      },
      {
        name: "description",
        content: `Você está convidado para o ${event.title} de ${event.coupleNames}.`,
      },
    ],
  }),
  component: InvitePage,
  notFoundComponent: InviteNotFound,
});

function InviteNotFound() {
  return (
    <div className="bg-hero flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-2xl font-semibold">{event.coupleNames}</p>
      <h1 className="mt-4 text-3xl font-semibold">Convite não encontrado</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Esse link pode estar incompleto. Peça o convite de novo ou vá direto à
        lista de presentes.
      </p>
      <Button className="mt-8" size="lg" asChild>
        <Link to="/presentes">
          <Gift className="h-4 w-4" />
          Ver lista de presentes
        </Link>
      </Button>
    </div>
  );
}

function InvitePage() {
  const guest = Route.useLoaderData();
  const confirmRsvp = useServerFn(confirmGuestRsvp);

  const [confirmed, setConfirmed] = useState(guest.status === "confirmed");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await confirmRsvp({
        data: { code: guest.inviteCode },
      });
      setConfirmed(true);
      toast.success("Presença confirmada! Obrigado.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Não foi possível confirmar"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      <section className="bg-hero relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(0.78 0.08 150 / 0.35), transparent 45%), radial-gradient(circle at 80% 10%, oklch(0.82 0.06 230 / 0.35), transparent 40%)",
          }}
        />

        <div className="relative mx-auto flex min-h-[100svh] max-w-3xl flex-col justify-center px-6 py-16 sm:py-20">
          <p className="animate-in fade-in slide-in-from-bottom-2 font-display text-3xl font-semibold tracking-tight duration-700 sm:text-5xl">
            {event.coupleNames}
          </p>
          <p className="animate-in fade-in slide-in-from-bottom-2 mt-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground duration-700 delay-100">
            {event.title}
          </p>

          <h1 className="animate-in fade-in slide-in-from-bottom-3 mt-8 font-display text-4xl font-semibold leading-[1.1] duration-700 delay-150 sm:text-5xl">
            {guest.displayName},
            <br />
            <span className="text-primary">
              {guest.displayName.includes("&")
                ? "vocês estão convidados"
                : "você está convidado"}
            </span>
          </h1>

          <p className="animate-in fade-in slide-in-from-bottom-3 mt-5 max-w-xl text-base text-muted-foreground duration-700 delay-200 sm:text-lg">
            {event.tagline}
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-4 mt-10 flex flex-col gap-3 duration-700 delay-300 sm:flex-row sm:items-center">
            <a
              href="#confirmar"
              className="inline-flex h-12 items-center justify-center rounded-md px-4 text-sm font-medium text-foreground hover:opacity-80 bg-primary text-white font-semibold"
            >
              Confirmar presença
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-border/80 bg-card/40">
        <div className="mx-auto grid max-w-3xl gap-8 px-6 py-12 sm:grid-cols-2 sm:py-14">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {event.whenLabel}
            </p>
            <p className="mt-2 font-display text-xl font-semibold sm:text-2xl">
              {event.when}
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {event.whereLabel}
            </p>
            <p className="mt-2 font-display text-xl font-semibold sm:text-2xl">
              {event.where}
            </p>
            <a
              href={event.addressMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {event.address}
            </a>
          </div>
        </div>
      </section>

      <section id="confirmar" className="mx-auto max-w-3xl px-6 py-14 sm:py-16">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">
          Confirmar presença
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {event.rsvpNote}
        </p>

        {confirmed ? (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-sage-soft/60 px-5 py-6">
            <p className="inline-flex items-center gap-2 font-medium">
              <Check className="h-4 w-4 text-primary" />
              Presença confirmada
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Obrigado, {guest.displayName}! Estamos ansiosos para receber
              vocês!
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <Button
              size="lg"
              className="h-12 w-full px-8 text-base sm:w-auto"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando…
                </>
              ) : (
                <span className="font-semibold text-white">
                  Confirmar presença
                </span>
              )}
            </Button>
          </div>
        )}

        <div className="mt-12 rounded-2xl bg-hero px-5 py-8 text-center sm:px-8">
          <p className="font-display text-2xl font-semibold">
            Quer nos ajudar a montar nossa casa nova?
          </p>
          <Button size="lg" className="mt-6 h-12 px-8 text-base" asChild>
            <Link to="/presentes">
              <Gift className="h-4 w-4" />
              Abrir lista de presentes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
