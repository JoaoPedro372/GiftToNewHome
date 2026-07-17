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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Check, Copy, CreditCard, Gift, Loader2, Sparkles } from "lucide-react";
import type { Product } from "@/lib/products";
import { getErrorMessage } from "@/lib/errors";
import {
  buildFallbackInstallments,
  createBrowserCardToken,
  getCardInstallments,
  type InstallmentOption,
} from "@/lib/mercadopago-browser";
import {
  createCardContribution,
  createPixContribution,
  getPaymentStatus,
} from "@/lib/payments";

export type { Product };

const brl = (n: number) =>
  n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });

/** Digits as cents → "1.500,50" (pt-BR). Typing 150050 → R$ 1.500,50 */
function formatCurrencyMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9); // up to 9.999.999,99
  if (!digits) return "";
  const value = Number(digits) / 100;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyMask(masked: string): number {
  const digits = masked.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits) / 100;
}

/** Digits → "MM/AA" */
function formatExpirationMask(raw: string): string {
  let digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 1) {
    const first = Number(digits[0]);
    if (first > 1) digits = `0${digits}`.slice(0, 4);
  }
  if (digits.length >= 2) {
    const month = Math.min(Math.max(Number(digits.slice(0, 2)), 1), 12);
    digits = `${String(month).padStart(2, "0")}${digits.slice(2)}`;
  }
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Digits → "000.000.000-00" */
function formatCpfMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function suggestedAmounts(remaining: number): number[] {
  const base = [50, 100, 200, 500];
  return base.filter((v) => v <= Math.max(remaining, 50)).slice(0, 4);
}

type PaymentMethod = "pix" | "card";

type PixPending = {
  kind: "pix";
  paymentId: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string;
  expiresAt: string | null;
};

type CardPending = {
  kind: "card";
  paymentId: string;
  amount: number;
};

type PendingPayment = PixPending | CardPending;

export function GiftCard({
  product,
  onPaid,
}: {
  product: Product;
  onPaid: () => void;
}) {
  const createPix = useServerFn(createPixContribution);
  const createCard = useServerFn(createCardContribution);
  const checkStatus = useServerFn(getPaymentStatus);

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [expiration, setExpiration] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [installments, setInstallments] = useState(1);
  const [installmentOptions, setInstallmentOptions] = useState<
    InstallmentOption[]
  >([]);
  const [installmentsFromMp, setInstallmentsFromMp] = useState(false);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [copied, setCopied] = useState(false);

  const remaining = Math.max(product.goal - product.raised, 0);
  const percent = Math.min(
    100,
    Math.round((product.raised / product.goal) * 100),
  );
  const complete = product.raised >= product.goal;
  const presets = suggestedAmounts(remaining);
  const amountPreview = (selected ?? parseCurrencyMask(custom)) || 0;
  const cardDigits = cardNumber.replace(/\D/g, "");
  const cardBin = cardDigits.slice(0, 8);
  const hasValidCardNumber =
    cardDigits.length >= 13 && cardDigits.length <= 19;
  const canChooseInstallments = amountPreview > 0 && hasValidCardNumber;
  const visibleInstallments = canChooseInstallments ? installmentOptions : [];

  const resetForm = () => {
    setMethod("pix");
    setSelected(null);
    setCustom("");
    setEmail("");
    setCpf("");
    setCardNumber("");
    setCardholderName("");
    setExpiration("");
    setSecurityCode("");
    setInstallments(1);
    setInstallmentOptions([]);
    setInstallmentsFromMp(false);
    setLoadingInstallments(false);
    setPending(null);
    setCopied(false);
    setSubmitting(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) resetForm();
  };

  const resolveAmount = () => {
    const amount = selected ?? parseCurrencyMask(custom);
    if (!amount || amount <= 0) {
      toast.error("Escolha um valor válido");
      return null;
    }
    return amount;
  };

  const validateEmail = () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido");
      return false;
    }
    return true;
  };

  const submitPix = async (amount: number) => {
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

    setPending({
      kind: "pix",
      paymentId: result.paymentId,
      amount: result.amount,
      qrCode: result.qrCode,
      qrCodeBase64: result.qrCodeBase64,
      expiresAt: result.expiresAt,
    });
  };

  const submitCard = async (amount: number) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Informe um CPF válido");
      return;
    }

    const number = cardNumber.replace(/\D/g, "");
    if (number.length < 13) {
      toast.error("Número do cartão inválido");
      return;
    }
    if (!cardholderName.trim()) {
      toast.error("Informe o nome impresso no cartão");
      return;
    }

    const expMatch = expiration.replace(/\s/g, "").match(/^(\d{2})\/?(\d{2}|\d{4})$/);
    if (!expMatch) {
      toast.error("Validade inválida (MM/AA)");
      return;
    }
    if (!/^\d{3,4}$/.test(securityCode.trim())) {
      toast.error("CVV inválido");
      return;
    }

    const { token, paymentMethodId, issuerId } = await createBrowserCardToken({
      cardNumber: number,
      cardholderName,
      expirationMonth: expMatch[1],
      expirationYear: expMatch[2],
      securityCode,
      cpf: digits,
    });

    const result = await createCard({
      data: {
        productId: product.id,
        amount,
        payerEmail: email.trim(),
        payerCpf: digits,
        token,
        paymentMethodId,
        issuerId,
        installments,
      },
    });

    if (result.status === "approved") {
      toast.success(`Obrigado! ${brl(result.amount)} para ${product.name}`);
      handleOpenChange(false);
      onPaid();
      return;
    }

    setPending({
      kind: "card",
      paymentId: result.paymentId,
      amount: result.amount,
    });
  };

  const submit = async () => {
    const amount = resolveAmount();
    if (amount == null || !validateEmail()) return;

    setSubmitting(true);
    try {
      if (method === "pix") {
        await submitPix(amount);
      } else {
        await submitCard(amount);
      }
    } catch (error) {
      console.error("[payment]", error);
      toast.error(
        getErrorMessage(
          error,
          method === "pix"
            ? "Não foi possível criar o Pix"
            : "Não foi possível processar o cartão",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (
      !open ||
      method !== "card" ||
      amountPreview <= 0 ||
      cardDigits.length < 13
    ) {
      setInstallmentOptions([]);
      setInstallmentsFromMp(false);
      setInstallments(1);
      setLoadingInstallments(false);
      return;
    }

    let cancelled = false;
    setLoadingInstallments(true);

    const timer = window.setTimeout(() => {
      void getCardInstallments({
        amount: amountPreview,
        cardNumber: cardBin,
      })
        .then((options) => {
          if (cancelled) return;
          if (options.length === 0) {
            // Fallback only after a complete card number is present.
            const fallback = buildFallbackInstallments(amountPreview);
            setInstallmentOptions(fallback);
            setInstallmentsFromMp(false);
            setInstallments(1);
            return;
          }
          setInstallmentOptions(options);
          setInstallmentsFromMp(true);
          setInstallments((current) =>
            options.some((o) => o.installments === current)
              ? current
              : (options[0]?.installments ?? 1),
          );
        })
        .catch(() => {
          if (cancelled) return;
          const fallback = buildFallbackInstallments(amountPreview);
          setInstallmentOptions(fallback);
          setInstallmentsFromMp(false);
          setInstallments(1);
        })
        .finally(() => {
          if (!cancelled) setLoadingInstallments(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, method, cardBin, cardDigits.length, amountPreview]);

  useEffect(() => {
    if (!open || !pending) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const status = await checkStatus({
          data: { paymentId: pending.paymentId },
        });
        if (cancelled) return;
        if (status.status === "approved") {
          toast.success(
            `Pagamento confirmado! ${brl(pending.amount)} para ${product.name}`,
          );
          handleOpenChange(false);
          onPaid();
        } else if (status.status === "cancelled") {
          toast.error("Pagamento cancelado ou recusado. Tente novamente.");
          setPending(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only while dialog + payment pending
  }, [open, pending?.paymentId]);

  const copyPix = async () => {
    if (!pending || pending.kind !== "pix") return;
    try {
      await navigator.clipboard.writeText(pending.qrCode);
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
              {!pending ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Contribuir para {product.name}</DialogTitle>
                    <DialogDescription>
                      Faltam {brl(remaining)} para bater a meta. Escolha um valor
                      e a forma de pagamento.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMethod("pix")}
                        className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                          method === "pix"
                            ? "border-primary bg-sage-soft"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        Pix
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethod("card")}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                          method === "card"
                            ? "border-primary bg-sage-soft"
                            : "border-border bg-card hover:border-primary/40"
                        }`}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Cartão
                      </button>
                    </div>

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
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0,00"
                          value={custom}
                          onChange={(e) => {
                            setCustom(formatCurrencyMask(e.target.value));
                            setSelected(null);
                          }}
                          className="pl-9 tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`email-${product.id}`}>Seu e-mail</Label>
                      <Input
                        id={`email-${product.id}`}
                        type="email"
                        autoComplete="email"
                        placeholder="Digite seu e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    {method === "card" && (
                      <div className="space-y-3 rounded-xl border border-border/80 p-3">
                        <div className="space-y-2">
                          <Label htmlFor={`card-${product.id}`}>
                            Número do cartão
                          </Label>
                          <Input
                            id={`card-${product.id}`}
                            inputMode="numeric"
                            autoComplete="cc-number"
                            placeholder="0000 0000 0000 0000"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor={`installments-${product.id}`}>
                              Parcelas
                            </Label>
                            {loadingInstallments && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Atualizando taxas…
                              </span>
                            )}
                          </div>
                          <Select
                            value={
                              canChooseInstallments
                                ? String(installments)
                                : undefined
                            }
                            onValueChange={(value) =>
                              setInstallments(Number(value))
                            }
                            disabled={!canChooseInstallments || loadingInstallments}
                          >
                            <SelectTrigger id={`installments-${product.id}`}>
                              <SelectValue
                                placeholder={
                                  canChooseInstallments
                                    ? "Escolha as parcelas"
                                    : "Preencha valor e cartão"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {visibleInstallments.map((option) => (
                                <SelectItem
                                  key={option.installments}
                                  value={String(option.installments)}
                                >
                                  {option.recommendedMessage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {!canChooseInstallments
                              ? amountPreview <= 0
                                ? "Escolha um valor e digite o número do cartão."
                                : "Digite um número de cartão válido para ver as parcelas."
                              : installmentsFromMp
                                ? "Valores e juros conforme o cartão / Mercado Pago."
                                : "Parcelas disponíveis para este cartão."}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`holder-${product.id}`}>
                            Nome no cartão
                          </Label>
                          <Input
                            id={`holder-${product.id}`}
                            autoComplete="cc-name"
                            placeholder="Como está impresso"
                            value={cardholderName}
                            onChange={(e) => setCardholderName(e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor={`exp-${product.id}`}>Validade</Label>
                            <Input
                              id={`exp-${product.id}`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="cc-exp"
                              placeholder="MM/AA"
                              maxLength={5}
                              value={expiration}
                              onChange={(e) =>
                                setExpiration(formatExpirationMask(e.target.value))
                              }
                              className="tabular-nums"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`cvv-${product.id}`}>CVV</Label>
                            <Input
                              id={`cvv-${product.id}`}
                              type="text"
                              inputMode="numeric"
                              autoComplete="cc-csc"
                              placeholder="123"
                              maxLength={4}
                              value={securityCode}
                              onChange={(e) =>
                                setSecurityCode(
                                  e.target.value.replace(/\D/g, "").slice(0, 4),
                                )
                              }
                              className="tabular-nums"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cpf-${product.id}`}>CPF</Label>
                          <Input
                            id={`cpf-${product.id}`}
                            type="text"
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            maxLength={14}
                            value={cpf}
                            onChange={(e) =>
                              setCpf(formatCpfMask(e.target.value))
                            }
                            className="tabular-nums"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          O pagamento será processado pelo Mercado Pago.
                        </p>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenChange(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={() => void submit()} disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {method === "pix" ? "Gerando Pix…" : "Processando…"}
                        </>
                      ) : method === "pix" ? (
                        "Gerar Pix"
                      ) : (
                        "Pagar com cartão"
                      )}
                    </Button>
                  </DialogFooter>
                </>
              ) : pending.kind === "pix" ? (
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
                        src={`data:image/png;base64,${pending.qrCodeBase64}`}
                        alt="QR Code Pix"
                        width={220}
                        height={220}
                        className="h-52 w-52"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold">
                        {brl(pending.amount)}
                      </p>
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
                          value={pending.qrCode}
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
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenChange(false)}
                    >
                      Fechar
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Confirmando cartão</DialogTitle>
                    <DialogDescription>
                      Estamos aguardando a confirmação do Mercado Pago. Isso
                      costuma levar poucos segundos.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col items-center gap-3 py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-2xl font-semibold">
                      {brl(pending.amount)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Processando pagamento…
                    </p>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenChange(false)}
                    >
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
