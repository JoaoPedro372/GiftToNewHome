import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "./env.server";

export type ProductRow = {
  id: string;
  name: string;
  description: string;
  image_key: string;
  goal: number;
  raised: number;
  sort_order: number;
};

export type ContributionRow = {
  id: string;
  product_id: string;
  amount: number;
  mp_payment_id: string | null;
  status: "pending" | "approved" | "cancelled" | "expired";
  payer_email: string;
  created_at: string;
  paid_at: string | null;
};

export type GuestRow = {
  id: string;
  invite_code: string;
  display_name: string;
  email: string | null;
  status: "pending" | "confirmed";
  confirmed_at: string | null;
  created_at: string;
};

let client: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (client) return client;
  const env = getServerEnv();
  client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
