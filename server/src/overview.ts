import { sql } from "drizzle-orm";
import { queryAuditEvents } from "./audit-log.js";
import { db } from "./db.js";

interface CountRow extends Record<string, unknown> {
  users: number;
  active_sessions: number;
  mfa_users: number;
  passkey_users: number;
  active_api_keys: number;
  expiring_api_keys: number;
}

interface ActivityRow extends Record<string, unknown> {
  sign_ins: number;
  denied: number;
  critical: number;
}

interface TrendRow extends Record<string, unknown> {
  day: string;
  sign_ins: number;
  denied: number;
}

interface ApplicationHealthRow extends Record<string, unknown> {
  total: number;
  healthy: number;
  unhealthy: number;
}

export async function getOverview() {
  const [countsResult, activityResult, trendResult, healthResult, recentEvents] =
    await Promise.all([
      db.execute<CountRow>(sql`
        SELECT
          (SELECT count(*)::int FROM "user") AS users,
          (SELECT count(*)::int FROM "session" WHERE "expiresAt" > now()) AS active_sessions,
          (SELECT count(*)::int FROM "user" WHERE COALESCE("twoFactorEnabled", false)) AS mfa_users,
          (SELECT count(DISTINCT "userId")::int FROM passkey) AS passkey_users,
          (SELECT count(*)::int FROM apikey WHERE COALESCE(enabled, true) AND ("expiresAt" IS NULL OR "expiresAt" > now())) AS active_api_keys,
          (SELECT count(*)::int FROM apikey WHERE "expiresAt" BETWEEN now() AND now() + interval '7 days') AS expiring_api_keys
      `),
      db.execute<ActivityRow>(sql`
        SELECT
          count(*) FILTER (WHERE action LIKE 'auth.sign_in%' AND created_at > now() - interval '24 hours')::int AS sign_ins,
          count(*) FILTER (WHERE outcome = 'denied' AND created_at > now() - interval '24 hours')::int AS denied,
          count(*) FILTER (WHERE severity = 'critical' AND created_at > now() - interval '7 days')::int AS critical
        FROM audit_events
      `),
      db.execute<TrendRow>(sql`
        WITH days AS (
          SELECT generate_series(current_date - interval '13 days', current_date, interval '1 day')::date AS day
        )
        SELECT days.day::text,
          count(a.id) FILTER (WHERE a.action LIKE 'auth.sign_in%')::int AS sign_ins,
          count(a.id) FILTER (WHERE a.outcome = 'denied')::int AS denied
        FROM days
        LEFT JOIN audit_events a ON a.created_at >= days.day AND a.created_at < days.day + interval '1 day'
        GROUP BY days.day ORDER BY days.day
      `),
      db.execute<ApplicationHealthRow>(sql`
        SELECT count(*)::int AS total,
          count(*) FILTER (WHERE last_health_status='healthy')::int AS healthy,
          count(*) FILTER (WHERE last_health_status='unhealthy')::int AS unhealthy
        FROM applications
      `),
      queryAuditEvents({ limit: 8 }),
    ]);

  const count = countsResult[0] ?? {
    users: 0,
    active_sessions: 0,
    mfa_users: 0,
    passkey_users: 0,
    active_api_keys: 0,
    expiring_api_keys: 0,
  };
  const recentActivity = activityResult[0] ?? { sign_ins: 0, denied: 0, critical: 0 };
  const applications = healthResult[0] ?? { total: 0, healthy: 0, unhealthy: 0 };

  return {
    metrics: {
      users: count.users,
      activeSessions: count.active_sessions,
      signIns24h: recentActivity.sign_ins,
      denied24h: recentActivity.denied,
      criticalEvents7d: recentActivity.critical,
      activeApiKeys: count.active_api_keys,
      expiringApiKeys: count.expiring_api_keys,
      mfaAdoption: count.users ? Math.round((count.mfa_users / count.users) * 100) : 0,
      passkeyAdoption: count.users ? Math.round((count.passkey_users / count.users) * 100) : 0,
      applications,
    },
    trend: trendResult.map((row) => ({
      day: row.day,
      signIns: row.sign_ins,
      denied: row.denied,
    })),
    recentEvents: recentEvents.logs,
  };
}
