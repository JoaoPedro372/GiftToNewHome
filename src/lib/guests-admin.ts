import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminPassword, getServerEnv } from "@/lib/env.server";
import { makeInviteCode } from "@/lib/invite";
import { getSupabaseAdmin, type GuestRow } from "@/lib/supabase.server";

export type GuestAdmin = {
  id: string;
  inviteCode: string;
  displayName: string;
  status: "pending" | "confirmed";
  confirmedAt: string | null;
  createdAt: string;
};

function toAdmin(row: GuestRow): GuestAdmin {
  return {
    id: row.id,
    inviteCode: row.invite_code,
    displayName: row.display_name,
    status: row.status,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}

const adminAuth = z.object({
  adminPassword: z.string().min(1),
});

async function insertGuest(displayName: string): Promise<GuestAdmin> {
  const supabase = getSupabaseAdmin();
  let inviteCode = makeInviteCode(displayName);

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: created, error } = await supabase
      .from("guests")
      .insert({
        invite_code: inviteCode,
        display_name: displayName,
      })
      .select("*")
      .single();

    if (!error && created) {
      return toAdmin(created as GuestRow);
    }

    if (error?.code === "23505") {
      inviteCode = makeInviteCode(displayName);
      continue;
    }
    throw new Error(error?.message ?? "Não foi possível criar o convidado");
  }

  throw new Error("Não foi possível gerar um código único para o convite");
}

export const verifyAdminPassword = createServerFn({ method: "POST" })
  .validator(adminAuth)
  .handler(async ({ data }) => {
    assertAdminPassword(data.adminPassword);
    // Usa PUBLIC_APP_URL (produção) para links de WhatsApp — não localhost.
    return { ok: true as const, appUrl: getServerEnv().publicAppUrl };
  });

export const listGuestsAdmin = createServerFn({ method: "POST" })
  .validator(adminAuth)
  .handler(async ({ data }): Promise<GuestAdmin[]> => {
    assertAdminPassword(data.adminPassword);
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("guests")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return ((rows ?? []) as GuestRow[]).map(toAdmin);
  });

const createOneInput = adminAuth.extend({
  displayName: z.string().trim().min(1).max(120),
});

export const createGuestAdmin = createServerFn({ method: "POST" })
  .validator(createOneInput)
  .handler(async ({ data }) => {
    assertAdminPassword(data.adminPassword);
    return insertGuest(data.displayName.trim());
  });

const createBulkInput = adminAuth.extend({
  namesText: z.string().min(1),
});

export const createGuestsBulkAdmin = createServerFn({ method: "POST" })
  .validator(createBulkInput)
  .handler(async ({ data }) => {
    assertAdminPassword(data.adminPassword);

    const names = data.namesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (names.length === 0) {
      throw new Error("Cole pelo menos um nome (um por linha)");
    }
    if (names.length > 200) {
      throw new Error("Limite de 200 nomes por vez");
    }

    const created: GuestAdmin[] = [];
    for (const displayName of names) {
      created.push(await insertGuest(displayName));
    }

    return { created, count: created.length };
  });
