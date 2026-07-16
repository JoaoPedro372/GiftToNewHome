import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { creditApprovedPayment } from "@/lib/contributions.server";
import { getServerEnv } from "@/lib/env.server";
import {
  createCardPayment,
  createPixPayment,
  getMercadoPagoPayment,
} from "@/lib/mercadopago.server";
import { resolveProductImage, type Product } from "@/lib/products";
import {
  getSupabaseAdmin,
  type ContributionRow,
  type ProductRow,
} from "@/lib/supabase.server";

export const getProducts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Product[]> => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select("id, name, description, image_key, goal, raised, sort_order")
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as ProductRow[];

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      imageKey: row.image_key,
      image: resolveProductImage(row.image_key),
      goal: Number(row.goal),
      raised: Number(row.raised),
    }));
  },
);

const contributionBaseInput = z.object({
  productId: z.string().min(1),
  amount: z.number().positive().max(100_000),
  payerEmail: z.string().email(),
});

const createPixInput = contributionBaseInput;

const createCardInput = contributionBaseInput.extend({
  token: z.string().min(1),
  paymentMethodId: z.string().min(1),
  payerCpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11, "CPF inválido"),
  issuerId: z.string().optional().nullable(),
  installments: z.number().int().min(1).max(24).optional(),
});

async function loadProductForContribution(
  productId: string,
  amount: number,
): Promise<ProductRow> {
  const supabase = getSupabaseAdmin();
  const { data: productData, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .single();

  const product = productData as ProductRow | null;

  if (productError || !product) {
    throw new Error("Presente não encontrado");
  }

  const remaining = Math.max(Number(product.goal) - Number(product.raised), 0);
  if (remaining <= 0) {
    throw new Error("Meta já atingida para este presente");
  }
  if (amount > remaining) {
    throw new Error(
      `Valor acima do restante da meta (${remaining.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      })})`,
    );
  }

  return product;
}

async function insertPendingContribution(input: {
  productId: string;
  amount: number;
  payerEmail: string;
}): Promise<string> {
  const supabase = getSupabaseAdmin();
  const contributionId = crypto.randomUUID();

  const { error: insertError } = await supabase.from("contributions").insert({
    id: contributionId,
    product_id: input.productId,
    amount: input.amount,
    status: "pending",
    payer_email: input.payerEmail.toLowerCase(),
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return contributionId;
}

async function cancelContribution(contributionId: string) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("contributions")
    .update({ status: "cancelled" })
    .eq("id", contributionId);
}

async function linkPaymentId(contributionId: string, paymentId: string) {
  const supabase = getSupabaseAdmin();
  const { error: linkError } = await supabase
    .from("contributions")
    .update({ mp_payment_id: paymentId })
    .eq("id", contributionId);

  if (linkError) {
    throw new Error(linkError.message);
  }
}

export const createPixContribution = createServerFn({ method: "POST" })
  .validator(createPixInput)
  .handler(async ({ data }) => {
    const env = getServerEnv();
    const product = await loadProductForContribution(
      data.productId,
      data.amount,
    );
    const contributionId = await insertPendingContribution({
      productId: product.id,
      amount: data.amount,
      payerEmail: data.payerEmail,
    });

    let payment;
    try {
      payment = await createPixPayment({
        amount: data.amount,
        description: `${product.name} · Chá de Casa Nova`,
        payerEmail: data.payerEmail.toLowerCase(),
        externalReference: contributionId,
        notificationUrl: `${env.appUrl}/api/webhooks/mercadopago`,
        idempotencyKey: contributionId,
      });
    } catch (error) {
      await cancelContribution(contributionId);
      throw error;
    }

    const qrCode = payment.point_of_interaction?.transaction_data?.qr_code;
    const qrCodeBase64 =
      payment.point_of_interaction?.transaction_data?.qr_code_base64;

    if (!qrCode || !qrCodeBase64) {
      await cancelContribution(contributionId);
      throw new Error("Mercado Pago não retornou o QR Code Pix");
    }

    await linkPaymentId(contributionId, String(payment.id));

    return {
      contributionId,
      paymentId: String(payment.id),
      amount: data.amount,
      qrCode,
      qrCodeBase64,
      expiresAt: payment.date_of_expiration ?? null,
      status: payment.status as "pending" | "approved",
    };
  });

export const createCardContribution = createServerFn({ method: "POST" })
  .validator(createCardInput)
  .handler(async ({ data }) => {
    const env = getServerEnv();
    const product = await loadProductForContribution(
      data.productId,
      data.amount,
    );
    const contributionId = await insertPendingContribution({
      productId: product.id,
      amount: data.amount,
      payerEmail: data.payerEmail,
    });

    let payment;
    try {
      payment = await createCardPayment({
        amount: data.amount,
        description: `${product.name} · Chá de Casa Nova`,
        payerEmail: data.payerEmail.toLowerCase(),
        payerCpf: data.payerCpf,
        token: data.token,
        paymentMethodId: data.paymentMethodId,
        issuerId: data.issuerId,
        installments: data.installments ?? 1,
        externalReference: contributionId,
        notificationUrl: `${env.appUrl}/api/webhooks/mercadopago`,
        idempotencyKey: contributionId,
      });
    } catch (error) {
      await cancelContribution(contributionId);
      throw error;
    }

    await linkPaymentId(contributionId, String(payment.id));

    if (
      payment.status === "rejected" ||
      payment.status === "cancelled" ||
      payment.status === "expired"
    ) {
      await cancelContribution(contributionId);
      throw new Error(
        payment.status_detail
          ? `Pagamento recusado (${payment.status_detail})`
          : "Pagamento com cartão recusado",
      );
    }

    if (payment.status === "approved") {
      await creditApprovedPayment(String(payment.id));
    }

    return {
      contributionId,
      paymentId: String(payment.id),
      amount: data.amount,
      status: payment.status as "pending" | "approved" | "in_process",
    };
  });

const statusInput = z.object({
  paymentId: z.string().min(1),
});

export const getPaymentStatus = createServerFn({ method: "POST" })
  .validator(statusInput)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();

    const { data: contributionData } = await supabase
      .from("contributions")
      .select("*")
      .eq("mp_payment_id", data.paymentId)
      .maybeSingle();

    const contribution = contributionData as ContributionRow | null;

    if (contribution?.status === "approved") {
      return {
        status: "approved" as const,
        amount: Number(contribution.amount),
        productId: contribution.product_id,
      };
    }

    // Sync with Mercado Pago (covers local/dev without webhooks).
    const payment = await getMercadoPagoPayment(data.paymentId);

    if (payment.status === "approved") {
      const result = await creditApprovedPayment(data.paymentId);
      return {
        status: "approved" as const,
        amount: result.amount ?? Number(payment.transaction_amount),
        productId: result.productId ?? contribution?.product_id ?? null,
      };
    }

    if (
      payment.status === "cancelled" ||
      payment.status === "rejected" ||
      payment.status === "expired"
    ) {
      if (contribution) {
        await supabase
          .from("contributions")
          .update({ status: "cancelled" })
          .eq("id", contribution.id)
          .eq("status", "pending");
      }
      return {
        status: "cancelled" as const,
        amount: contribution ? Number(contribution.amount) : null,
        productId: contribution?.product_id ?? null,
      };
    }

    return {
      status: "pending" as const,
      amount: contribution
        ? Number(contribution.amount)
        : Number(payment.transaction_amount),
      productId: contribution?.product_id ?? null,
    };
  });
