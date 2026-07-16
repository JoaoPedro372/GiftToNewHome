import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GiftCard } from "@/components/GiftCard";
import { Home, Heart } from "lucide-react";
import { getProducts } from "@/lib/payments";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chá de Casa Nova · Ana & João" },
      {
        name: "description",
        content:
          "Nos ajude a montar nosso novo lar! Escolha um presente da lista e contribua com o valor que quiser.",
      },
      { property: "og:title", content: "Chá de Casa Nova · Ana & João" },
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
  component: Index,
});

function Index() {
  const products = Route.useLoaderData();
  const router = useRouter();

  const totals = useMemo(() => {
    const goal = products.reduce((s, p) => s + p.goal, 0);
    const raised = products.reduce((s, p) => s + p.raised, 0);
    return {
      goal,
      raised,
      percent: goal > 0 ? Math.round((raised / goal) * 100) : 0,
    };
  }, [products]);

  const brl = (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      <header className="bg-hero relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Home className="h-3.5 w-3.5" /> Chá de casa nova
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-6xl">
            O sonho da casa nova <br className="hidden sm:block" />
            <span className="text-primary">está chegando</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Estamos montando cada cantinho aos poucos. E vocês podem nos ajudar
            com um presente da lista abaixo e contribuir com o valor que estiver
            no seu coração.
          </p>

          <div className="mt-8 max-w-xl rounded-2xl bg-card/80 p-5 shadow-card backdrop-blur">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Arrecadado no total
              </span>
              <span className="text-sm font-semibold">{totals.percent}%</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {brl(totals.raised)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                de {brl(totals.goal)}
              </span>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-progress h-full rounded-full transition-[width] duration-700"
                style={{ width: `${totals.percent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Nossa listinha
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length} presentes para inaugurar o lar.
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
          <span>Carla &amp; João · 2026</span>
        </div>
      </footer>
    </div>
  );
}
