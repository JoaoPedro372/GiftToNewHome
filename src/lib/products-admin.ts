import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertAdminPassword } from "@/lib/env.server";
import { resolveProductImage } from "@/lib/products";
import { getSupabaseAdmin, type ProductRow } from "@/lib/supabase.server";

export type ProductAdmin = {
  id: string;
  name: string;
  description: string;
  imageKey: string;
  image: string;
  goal: number;
  raised: number;
  sortOrder: number;
};

function toAdmin(row: ProductRow): ProductAdmin {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    imageKey: row.image_key,
    image: resolveProductImage(row.image_key),
    goal: Number(row.goal),
    raised: Number(row.raised),
    sortOrder: row.sort_order,
  };
}

const adminAuth = z.object({
  adminPassword: z.string().min(1),
});

export const listProductsAdmin = createServerFn({ method: "POST" })
  .validator(adminAuth)
  .handler(async ({ data }): Promise<ProductAdmin[]> => {
    assertAdminPassword(data.adminPassword);
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return ((rows ?? []) as ProductRow[]).map(toAdmin);
  });

const updateInput = adminAuth.extend({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  imageKey: z.string().trim().min(1).max(500),
  goal: z.number().positive().max(1_000_000),
  sortOrder: z.number().int().min(0).max(999),
});

export const updateProductAdmin = createServerFn({ method: "POST" })
  .validator(updateInput)
  .handler(async ({ data }) => {
    assertAdminPassword(data.adminPassword);
    const supabase = getSupabaseAdmin();

    const { data: row, error } = await supabase
      .from("products")
      .update({
        name: data.name.trim(),
        description: data.description.trim(),
        image_key: data.imageKey.trim(),
        goal: data.goal,
        sort_order: data.sortOrder,
      })
      .eq("id", data.id)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Presente não encontrado");
    return toAdmin(row as ProductRow);
  });

const createInput = adminAuth.extend({
  id: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e hífen"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  imageKey: z.string().trim().min(1).max(500),
  goal: z.number().positive().max(1_000_000),
  sortOrder: z.number().int().min(0).max(999),
});

export const createProductAdmin = createServerFn({ method: "POST" })
  .validator(createInput)
  .handler(async ({ data }) => {
    assertAdminPassword(data.adminPassword);
    const supabase = getSupabaseAdmin();

    const { data: row, error } = await supabase
      .from("products")
      .insert({
        id: data.id.trim(),
        name: data.name.trim(),
        description: data.description.trim(),
        image_key: data.imageKey.trim(),
        goal: data.goal,
        raised: 0,
        sort_order: data.sortOrder,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("Já existe um presente com esse id");
      }
      throw new Error(error.message);
    }
    return toAdmin(row as ProductRow);
  });

const BUCKET = "gift-images";

const uploadInput = adminAuth.extend({
  productId: z.string().min(1).max(64),
  fileName: z.string().min(1).max(180),
  contentType: z
    .string()
    .regex(/^image\/(jpeg|jpg|png|webp|gif)$/i, "Envie JPG, PNG, WEBP ou GIF"),
  /** Raw base64 without data: prefix */
  base64: z.string().min(1).max(8_000_000),
});

export const uploadProductImageAdmin = createServerFn({ method: "POST" })
  .validator(uploadInput)
  .handler(async ({ data }) => {
    assertAdminPassword(data.adminPassword);
    const supabase = getSupabaseAdmin();

    const ext =
      data.contentType.includes("png")
        ? "png"
        : data.contentType.includes("webp")
          ? "webp"
          : data.contentType.includes("gif")
            ? "gif"
            : "jpg";

    const safeName = data.fileName
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 80);
    const path = `${data.productId}/${Date.now()}-${safeName || `foto.${ext}`}`;

    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: data.contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(
        error.message.includes("Bucket not found")
          ? "Bucket gift-images não existe. Rode supabase/storage-gifts.sql no Supabase."
          : error.message,
      );
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) {
      throw new Error("Upload ok, mas não foi possível gerar a URL pública");
    }

    return { publicUrl: pub.publicUrl };
  });
