const isProduction = process.env.NODE_ENV === "production";

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function csvFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  return (raw ? raw.split(",") : fallback)
    .map((value) => value.trim())
    .filter(Boolean);
}

const baseURL = process.env.BETTER_AUTH_URL || "http://localhost:8080";
const secret = process.env.BETTER_AUTH_SECRET || "development-secret-change-before-production";

if (isProduction && secret === "development-secret-change-before-production") {
  throw new Error("BETTER_AUTH_SECRET must be set to a strong secret in production");
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: numberFromEnv("PORT", 8080),
  appName: process.env.APP_NAME || "Gatehouse",
  baseURL,
  secret,
  databaseURL:
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@127.0.0.1:5432/oauthproxy",
  databasePoolMax: numberFromEnv("DATABASE_POOL_MAX", 10),
  databaseStatementTimeoutMs: numberFromEnv("DATABASE_STATEMENT_TIMEOUT_MS", 15_000),
  corsOrigins: csvFromEnv("CORS_ORIGINS", ["http://localhost:5173", baseURL]),
  trustedOrigins: csvFromEnv("TRUSTED_ORIGINS", ["http://localhost:5173", baseURL]),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  trustProxyHeaders: booleanFromEnv("TRUST_PROXY_HEADERS", true),
  trustedIpHeaders: csvFromEnv("TRUSTED_IP_HEADERS", [
    "cf-connecting-ip",
    "x-real-ip",
    "x-forwarded-for",
  ]),
  githubClientId: process.env.GITHUB_CLIENT_ID || "",
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  captchaSecret: process.env.TURNSTILE_SECRET_KEY || "",
  enableHibp: booleanFromEnv("ENABLE_HIBP", isProduction),
  requireEmailVerification: booleanFromEnv("REQUIRE_EMAIL_VERIFICATION", false),
  sessionExpiresInSeconds: numberFromEnv("SESSION_EXPIRES_IN_SECONDS", 60 * 60 * 24 * 7),
  sessionUpdateAgeSeconds: numberFromEnv("SESSION_UPDATE_AGE_SECONDS", 60 * 60 * 24),
  mailWebhookURL: process.env.MAIL_WEBHOOK_URL || "",
  mailWebhookToken: process.env.MAIL_WEBHOOK_TOKEN || "",
  emailFrom: process.env.EMAIL_FROM || "Gatehouse <noreply@example.invalid>",
  allowDevelopmentMailLog: booleanFromEnv("ALLOW_DEVELOPMENT_MAIL_LOG", !isProduction),
  runMigrations: booleanFromEnv("RUN_MIGRATIONS", true),
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL || "",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "",
  defaultApplicationHost: process.env.DEFAULT_APPLICATION_HOST || "app.localhost",
  defaultApplicationUpstream: process.env.DEFAULT_APPLICATION_UPSTREAM || "http://app:8080",
  seedDefaultApplication: booleanFromEnv("SEED_DEFAULT_APPLICATION", true),
} as const;
