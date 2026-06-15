import { asc, eq } from "drizzle-orm";
import { db } from "./db.js";
import { authSettings } from "./db/schema.js";
import { env } from "./env.js";

export type ConfigValue = string | number | boolean | null | string[] | Record<string, unknown>;
export type ConfigMap = Record<string, ConfigValue>;

export const DEFAULT_CONFIG: ConfigMap = {
  brandingName: env.appName,
  allowPublicSignup: true,
  defaultRequireMfa: false,
  defaultSessionMaxAgeSeconds: 86400,
  auditRetentionDays: 90,
  environmentLabel: env.isProduction ? "Production" : "Development",
};

const editableKeys = new Set(Object.keys(DEFAULT_CONFIG));

function validateConfigValue(key: string, value: unknown): ConfigValue {
  switch (key) {
    case "brandingName":
      if (typeof value !== "string" || !value.trim() || value.trim().length > 80) {
        throw new Error("brandingName must be a non-empty string of 80 characters or fewer");
      }
      return value.trim();
    case "environmentLabel":
      if (typeof value !== "string" || !value.trim() || value.trim().length > 40) {
        throw new Error("environmentLabel must be a non-empty string of 40 characters or fewer");
      }
      return value.trim();
    case "allowPublicSignup":
    case "defaultRequireMfa":
      if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
      return value;
    case "defaultSessionMaxAgeSeconds":
      if (!Number.isInteger(value) || Number(value) < 300 || Number(value) > 2_592_000) {
        throw new Error("defaultSessionMaxAgeSeconds must be an integer between 300 and 2592000");
      }
      return Number(value);
    case "auditRetentionDays":
      if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 3650) {
        throw new Error("auditRetentionDays must be an integer between 1 and 3650");
      }
      return Number(value);
    default:
      throw new Error(`Unknown configuration key: ${key}`);
  }
}

function asConfigValue(value: unknown): ConfigValue {
  return value as ConfigValue;
}

export async function seedConfigIfEmpty(): Promise<void> {
  await db
    .insert(authSettings)
    .values(
      Object.entries(DEFAULT_CONFIG).map(([key, value]) => ({
        key,
        value,
      })),
    )
    .onConflictDoNothing({ target: authSettings.key });
}

export async function getAllConfig(): Promise<ConfigMap> {
  const rows = await db
    .select({ key: authSettings.key, value: authSettings.value })
    .from(authSettings)
    .orderBy(asc(authSettings.key));
  return Object.fromEntries(rows.map((row) => [row.key, asConfigValue(row.value)]));
}

export async function getConfig<T extends ConfigValue>(key: string, fallback: T): Promise<T> {
  const [row] = await db
    .select({ value: authSettings.value })
    .from(authSettings)
    .where(eq(authSettings.key, key))
    .limit(1);
  return row ? (asConfigValue(row.value) as T) : fallback;
}

export async function setConfigMany(
  updates: Record<string, unknown>,
  actorUserId?: string | null,
): Promise<ConfigMap> {
  const unknownKeys = Object.keys(updates).filter((key) => !editableKeys.has(key));
  if (unknownKeys.length) throw new Error(`Unknown configuration keys: ${unknownKeys.join(", ")}`);

  const validated = Object.fromEntries(
    Object.entries(updates).map(([key, value]) => [key, validateConfigValue(key, value)]),
  );

  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(validated)) {
      await tx
        .insert(authSettings)
        .values({ key, value, updatedBy: actorUserId ?? null, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: authSettings.key,
          set: { value, updatedBy: actorUserId ?? null, updatedAt: new Date() },
        });
    }
  });
  return getAllConfig();
}

export async function isPublicSignupAllowed(): Promise<boolean> {
  return getConfig("allowPublicSignup", true);
}

export function getRuntimeCapabilities() {
  return {
    emailPassword: true,
    emailOtp: true,
    magicLink: true,
    passkey: true,
    twoFactor: true,
    apiKeys: true,
    github: Boolean(env.githubClientId && env.githubClientSecret),
    google: Boolean(env.googleClientId && env.googleClientSecret),
    captcha: Boolean(env.captchaSecret),
    compromisedPasswordCheck: env.enableHibp,
  };
}
