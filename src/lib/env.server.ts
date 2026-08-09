function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function stripSlash(url: string) {
  return url.replace(/\/$/, "");
}

const PRODUCTION_URL = "https://cha-casa-nova-omega.vercel.app";

export function getServerEnv() {
  const appUrl = stripSlash(required("APP_URL"));
  // Links de convite / WhatsApp / foto da prévia (nunca localhost).
  const fromEnv = stripSlash(process.env.PUBLIC_APP_URL?.trim() || "");
  const publicAppUrl =
    fromEnv ||
    (/localhost|127\.0\.0\.1/i.test(appUrl) ? PRODUCTION_URL : appUrl);

  return {
    mpAccessToken: required("MP_ACCESS_TOKEN"),
    mpWebhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
    appUrl,
    publicAppUrl,
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    /** Password for /admin/convidados — set a long random string. */
    adminPassword: process.env.ADMIN_PASSWORD ?? "",
  };
}

export function assertAdminPassword(password: string) {
  const expected = getServerEnv().adminPassword;
  if (!expected) {
    throw new Error(
      "Falta ADMIN_PASSWORD no .env (e na Vercel). Defina uma senha para o admin.",
    );
  }
  if (password !== expected) {
    throw new Error("Senha de admin inválida");
  }
}
