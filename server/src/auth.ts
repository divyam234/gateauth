import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { count, eq } from "drizzle-orm";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import {
  admin,
  bearer,
  captcha,
  emailOTP,
  haveIBeenPwned,
  magicLink,
  twoFactor,
} from "better-auth/plugins";
import { auditLogHook, getRequestAuditMetadata, writeAuditEvent } from "./audit-log.js";
import { isPublicSignupAllowed } from "./config.js";
import { db } from "./db.js";
import * as schema from "./db/schema.js";
import { env } from "./env.js";
import { deliverAuthMail } from "./mailer.js";
import { shouldAllowUserCreation } from "./signup-policy.js";

const socialProviders = {
  ...(env.githubClientId && env.githubClientSecret
    ? {
        github: {
          clientId: env.githubClientId,
          clientSecret: env.githubClientSecret,
        },
      }
    : {}),
  ...(env.googleClientId && env.googleClientSecret
    ? {
        google: {
          clientId: env.googleClientId,
          clientSecret: env.googleClientSecret,
        },
      }
    : {}),
};

const securityPlugins = [
  haveIBeenPwned({ enabled: env.enableHibp }),
  ...(env.captchaSecret
    ? [
        captcha({
          provider: "cloudflare-turnstile" as const,
          secretKey: env.captchaSecret,
        }),
      ]
    : []),
];

function sessionAssuranceForPath(path: string | undefined) {
  const normalized = path || "";
  const mfaVerified = normalized.startsWith("/two-factor/verify-");

  let authMethod = "unknown";
  if (mfaVerified) authMethod = "mfa";
  else if (normalized === "/passkey/verify-authentication") authMethod = "passkey";
  else if (normalized === "/magic-link/verify") authMethod = "magic-link";
  else if (normalized === "/sign-in/email-otp") authMethod = "email-otp";
  else if (normalized.startsWith("/callback/")) authMethod = "oauth";
  else if (normalized === "/admin/impersonate-user") authMethod = "impersonation";
  else if (normalized.startsWith("/sign-in/email") || normalized.startsWith("/sign-up/email")) {
    authMethod = "password";
  }

  return { authMethod, mfaVerifiedAt: mfaVerified ? new Date() : null };
}

export const auth = betterAuth({
  appName: env.appName,
  baseURL: env.baseURL,
  basePath: "/api/auth",
  secret: env.secret,
  database: drizzleAdapter(db, { provider: "pg", schema, schemaName: "auth" }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: !env.requireEmailVerification,
    requireEmailVerification: env.requireEmailVerification,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await deliverAuthMail({
        kind: "password-reset",
        to: user.email,
        subject: `${env.appName}: reset your password`,
        text: `Reset your password: ${url}`,
        html: `<p>Reset your password:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: env.requireEmailVerification,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await deliverAuthMail({
        kind: "verification",
        to: user.email,
        subject: `${env.appName}: verify your email`,
        text: `Verify your email address: ${url}`,
        html: `<p>Verify your email address:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },

  socialProviders,

  account: {
    accountLinking: {
      enabled: true,
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
      disableImplicitLinking: false,
      requireLocalEmailVerified: true,
      updateUserInfoOnLink: false,
      trustedProviders: [],
    },
  },

  session: {
    expiresIn: env.sessionExpiresInSeconds,
    updateAge: env.sessionUpdateAgeSeconds,
    additionalFields: {
      authMethod: { type: "string", required: false, defaultValue: "unknown", input: false },
      mfaVerifiedAt: { type: "date", required: false, input: false },
    },
    // Forward-auth decisions and administrative revocations must observe the
    // database immediately, so do not cache session state in a cookie.
    cookieCache: { enabled: false },
  },

  plugins: [
    passkey({
      rpID: new URL(env.baseURL).hostname,
      rpName: env.appName,
      origin: env.baseURL,
      authenticatorSelection: { userVerification: "required" },
    }),
    twoFactor({
      issuer: env.appName,
      otpOptions: {
        period: 5,
        digits: 6,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendOTP: async ({ user, otp }) => {
          await deliverAuthMail({
            kind: "two-factor-otp",
            to: user.email,
            subject: `${env.appName}: your two-factor code`,
            text: `Your two-factor verification code is ${otp}. It expires in 5 minutes.`,
            html: `<p>Your two-factor verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
          });
        },
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      storeOTP: "hashed",
      sendVerificationOTP: async ({ email, otp, type }) => {
        await deliverAuthMail({
          kind: "otp",
          to: email,
          subject: `${env.appName}: your verification code`,
          text: `Your ${type} verification code is ${otp}. It expires in 5 minutes.`,
          html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>It expires in 5 minutes.</p>`,
          metadata: { type },
        });
      },
    }),
    magicLink({
      expiresIn: 300,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        await deliverAuthMail({
          kind: "magic-link",
          to: email,
          subject: `${env.appName}: sign in`,
          text: `Sign in securely: ${url}`,
          html: `<p>Sign in securely:</p><p><a href="${url}">${url}</a></p>`,
        });
      },
    }),
    bearer(),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
      defaultBanReason: "Access suspended by an administrator",
      impersonationSessionDuration: 60 * 30,
    }),
    apiKey({
      defaultPrefix: "gh_",
      requireName: true,
      enableMetadata: true,
      keyExpiration: {
        defaultExpiresIn: 60 * 60 * 24 * 90,
        minExpiresIn: 1,
        maxExpiresIn: 365,
      },
      rateLimit: {
        enabled: true,
        timeWindow: 60_000,
        maxRequests: 600,
      },
      enableSessionForAPIKeys: false,
    }),
    ...securityPlugins,
  ],

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (_user, context) =>
          shouldAllowUserCreation(await isPublicSignupAllowed(), context?.path),
      },
    },
    account: {
      create: {
        after: async (account, context) => {
          const [result] = await db
            .select({ value: count() })
            .from(schema.account)
            .where(eq(schema.account.userId, account.userId));
          const isAdditionalMethod = (result?.value ?? 0) > 1;
          await writeAuditEvent({
            actorUserId: account.userId,
            action: isAdditionalMethod ? "security.account_linked" : "auth.account_created",
            targetType: "account",
            targetId: account.id,
            severity: isAdditionalMethod ? "warning" : "info",
            metadata: { providerId: account.providerId },
            ...(context?.headers ? getRequestAuditMetadata(context.headers) : {}),
          }).catch((error) => console.error("[audit] failed to persist account-link event", error));
        },
      },
      delete: {
        after: async (account, context) => {
          await writeAuditEvent({
            actorUserId: account.userId,
            action: "security.account_unlinked",
            targetType: "account",
            targetId: account.id,
            severity: "warning",
            metadata: { providerId: account.providerId },
            ...(context?.headers ? getRequestAuditMetadata(context.headers) : {}),
          }).catch((error) => console.error("[audit] failed to persist account-unlink event", error));
        },
      },
    },
    session: {
      create: {
        before: async (session, context) => ({
          data: { ...session, ...sessionAssuranceForPath(context?.path) },
        }),
      },
    },
  },

  hooks: {
    after: auditLogHook,
  },

  advanced: {
    useSecureCookies: env.isProduction,
    trustedProxyHeaders: env.trustProxyHeaders,
    ipAddress: {
      ipAddressHeaders: env.trustedIpHeaders,
      ipv6Subnet: 64,
    },
    ...(env.cookieDomain
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.cookieDomain,
          },
        }
      : {}),
  },

  trustedOrigins: env.trustedOrigins,
});
