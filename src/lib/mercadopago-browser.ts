import { getErrorMessage } from "@/lib/errors";

export type InstallmentOption = {
  installments: number;
  installmentAmount: number;
  totalAmount: number;
  installmentRate: number;
  recommendedMessage: string;
};

type PaymentMethodResult = {
  id: string;
  name?: string;
  payment_type_id?: string;
  issuer?: { id?: string | number };
  additional_info_needed?: string[];
};

type MercadoPagoInstance = {
  createCardToken: (fields: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }) => Promise<{ id?: string; error?: string; cause?: unknown } | string>;
  getPaymentMethods: (opts: { bin: string }) => Promise<{
    results?: PaymentMethodResult[];
  }>;
  getIssuers: (opts: {
    paymentMethodId: string;
    bin: string;
  }) => Promise<Array<{ id?: string | number; name?: string }>>;
  getInstallments: (opts: {
    amount: string;
    bin: string;
    paymentTypeId?: string;
  }) => Promise<
    Array<{
      payer_costs?: Array<{
        installments: number;
        installment_amount: number;
        total_amount: number;
        installment_rate?: number;
        recommended_message?: string;
      }>;
    }>
  >;
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string },
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mercado Pago SDK só roda no browser"));
  }
  if (window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-mp-sdk="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Falha ao carregar Mercado Pago SDK")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.dataset.mpSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Mercado Pago SDK"));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export function getMpPublicKey(): string {
  const key = import.meta.env.VITE_MP_PUBLIC_KEY as string | undefined;
  if (!key) {
    throw new Error(
      "Falta VITE_MP_PUBLIC_KEY no .env (Public Key do Mercado Pago)",
    );
  }
  return key;
}

async function getMpClient(): Promise<MercadoPagoInstance> {
  await loadMercadoPagoSdk();
  if (!window.MercadoPago) {
    throw new Error("Mercado Pago SDK indisponível");
  }
  return new window.MercadoPago(getMpPublicKey(), { locale: "pt-BR" });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Fallback while MP hasn't returned issuer-specific rates yet. */
export function buildFallbackInstallments(
  amount: number,
  max = 12,
): InstallmentOption[] {
  if (!Number.isFinite(amount) || amount <= 0) return [];
  return Array.from({ length: max }, (_, i) => {
    const installments = i + 1;
    const installmentAmount = Number((amount / installments).toFixed(2));
    return {
      installments,
      installmentAmount,
      totalAmount: amount,
      installmentRate: 0,
      recommendedMessage:
        installments === 1
          ? `1x de ${formatMoney(amount)}`
          : `${installments}x de ${formatMoney(installmentAmount)}`,
    };
  });
}

export async function getCardInstallments(input: {
  amount: number;
  cardNumber: string;
}): Promise<InstallmentOption[]> {
  const digits = input.cardNumber.replace(/\D/g, "");
  const bin = digits.slice(0, Math.min(Math.max(digits.length, 0), 8));
  if (bin.length < 6 || !Number.isFinite(input.amount) || input.amount <= 0) {
    return [];
  }

  const mp = await getMpClient();
  const amount = input.amount.toFixed(2);

  let results = await mp.getInstallments({
    amount,
    bin: bin.slice(0, 6),
    paymentTypeId: "credit_card",
  });

  if (!results?.[0]?.payer_costs?.length && bin.length >= 8) {
    results = await mp.getInstallments({
      amount,
      bin,
      paymentTypeId: "credit_card",
    });
  }

  const list = Array.isArray(results)
    ? results
    : results
      ? [results as (typeof results)[number]]
      : [];

  const costs = list[0]?.payer_costs ?? [];
  return costs.map((cost) => {
    const installmentAmount = Number(cost.installment_amount);
    const totalAmount = Number(cost.total_amount);
    const rate = Number(cost.installment_rate ?? 0);
    return {
      installments: Number(cost.installments),
      installmentAmount,
      totalAmount,
      installmentRate: rate,
      recommendedMessage:
        cost.recommended_message ??
        (Number(cost.installments) === 1
          ? `1x de ${formatMoney(totalAmount)}`
          : `${cost.installments}x de ${formatMoney(installmentAmount)}${
              rate > 0 ? " com juros" : " sem juros"
            }`),
    };
  });
}

function pickCreditCardMethod(
  results: PaymentMethodResult[] | undefined,
): PaymentMethodResult | undefined {
  if (!results?.length) return undefined;
  return (
    results.find((r) => r.payment_type_id === "credit_card") ?? results[0]
  );
}

export async function createBrowserCardToken(input: {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  cpf: string;
}): Promise<{
  token: string;
  paymentMethodId: string;
  issuerId: string | null;
}> {
  const mp = await getMpClient();
  const cardNumber = input.cardNumber.replace(/\D/g, "");
  const cpf = input.cpf.replace(/\D/g, "");
  const bin = cardNumber.slice(0, 8);

  let methods;
  try {
    methods = await mp.getPaymentMethods({ bin: bin.slice(0, 6) });
  } catch (error) {
    throw new Error(
      getErrorMessage(error, "Não foi possível identificar a bandeira do cartão"),
    );
  }

  const method = pickCreditCardMethod(methods.results);
  const paymentMethodId = method?.id;
  if (!paymentMethodId) {
    throw new Error(
      "Bandeira do cartão não reconhecida. Confira o número e tente de novo.",
    );
  }

  let issuerId =
    method.issuer?.id != null ? String(method.issuer.id) : null;

  const needsIssuer =
    !issuerId ||
    method.additional_info_needed?.includes("issuer_id") === true;

  if (needsIssuer) {
    try {
      const issuers = await mp.getIssuers({
        paymentMethodId,
        bin: bin.slice(0, 6),
      });
      if (issuers?.[0]?.id != null) {
        issuerId = String(issuers[0].id);
      }
    } catch {
      // issuer is optional for some brands
    }
  }

  const year = input.expirationYear.trim();
  const cardExpirationYear = year.length === 2 ? `20${year}` : year;
  const cardExpirationMonth = input.expirationMonth.padStart(2, "0");

  let tokenResult: { id?: string; error?: string; cause?: unknown } | string;
  try {
    tokenResult = await mp.createCardToken({
      cardNumber,
      cardholderName: input.cardholderName.trim(),
      cardExpirationMonth,
      cardExpirationYear,
      securityCode: input.securityCode.trim(),
      identificationType: "CPF",
      identificationNumber: cpf,
    });
  } catch (error) {
    throw new Error(
      getErrorMessage(
        error,
        "Não foi possível tokenizar o cartão. Verifique os dados.",
      ),
    );
  }

  const tokenId =
    typeof tokenResult === "string" ? tokenResult : tokenResult?.id;

  if (!tokenId) {
    throw new Error(
      getErrorMessage(
        tokenResult,
        "Não foi possível tokenizar o cartão. Verifique os dados.",
      ),
    );
  }

  return { token: tokenId, paymentMethodId, issuerId };
}
