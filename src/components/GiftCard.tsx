import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, Copy, Gift, Loader2, Sparkles } from "lucide-react";
import type { Product } from "@/lib/products";
import {
  createPixContribution,
  getPaymentStatus,
} from "@/lib/payments";

export type { Product };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function suggestedAmounts(remaining: number): number[] {
  const base = [50, 100, 200, 500];
  return base.filter((v) => v <= Math.max(remaining, 50)).slice(0, 4);
}

type PixPending = {
  paymentId: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string | null;
};

export function GiftCard({
  product,
  onPaid,
}: {
  product: Product;
  onPaid: () => void;
}) {
  const createPix = useServerFn(createPixContribution);
  const checkStatus = useServerFn(getPaymentStatus);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState<PixPending | null>(null);
  const [copied, setCopied] = useState(false);

  const remaining = Math.max(product.goal - product.raised, 0);
  const percent = Math.min(
    100,
    Math.round((product.raised / product.goal) * 100),
  );
  const complete = product.raised >= product.goal;
  const presets = suggestedAmounts(remaining);

  const resetForm = () => {
    setSelected(null);
    setCustom("");
    setEmail("");
    setPix(null);
    setCopied(false);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  const submit = async () => {
    const amount = selected ?? Number(custom.replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Escolha um valor válido");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido");
      return;
    }

    setSubmitting(true);
    try {
      const result = await createPix({
        data: {
          productId: product.id,
          amount,
          payerEmail: email.trim(),
        },
      });

      if (result.status === "approved") {
        toast.success(`Obrigado! ${brl(result.amount)} para ${product.name}`);
        handleOpenChange(false);
        onPaid();
        return;
      }

      setPix({
        paymentId: result.paymentId,
        amount: result.amount,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
        expiresAt: result.expiresAt,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível criar o Pix";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open || !pix) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const status = await checkStatus({ data: { paymentId: pix.paymentId } });
        if (cancelled) return;
        if (status.status === "approved") {
          toast.success(`Pagamento confirmado! ${brl(pix.amount)} para ${product.name}`);
          handleOpenChange(false);
          onPaid();
        } else if (status.status === "cancelled") {
          toast.error("Pagamento cancelado ou expirado. Tente novamente.");
          setPix(null);
        }
      } catch {
        // Keep polling; transient network errors are fine.
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only while dialog + pix pending
  }, [open, pix?.paymentId]);

  const copyPix = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.qrCode);
      setCopied(true);
      toast.success("Código Pix copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  return (
    <article className="group grid grid-cols-1 gap-6 rounded-3xl bg-card p-4 shadow-card transition-shadow hover:shadow-soft sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:p-6">
      <div className="overflow-hidden rounded-2xl bg-muted">
        <img
          src={product.image}
          alt={product.name}
          width={800}
          height={600}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex min-w-0 flex-col justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {complete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-foreground">
                <Sparkles className="h-3 w-3" /> Completo
              </span>
            )}
          </div>
          <h3 className="mt-1 text-2xl font-semibold">{product.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {product.description}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {brl(product.raised)}
              </span>{" "}
              de {brl(product.goal)}
            </span>
            <span className="text-sm font-semibold">{percent}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-progress h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>

          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button
                size="lg"
                disabled={complete}
                className="w-full sm:w-auto"
              >
                <Gift className="h-4 w-4" />
                {complete ? "Meta atingida" : "Ajudar"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              {!pix ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Contribuir para {product.name}</DialogTitle>
                    <DialogDescription>
                      Faltam {brl(remaining)} para bater a meta. Escolha um valor
                      abaixo ou digite o seu.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {presets.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setSelected(amt);
                            setCustom("");
                          }}
                          className={`rounded-xl border-2 px-3 py-3 text-sm font-semibold transition-colors ${
                            selected === amt
                              ? "border-primary bg-sage-soft"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          {brl(amt)}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`custom-${product.id}`}>Outro valor</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          R$
                        </span>
                        <Input
                          id={`custom-${product.id}`}
                          type="number"
                          inputMode="decimal"
                          min={1}
                          step="1"
                          placeholder="0"
                          value={custom}
                          onChange={(e) => {
                            setCustom(e.target.value);
                            setSelected(null);
                          }}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`email-${product.id}`}>Seu e-mail</Label>
                      <Input
                        id={`email-${product.id}`}
                        type="email"
                        autoComplete="email"
                        placeholder="voce@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Usado pelo Mercado Pago para identificar o pagamento.
                      </p>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={() => void submit()} disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gerando Pix…
                        </>
                      ) : (
                        "Gerar Pix"
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Pague com Pix</DialogTitle>
                    <DialogDescription>
                      Escaneie o QR Code ou copie o código. Assim que o
                      pagamento for confirmado, atualizamos a listinha.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col items-center gap-4 pt-2">
                    <div className="rounded-2xl border border-border bg-white p-3">
                      <img
                        src={`data:image/png;base64,${pix.qrCodeBase64}`}
                        alt="QR Code Pix"
                        width={220}
                        height={220}
                        className="h-52 w-52"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold">{brl(pix.amount)}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Aguardando pagamento…
                      </p>
                    </div>
                    <div className="w-full space-y-2">
                      <Label htmlFor={`pix-copy-${product.id}`}>
                        Pix copia e cola
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`pix-copy-${product.id}`}
                          readOnly
                          value={pix.qrCode}
                          className="font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => void copyPix()}
                          aria-label="Copiar código Pix"
                        >
                          {copied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                      Fechar
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </article>
  );
}
