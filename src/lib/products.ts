export type Product = {
  id: string;
  name: string;
  description: string;
  image: string;
  imageKey: string;
  goal: number;
  raised: number;
};

/** Convert Google Drive share/view links into a direct image URL. */
export function normalizeImageUrl(raw: string): string {
  const key = raw.trim();

  // https://drive.google.com/file/d/FILE_ID/view?...
  const fileMatch = key.match(
    /drive\.google\.com\/file\/d\/([^/]+)/i,
  );
  if (fileMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }

  // https://drive.google.com/open?id=FILE_ID
  const openMatch = key.match(
    /drive\.google\.com\/open\?[^#]*id=([^&]+)/i,
  );
  if (openMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }

  // Already uc?id=… or uc?export=view&id=…
  const ucMatch = key.match(
    /drive\.google\.com\/uc\?[^#]*id=([^&]+)/i,
  );
  if (ucMatch?.[1]) {
    return `https://drive.google.com/uc?export=view&id=${ucMatch[1]}`;
  }

  return key;
}

/**
 * Resolves product image:
 * - Google Drive share link → direct view URL
 * - full URL / absolute path → used as-is
 * - key like "sofa" → `/gifts/sofa.jpg` (file in public/gifts)
 */
export function resolveProductImage(imageKey: string): string {
  const key = normalizeImageUrl(imageKey);
  if (
    key.startsWith("http://") ||
    key.startsWith("https://") ||
    key.startsWith("/")
  ) {
    return key;
  }
  return `/gifts/${key}.jpg`;
}

/** Known bundled gift images under public/gifts (without .jpg). */
export const BUNDLED_GIFT_IMAGE_KEYS = [
  "sofa",
  "table",
  "coffee",
  "cookware",
  "blender",
  "linens",
] as const;
