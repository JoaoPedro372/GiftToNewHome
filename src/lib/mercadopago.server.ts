import { MercadoPagoConfig, Payment } from "mercadopago";
import { getServerEnv } from "./env.server";

export type MercadoPagoPixPayment = {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount: number;
  external_reference?: string | null;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

function getMpClient() {
  const { mpAccessToken } = getServerEnv();
  return new MercadoPagoConfig({ accessToken: mpAccessToken });
}

function getPaymentClient() {
  return new Payment(getMpClient());
}

function toPixPayment(payment: {
  id?: number;
  status?: string;
  status_detail?: string;
  transaction_amount?: number;
  external_reference?: string;
  date_of_expiration?: string;
  point_of_interaction?: MercadoPagoPixPayment["point_of_interaction"];
}): MercadoPagoPixPayment {
  if (payment.id == null) {
    throw new Error("Mercado Pago não retornou o id do pagamento");
  }
  return {
    id: payment.id,
    status: payment.status ?? "pending",
    status_detail: payment.status_detail,
    transaction_amount: Number(payment.transaction_amount ?? 0),
    external_reference: payment.external_reference ?? null,
    date_of_expiration: payment.date_of_expiration ?? null,
    point_of_interaction: payment.point_of_interaction,
  };
}

function formatMpError(error: unknown): Error {
  if (error && typeof error === "object") {
    const e = error as {
      message?: string;
      cause?: Array<{ description?: string; code?: string | number }>;
      error?: string;
    };
    const detail =
      e.cause?.[0]?.description || e.message || e.error || "Mercado Pago error";
    return new Error(detail);
  }
  return error instanceof Error ? error : new Error("Mercado Pago error");
}

/** Mercado Pago rejects localhost / non-HTTPS notification URLs. */
export function isPublicNotificationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
  } catch {
    return false;
  }
}

export async function createPixPayment(input: {
  amount: number;
  description: string;
  payerEmail: string;
  externalReference: string;
  notificationUrl?: string | null;
  idempotencyKey: string;
}) {
  const payment = getPaymentClient();

  const body: Parameters<Payment["create"]>[0]["body"] = {
    transaction_amount: Number(input.amount.toFixed(2)),
    description: input.description,
    payment_method_id: "pix",
    payer: {
      email: input.payerEmail,
    },
    external_reference: input.externalReference,
  };

  if (input.notificationUrl && isPublicNotificationUrl(input.notificationUrl)) {
    body.notification_url = input.notificationUrl;
  }

  try {
    const result = await payment.create({
      body,
      requestOptions: {
        idempotencyKey: input.idempotencyKey,
      },
    });
    return toPixPayment(result);
  } catch (error) {
    throw formatMpError(error);
  }
}

export async function getMercadoPagoPayment(paymentId: string | number) {
  const payment = getPaymentClient();
  try {
    const result = await payment.get({ id: String(paymentId) });
    return toPixPayment(result);
  } catch (error) {
    throw formatMpError(error);
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Validate Mercado Pago webhook x-signature header. */
export async function verifyMercadoPagoWebhook(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): Promise<boolean> {
  const { mpWebhookSecret } = getServerEnv();
  if (!mpWebhookSecret) {
    // Allow local/dev without secret; set MP_WEBHOOK_SECRET in production.
    return true;
  }
  if (!input.xSignature || !input.dataId) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key.trim(), rest.join("=").trim()];
    }),
  );

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const manifest = `id:${String(input.dataId).toLowerCase()};request-id:${input.xRequestId ?? ""};ts:${ts};`;
  const expected = await hmacSha256Hex(mpWebhookSecret, manifest);
  return expected === hash;
}
