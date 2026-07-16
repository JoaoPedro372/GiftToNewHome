import { getMercadoPagoPayment } from "./mercadopago.server";
import { getSupabaseAdmin, type ContributionRow } from "./supabase.server";

/**
 * Idempotently credit a contribution when Mercado Pago marks it approved.
 * Safe to call from webhook and polling.
 */
export async function creditApprovedPayment(mpPaymentId: string): Promise<{
  status: ContributionRow["status"] | "not_found";
  credited: boolean;
  productId?: string;
  amount?: number;
}> {
  const supabase = getSupabaseAdmin();
  const payment = await getMercadoPagoPayment(mpPaymentId);

  if (payment.status === "cancelled" || payment.status === "rejected") {
    if (payment.external_reference) {
      await supabase
        .from("contributions")
        .update({ status: "cancelled" })
        .eq("id", payment.external_reference)
        .eq("status", "pending");
    }
    return { status: "cancelled", credited: false };
  }

  if (payment.status !== "approved") {
    return { status: "pending", credited: false };
  }

  let contribution: ContributionRow | null = null;

  if (payment.external_reference) {
    const { data } = await supabase
      .from("contributions")
      .select("*")
      .eq("id", payment.external_reference)
      .maybeSingle();
    contribution = data as ContributionRow | null;
  }

  if (!contribution) {
    const { data } = await supabase
      .from("contributions")
      .select("*")
      .eq("mp_payment_id", String(payment.id))
      .maybeSingle();
    contribution = data as ContributionRow | null;
  }

  if (!contribution) {
    return { status: "not_found", credited: false };
  }

  if (contribution.status === "approved") {
    return {
      status: "approved",
      credited: false,
      productId: contribution.product_id,
      amount: Number(contribution.amount),
    };
  }

  const paidAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("contributions")
    .update({
      status: "approved",
      paid_at: paidAt,
      mp_payment_id: String(payment.id),
    })
    .eq("id", contribution.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  const creditedRow = updated as ContributionRow | null;

  // Another request already credited this contribution.
  if (!creditedRow) {
    return {
      status: "approved",
      credited: false,
      productId: contribution.product_id,
      amount: Number(contribution.amount),
    };
  }

  const amount = Number(creditedRow.amount);
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("raised")
    .eq("id", creditedRow.product_id)
    .single();

  if (productError || !product) {
    throw new Error(productError?.message ?? "Product not found");
  }

  const nextRaised = Number((product as { raised: number }).raised) + amount;
  const { error: raiseError } = await supabase
    .from("products")
    .update({ raised: nextRaised })
    .eq("id", creditedRow.product_id);

  if (raiseError) {
    throw new Error(raiseError.message);
  }

  return {
    status: "approved",
    credited: true,
    productId: creditedRow.product_id,
    amount,
  };
}
