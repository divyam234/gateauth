import { eq } from "drizzle-orm";
import { auth } from "./auth.js";
import { createApplication, listApplications } from "./applications.js";
import { db } from "./db.js";
import { user } from "./db/schema.js";
import { env } from "./env.js";

export async function bootstrapData(): Promise<void> {
  if (env.seedDefaultApplication && (await listApplications()).length === 0) {
    await createApplication({
      name: "Default application",
      slug: "default-app",
      description: "Initial protected application. Update or remove it from the admin console.",
      upstreamUrl: env.defaultApplicationUpstream,
      domains: [env.defaultApplicationHost],
      publicPaths: ["/login", "/signup", "/api/auth/*", "/assets/*", "/favicon.png"],
      policy: { name: "Authenticated users", allowedRoles: [], requireMfa: false },
    });
    console.info("[bootstrap] created default protected application");
  }

  if (env.seedAdminEmail && env.seedAdminPassword) {
    const [existing] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, env.seedAdminEmail))
      .limit(1);
    let userId = existing?.id;
    if (!userId) {
      const response = await auth.api.signUpEmail({
        body: {
          name: "Administrator",
          email: env.seedAdminEmail,
          password: env.seedAdminPassword,
        },
      });
      userId = response.user.id;
    }
    await db
      .update(user)
      .set({ role: "admin", emailVerified: true, updatedAt: new Date() })
      .where(eq(user.id, userId));
    console.info(`[bootstrap] ensured administrator ${env.seedAdminEmail}`);
  }
}
