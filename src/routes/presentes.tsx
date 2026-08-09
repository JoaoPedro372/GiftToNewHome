import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GiftCard } from "@/components/GiftCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Gift, Heart, Home } from "lucide-react";
import { event } from "@/lib/event";
import { getProducts } from "@/lib/payments";

const HOW_IT_WORKS =
  'Ao clicar em "Ajudar" você poderá escolher o valor que deseja contribuir para o presente. Podendo ser o valor total do presente ou um valor parcial.';

const CLOSE_DELAY_SECONDS = 5;

export const Route = createFileRoute("/presentes")({
  head: () => ({
    meta: [
      { title: `Lista de presentes · ${event.title} · ${event.coupleNames}` },
      {
        name: "description",
        content:
          "Nos ajude a montar nosso novo lar! Escolha um presente da lista e contribua com o valor que quiser.",
      },
      {
        property: "og:title",
        content: `Lista de presentes · ${event.coupleNames}`,
      },
      {
        property: "og:description",
        content:
          "Escolha um presente da lista e contribua com o valor que quiser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getProducts(),
  component: PresentesPage,
});

function PresentesPage() {
  const products = Route.useLoaderData();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(CLOSE_DELAY_SECONDS);

  useEffect(() => {
    if (!helpOpen || secondsLeft <= 0) return;
    const id = window.setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [helpOpen, secondsLeft]);

  const canClose = secondsLeft <= 0;

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      <AlertDialog
        open={helpOpen}
        onOpenChange={(open) => {
          if (!open && !canClose) return;
          setHelpOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Como funciona</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/90">
              {HOW_IT_WORKS}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction disabled={!canClose}>
              {canClose ? "Fechar" : `Fechar (${secondsLeft}s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="bg-hero relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-10 sm:pb-24 sm:pt-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              {event.coupleNames}
            </p>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.history.length > 1
                ) {
                  window.history.back();
                  return;
                }
                window.location.href = "/";
              }}
            >
              <Home className="h-3.5 w-3.5" />
              Voltar ao convite
            </Button>
          </div>

          <h1 className="mt-8 text-4xl font-semibold leading-tight sm:text-6xl">
            Nossa listinha de <span className="text-primary">presentes</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Estamos montando cada cantinho aos poucos. Escolha um presente e
            contribua com o valor que estiver no seu coração.
          </p>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {HOW_IT_WORKS}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="inline-flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
              <Gift className="h-6 w-6 text-primary" />
              Presentes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length} itens para inaugurar o lar.
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {products.map((p) => (
            <GiftCard
              key={p.id}
              product={p}
              onPaid={() => void router.invalidate()}
            />
          ))}
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" /> Feito com carinho
          </span>
          <span>
            {event.coupleNames} · {event.title}
          </span>
        </div>
      </footer>
    </div>
  );
}
