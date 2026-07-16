export type Product = {
  id: string;
  name: string;
  description: string;
  image: string;
  imageKey: string;
  goal: number;
  raised: number;
};

/** Public URLs under /gifts so images ship with Vercel static assets. */
export function resolveProductImage(imageKey: string): string {
  return `/gifts/${imageKey}.jpg`;
}
