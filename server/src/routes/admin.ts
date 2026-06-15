import type { Hono } from "hono";
import { registerApplicationAdminRoutes } from "./admin/applications.js";
import { registerAuditAdminRoutes } from "./admin/audit.js";
import { registerConfigAdminRoutes } from "./admin/config.js";
import { registerIdentityAdminRoutes } from "./admin/identity.js";

export function registerAdminRoutes(app: Hono): void {
  registerApplicationAdminRoutes(app);
  registerConfigAdminRoutes(app);
  registerAuditAdminRoutes(app);
  registerIdentityAdminRoutes(app);
}
