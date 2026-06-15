import { env } from "./env.js";

export type AuthMailKind = "verification" | "magic-link" | "otp" | "two-factor-otp" | "password-reset";

export interface AuthMail {
  kind: AuthMailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
  metadata?: Record<string, unknown>;
}

const memoryOutbox: AuthMail[] = [];

export function getMemoryOutbox(): readonly AuthMail[] {
  return memoryOutbox;
}

export function clearMemoryOutbox(): void {
  memoryOutbox.length = 0;
}

export async function deliverAuthMail(mail: AuthMail): Promise<void> {
  if (env.nodeEnv === "test") {
    memoryOutbox.push(mail);
    return;
  }

  if (env.mailWebhookURL) {
    const response = await fetch(env.mailWebhookURL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.mailWebhookToken
          ? { authorization: `Bearer ${env.mailWebhookToken}` }
          : {}),
      },
      body: JSON.stringify({ from: env.emailFrom, ...mail }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Mail webhook returned ${response.status}`);
    }
    return;
  }

  if (env.allowDevelopmentMailLog) {
    console.info(`[mail:${mail.kind}] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return;
  }

  throw new Error("No production mail delivery is configured");
}
