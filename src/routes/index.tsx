import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Gift, Settings2 } from "lucide-react";
import { event } from "@/lib/event";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${event.title} · ${event.coupleNames}` },
      {
        name: "description",
        content: `${event.tagline} ${event.subTagline}`,
      },
      {
        property: "og:title",
        content: `${event.title} · ${event.coupleNames}`,
      },
      {
        property: "og:description",
        content: event.tagline,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

/**
 * Home is mainly for the hosts (and rare direct visits).
 * Guests arrive via personalized /c/:code invite links.
 */
function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="bg-hero relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(0.78 0.08 150 / 0.35), transparent 45%), radial-gradient(circle at 80% 10%, oklch(0.82 0.06 230 / 0.35), transparent 40%)",
          }}
        />

        <div className="relative mx-auto flex min-h-svh max-w-3xl flex-col justify-center px-6 py-16">
          <p className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            {event.coupleNames}
          </p>
          <p className="mt-3 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {event.title}
          </p>

          <h1 className="mt-8 font-display text-4xl font-semibold leading-[1.1] sm:text-5xl">
            Central do chá
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Gerencie a lista de presentes e os convites de forma fácil e segura.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link to="/presentes">
                <Gift className="h-4 w-4" />
                Lista de presentes
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-6 text-base"
              asChild
            >
              <Link to="/admin/convidados">
                <Settings2 className="h-4 w-4" />
                Gerenciar convidados
              </Link>
            </Button>
          </div>

          <p className="mt-10 text-sm text-muted-foreground">
            {event.when} · {event.where}
          </p>
        </div>
      </section>
    </div>
  );
}
