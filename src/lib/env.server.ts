function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function getServerEnv() {
  return {
    mpAccessToken: required("MP_ACCESS_TOKEN"),
    mpWebhookSecret: process.env.MP_WEBHOOK_SECRET ?? "",
    appUrl: required("APP_URL").replace(/\/$/, ""),
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}
