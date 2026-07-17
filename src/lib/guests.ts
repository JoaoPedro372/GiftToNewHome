import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin, type GuestRow } from "@/lib/supabase.server";

export type GuestPublic = {
  inviteCode: string;
  displayName: string;
  status: "pending" | "confirmed";
};

function toPublic(row: GuestRow): GuestPublic {
  return {
    inviteCode: row.invite_code,
    displayName: row.display_name,
    status: row.status,
  };
}

const inviteCodeInput = z.object({
  code: z.string().min(1).max(64),
});

export const getGuestByInviteCode = createServerFn({ method: "GET" })
  .validator(inviteCodeInput)
  .handler(async ({ data }): Promise<GuestPublic> => {
    const supabase = getSupabaseAdmin();
    const code = data.code.trim().toLowerCase();

    const { data: row, error } = await supabase
      .from("guests")
      .select("*")
      .eq("invite_code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Convite não encontrado");

    return toPublic(row as GuestRow);
  });

export const confirmGuestRsvp = createServerFn({ method: "POST" })
  .validator(inviteCodeInput)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const code = data.code.trim().toLowerCase();

    const { data: row, error } = await supabase
      .from("guests")
      .select("*")
      .eq("invite_code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const guest = row as GuestRow | null;
    if (!guest) throw new Error("Convite não encontrado");

    const { error: updateError } = await supabase
      .from("guests")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", guest.id);

    if (updateError) throw new Error(updateError.message);

    return {
      guest: {
        inviteCode: guest.invite_code,
        displayName: guest.display_name,
        status: "confirmed" as const,
      },
    };
  });
