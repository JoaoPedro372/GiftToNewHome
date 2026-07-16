import { createFileRoute } from "@tanstack/react-router";
import { creditApprovedPayment } from "@/lib/contributions.server";
import { verifyMercadoPagoWebhook } from "@/lib/mercadopago.server";

export const Route = createFileRoute("/api/webhooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const dataId =
          url.searchParams.get("data.id") ||
          url.searchParams.get("id") ||
          null;
        const xSignature = request.headers.get("x-signature");
        const xRequestId = request.headers.get("x-request-id");

        const body = (await request.json().catch(() => null)) as {
          type?: string;
          action?: string;
          data?: { id?: string | number };
        } | null;

        const paymentId = String(body?.data?.id ?? dataId ?? "");

        const valid = await verifyMercadoPagoWebhook({
          xSignature,
          xRequestId,
          dataId: dataId ?? (body?.data?.id != null ? String(body.data.id) : null),
        });

        if (!valid) {
          return new Response("Invalid signature", { status: 401 });
        }

        // Always acknowledge quickly; process when we have a payment id.
        if (paymentId && (body?.type === "payment" || !body?.type)) {
          try {
            await creditApprovedPayment(paymentId);
          } catch (error) {
            console.error("[mp-webhook]", error);
            return new Response("Webhook processing failed", { status: 500 });
          }
        }

        return new Response("OK", { status: 200 });
      },
    },
  },
});
