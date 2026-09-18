import { route } from "../../router.js";
import {
  queryAuditEvents,
  type AuditOutcome,
  type AuditSeverity,
} from "../../audit-log.js";
import { parseBoundedInteger, requireAdmin } from "../../http.js";

function parseAuditOutcome(value: string | undefined): AuditOutcome | undefined {
  switch (value) {
    case "success":
    case "failure":
    case "denied":
      return value;
    default:
      return undefined;
  }
}

function parseAuditSeverity(value: string | undefined): AuditSeverity | undefined {
  switch (value) {
    case "info":
    case "warning":
    case "critical":
      return value;
    default:
      return undefined;
  }
}

function csvCell(value: unknown): string {
  const string = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${string.replaceAll('"', '""')}"`;
}

export const auditAdminRoutes = {
  "/api/admin/audit-logs": {
    GET: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    return c.json(
      await queryAuditEvents({
        limit: parseBoundedInteger(c.req.query("limit"), 50, 1, 500),
        offset: parseBoundedInteger(c.req.query("offset"), 0, 0, Number.MAX_SAFE_INTEGER),
        actorUserId: c.req.query("actorUserId"),
        action: c.req.query("action"),
        applicationId: c.req.query("applicationId"),
        outcome: parseAuditOutcome(c.req.query("outcome")),
        severity: parseAuditSeverity(c.req.query("severity")),
        search: c.req.query("search"),
        from: c.req.query("from"),
        to: c.req.query("to"),
      }),
    );
  }),
  },
  "/api/admin/audit-logs/export.csv": {
    GET: route(async (c) => {
    const session = await requireAdmin(c);
    if (session instanceof Response) return session;
    const { logs } = await queryAuditEvents({ limit: 500 });
    const lines = [
      [
        "createdAt",
        "severity",
        "outcome",
        "action",
        "actorUserId",
        "targetType",
        "targetId",
        "applicationId",
        "ipAddress",
        "metadata",
      ].join(","),
      ...logs.map((event) =>
        [
          event.createdAt,
          event.severity,
          event.outcome,
          event.action,
          event.actorUserId,
          event.targetType,
          event.targetId,
          event.applicationId,
          event.ipAddress,
          event.metadata,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    c.header("content-type", "text/csv; charset=utf-8");
    c.header(
      "content-disposition",
      `attachment; filename="gateauth-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return c.body(lines.join("\n"));
  }),
  },
};